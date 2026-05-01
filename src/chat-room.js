export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.rateMap = new Map();
    this.destroyed = false;
    this.inactivityTimeout = parseInt(env.INACTIVITY_TIMEOUT_SECONDS || 300, 10);
  }

  async fetch(request) {
    if (this.destroyed) {
      return new Response("Channel destroyed", { status: 410 });
    }

    const pair = new WebSocketPair();
    const [server, client] = Object.values(pair);

    this.state.acceptWebSocket(server);
    await this.state.storage.deleteAlarm();

    setTimeout(() => {
      const sockets = this.state.getWebSockets();
      for (const socket of sockets) {
        if (socket !== server) {
          socket.send("!peer_joined");
        }
      }
    }, 0);

    await this.resetInactivityTimer();

    return new Response(null, { status: 101, webSocket: client });
  }

  checkRateLimit(ws) {
    const now = Date.now();
    let timestamps = this.rateMap.get(ws) || [];
    timestamps = timestamps.filter(t => now - t < 1000);
    if (timestamps.length >= 3) return false;
    timestamps.push(now);
    this.rateMap.set(ws, timestamps);
    return true;
  }

  cleanRateLimit(ws) {
    this.rateMap.delete(ws);
  }

  async resetInactivityTimer() {
    if (this.destroyed) return;
    if (this.inactivityTimeout <= 0) return;
    const sockets = this.state.getWebSockets();
    if (sockets.length === 0) return;

    await this.state.storage.deleteAlarm();
    const now = Date.now();
    const timeoutMs = this.inactivityTimeout * 1000;

    if (this.inactivityTimeout <= 30) {
      await this.state.storage.put('alarmType', 'destroy');
      await this.state.storage.setAlarm(now + timeoutMs);
    } else {
      await this.state.storage.put('alarmType', 'warning');
      await this.state.storage.setAlarm(now + timeoutMs - 30000);
    }

    for (const socket of sockets) {
      socket.send('!inactivity_reset');
    }
  }

  async doDestroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      socket.send('!channel_destroyed');
    }
    for (const socket of sockets) {
      socket.close(1000, 'Channel destroyed');
    }
    this.rateMap.clear();
    await this.state.storage.deleteAll();
  }

  async webSocketMessage(ws, message) {
    const msgSize = typeof message === "string" ? message.length : (message.byteLength || 0);
    if (msgSize > 16384) return;

    if (!this.checkRateLimit(ws)) {
      ws.send("!rate_limited");
      return;
    }

    if (message === "!destroy") {
      await this.doDestroy();
      return;
    }

    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) {
        socket.send(message);
      }
    }

    await this.resetInactivityTimer();
  }

  async webSocketClose(ws, code, reason, wasClean) {
    if (this.destroyed) return;
    this.cleanRateLimit(ws);

    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) {
        try {
          socket.send("!peer_left");
        } catch (e) {}
      }
    }
    await this.maybeScheduleDestruction();
  }

  async webSocketError(ws, error) {
    if (this.destroyed) return;
    this.cleanRateLimit(ws);

    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) {
        try {
          socket.send("!peer_left");
        } catch (e) {}
      }
    }
    await this.maybeScheduleDestruction();
  }

  async maybeScheduleDestruction() {
    if (this.destroyed) return;
    const sockets = this.state.getWebSockets();
    if (sockets.length === 0) {
      await this.state.storage.deleteAlarm();
      await this.state.storage.setAlarm(Date.now() + 5000);
    }
  }

  async alarm() {
    if (this.destroyed) return;

    const alarmType = await this.state.storage.get('alarmType');
    if (alarmType === 'warning') {
      const sockets = this.state.getWebSockets();
      if (sockets.length === 0) {
        await this.doDestroy();
        return;
      }
      const remaining = 30;
      for (const socket of sockets) {
        socket.send(`!inactivity_warning:${remaining}`);
      }
      await this.state.storage.put('alarmType', 'destroy');
      await this.state.storage.setAlarm(Date.now() + remaining * 1000);
    } else if (alarmType === 'destroy') {
      await this.doDestroy();
    } else {
      const sockets = this.state.getWebSockets();
      if (sockets.length === 0) {
        await this.state.storage.deleteAll();
      }
    }
  }
}
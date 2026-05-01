export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.rateMap = new Map();
    this.destroyed = false; // 新增销毁标志，防止重复销毁逻辑
    // 读取不活动超时配置（默认300秒，0禁用）
    this.inactivityTimeout = parseInt(env.INACTIVITY_TIMEOUT_SECONDS || 300, 10);
  }

  async fetch(request) {
    // 如果已经销毁，拒绝新连接
    if (this.destroyed) {
      return new Response("Channel destroyed", { status: 410 });
    }

    const pair = new WebSocketPair();
    const [server, client] = Object.values(pair);

    this.state.acceptWebSocket(server);
    await this.state.storage.deleteAlarm();

    // 广播加入事件
    setTimeout(() => {
      const sockets = this.state.getWebSockets();
      for (const socket of sockets) {
        if (socket !== server) {
          socket.send("!peer_joined");
        }
      }
    }, 0);

    // 有新用户加入，重置不活动计时器（若启用）
    await this.resetInactivityTimer();

    return new Response(null, { status: 101, webSocket: client });
  }

  // 频率检查：每连接每秒最多3条消息
  checkRateLimit(ws) {
    const now = Date.now();
    let timestamps = this.rateMap.get(ws) || [];
    timestamps = timestamps.filter(t => now - t < 1000);
    if (timestamps.length >= 3) return false; // 超限
    timestamps.push(now);
    this.rateMap.set(ws, timestamps);
    return true;
  }

  cleanRateLimit(ws) {
    this.rateMap.delete(ws);
  }

  // 重置不活动计时器（有新消息时调用）
  async resetInactivityTimer() {
    if (this.destroyed) return; // 已销毁，不再操作
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

    // 通知客户端取消倒计时
    for (const socket of sockets) {
      socket.send('!inactivity_reset');
    }
  }

  // 执行频道销毁
  async doDestroy() {
    if (this.destroyed) return; // 防止多次执行
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
    // 大小限制
    const msgSize = typeof message === "string" ? message.length : (message.byteLength || 0);
    if (msgSize > 16384) return;

    // 频率限制：超限时通知发送者并丢弃
    if (!this.checkRateLimit(ws)) {
      ws.send("!rate_limited");
      return;
    }

    // 手动销毁指令
    if (message === "!destroy") {
      await this.doDestroy();
      return;
    }

    // 广播加密消息（排除发送者）
    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) {
        socket.send(message);
      }
    }

    // 有新消息，重置不活动计时器
    await this.resetInactivityTimer();
  }

  async webSocketClose(ws, code, reason, wasClean) {
    // 如果频道已销毁，不再广播离开或设置报警
    if (this.destroyed) return;

    this.cleanRateLimit(ws);

    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) {
        try {
          socket.send("!peer_left");
        } catch (e) {
          // 忽略已断开的连接
        }
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
      // 默认情况：连接数为0时的5秒清理
      const sockets = this.state.getWebSockets();
      if (sockets.length === 0) {
        await this.state.storage.deleteAll();
      }
    }
  }
}
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.rateMap = new Map(); // 存放每个 WebSocket 的发送时间戳数组
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [server, client] = Object.values(pair);

    this.state.acceptWebSocket(server);
    await this.state.storage.deleteAlarm();

    // 广播加入事件给其他客户端
    setTimeout(() => {
      const sockets = this.state.getWebSockets();
      for (const socket of sockets) {
        if (socket !== server) {
          socket.send("!peer_joined");
        }
      }
    }, 0);

    return new Response(null, { status: 101, webSocket: client });
  }

  // 频率检查：每连接每秒最多 3 条消息
  checkRateLimit(ws) {
    const now = Date.now();
    let timestamps = this.rateMap.get(ws) || [];
    // 清除 1 秒前的记录
    timestamps = timestamps.filter(t => now - t < 1000);
    if (timestamps.length >= 3) return false; // 超限
    timestamps.push(now);
    this.rateMap.set(ws, timestamps);
    return true;
  }

  // 清理连接相关的速率记录
  cleanRateLimit(ws) {
    this.rateMap.delete(ws);
  }

  async webSocketMessage(ws, message) {
    // 大小限制（16 KB）
    const msgSize = typeof message === "string" ? message.length : (message.byteLength || 0);
    if (msgSize > 16384) return;

    // 频率限制
    if (!this.checkRateLimit(ws)) return;

    // 销毁指令
    if (message === "!destroy") {
      const sockets = this.state.getWebSockets();
      for (const socket of sockets) {
        socket.send("!channel_destroyed");
      }
      for (const socket of sockets) {
        socket.close(1000, "Channel destroyed");
      }
      await this.state.storage.deleteAll();
      // 移除无效的 abortController 代码，只需清理即可
      return;
    }

    // 广播加密消息（排除发送者）
    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) {
        socket.send(message);
      }
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    this.cleanRateLimit(ws);
    // 广播离开事件，捕获可能的异常
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
    const sockets = this.state.getWebSockets();
    if (sockets.length === 0) {
      await this.state.storage.setAlarm(Date.now() + 5000);
    }
  }

  async alarm() {
    const sockets = this.state.getWebSockets();
    if (sockets.length === 0) {
      await this.state.storage.deleteAll();
    }
  }
}
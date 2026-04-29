export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  // 处理 WebSocket 升级请求
  async fetch(request) {
    const pair = new WebSocketPair();
    const [server, client] = Object.values(pair);

    this.state.acceptWebSocket(server);
    await this.state.storage.deleteAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  // 收到消息
  async webSocketMessage(ws, message) {
    // ----- 销毁频道指令 -----
    if (message === "!destroy") {
      const sockets = this.state.getWebSockets();
      // 1. 通知所有客户端
      for (const socket of sockets) {
        socket.send("!channel_destroyed");
      }
      // 2. 关闭所有连接
      for (const socket of sockets) {
        socket.close(1000, "Channel destroyed by user");
      }
      // 3. 清除存储并立即终止 DO 实例
      await this.state.storage.deleteAll();
      this.state.abortController?.abort();
      return;
    }

    // ----- 普通消息广播（加密内容） -----
    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) {
        socket.send(message);
      }
    }
  }

  // 客户端关闭时检查是否需要自动销毁
  async webSocketClose(ws, code, reason, wasClean) {
    await this.maybeScheduleDestruction();
  }

  async webSocketError(ws, error) {
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
      this.state.abortController?.abort();
    }
  }
}
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [server, client] = Object.values(pair);

    // 接受服务端 WebSocket
    this.state.acceptWebSocket(server);

    // 取消自动销毁倒计时
    await this.state.storage.deleteAlarm();

    // 广播加入事件给其他客户端（须在 accept 之后，用 setTimeout 确保连接已注册）
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

  async webSocketMessage(ws, message) {
    // 销毁频道指令
    if (message === "!destroy") {
      const sockets = this.state.getWebSockets();
      for (const socket of sockets) {
        socket.send("!channel_destroyed");
      }
      for (const socket of sockets) {
        socket.close(1000, "Channel destroyed");
      }
      await this.state.storage.deleteAll();
      this.state.abortController?.abort();
      return;
    }

    // 普通加密消息广播（排除发送者）
    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) {
        socket.send(message);
      }
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    // 广播离开事件给其他客户端
    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) {
        socket.send("!peer_left");
      }
    }
    await this.maybeScheduleDestruction();
  }

  async webSocketError(ws, error) {
    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      if (socket !== ws) {
        socket.send("!peer_left");
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
      this.state.abortController?.abort();
    }
  }
}
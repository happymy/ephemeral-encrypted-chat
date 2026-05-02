export { ChatRoom } from "./chat-room";

// Nginx 伪装页 HTML
function getNginxHTML() {
  return `<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
    body { width: 35em; margin: 0 auto; font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and working. Further configuration is required.</p>
<p>For online documentation and support please refer to <a href="http://nginx.org/">nginx.org</a>.<br/>
Commercial support is available at <a href="http://nginx.com/">nginx.com</a>.</p>
<p><em>Thank you for using nginx.</em></p>
</body>
</html>`;
}

// 聊天室页面 HTML（注入 CHAT_PATH, CLEAR_ON_DESTROY, CLEAR_ON_DISCONNECT）
function getChatHTML(chatPath, clearOnDestroy, clearOnDisconnect) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>加密聊天室</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #111; color: #eee; display: flex; height: 100vh; justify-content: center; align-items: center; }
    .container { width: 100%; max-width: 600px; height: 90vh; display: flex; flex-direction: column; background: #1a1a1a; border-radius: 12px; overflow: hidden; position: relative; }
    .header { padding: 16px; background: #222; display: flex; gap: 8px; align-items: center; }
    .header input { flex: 1; padding: 8px 12px; border: 1px solid #444; border-radius: 6px; background: #333; color: #fff; }
    .header button { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; }
    #copyBtn { background: #3b82f6; color: #fff; }
    #destroyBtn { background: #ef4444; color: #fff; font-size: 1.2em; line-height: 1; }
    #messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .msg { padding: 10px 14px; border-radius: 10px; max-width: 85%; word-break: break-word; line-height: 1.4; }
    .msg.self { align-self: flex-end; background: #2563eb; color: white; }
    .msg.other { align-self: flex-start; background: #2a2a2a; border-left: 4px solid; }
    .msg.system { align-self: center; background: #3f1f1f; color: #fca5a5; font-size: 0.85em; border-left: none; text-align: center; max-width: 90%; }
    .msg .sender { font-size: 0.75em; font-weight: bold; margin-bottom: 4px; }
    .input-area { display: flex; padding: 12px; background: #222; gap: 8px; }
    .input-area input { flex: 1; padding: 10px; border: 1px solid #444; border-radius: 6px; background: #333; color: #fff; }
    .input-area button { padding: 10px 20px; border: none; border-radius: 6px; background: #3b82f6; color: #fff; cursor: pointer; }
    .warning { color: #f87171; text-align: center; padding: 8px; font-size: 0.9em; }
    .info { color: #fbbf24; text-align: center; padding: 4px; font-size: 0.8em; background: #1a1a1a; }

    #inactivityWarning {
      background: #b91c1c;
      color: #fff;
      text-align: center;
      padding: 10px;
      font-weight: bold;
      display: none;
      flex-shrink: 0;
    }

    .modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center;
      z-index: 1000;
    }
    .modal {
      background: #1f1f1f; border-radius: 12px; padding: 24px; width: 320px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .modal h2 { margin-bottom: 16px; text-align: center; }
    .modal input {
      width: 100%; padding: 10px; border: 1px solid #444; border-radius: 6px;
      background: #333; color: #fff; margin-bottom: 16px; font-size: 1em;
    }
    .modal button {
      width: 100%; padding: 10px; border: none; border-radius: 6px;
      background: #3b82f6; color: #fff; cursor: pointer; font-size: 1em;
    }

    #notificationContainer {
      position: fixed; top: 16px; right: 16px; z-index: 999;
      display: flex; flex-direction: column; gap: 8px; max-width: 300px;
    }
    .notification {
      background: #333; color: #eee; border-left: 4px solid; border-radius: 6px;
      padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5); animation: slideIn 0.3s ease-out;
    }
    .notification .close-btn {
      background: none; border: none; color: #aaa; cursor: pointer; font-size: 1.2em;
      margin-left: 12px; line-height: 1;
    }
    .notification .close-btn:hover { color: #fff; }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  </style>
</head>
<body>
  <div id="nameModal" class="modal-overlay">
    <div class="modal">
      <h2>设置你的昵称</h2>
      <input type="text" id="nameInput" placeholder="输入昵称（留空随机，最长12字符）" maxlength="12" />
      <button id="nameConfirmBtn">进入聊天室</button>
    </div>
  </div>
  <div id="notificationContainer"></div>

  <div class="container">
    <div class="header">
      <input id="roomUrl" type="text" readonly placeholder="房间链接将在此生成..." />
      <button id="copyBtn">复制链接</button>
      <button id="destroyBtn" title="销毁频道">💣</button>
    </div>
    <div id="inactivityWarning"></div>
    <div id="messages"></div>
    <div class="input-area" id="inputArea">
      <input id="messageInput" type="text" placeholder="输入消息，回车发送..." autofocus />
      <button id="sendBtn">发送</button>
    </div>
    <div class="warning" id="status">正在连接...</div>
    <div class="info">⚠️ 此链接包含密钥，请勿公开分享</div>
  </div>

  <script type="module">
    // 由服务端注入的聊天路径和清空标志（已安全转义）
    window.CHAT_PATH = ${JSON.stringify(chatPath)};
    window.CLEAR_ON_DESTROY = ${JSON.stringify(clearOnDestroy)};
    window.CLEAR_ON_DISCONNECT = ${JSON.stringify(clearOnDisconnect)};

    // ---------- 工具函数 ----------
    function buf2base64(buf) {
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }

    function base642buf(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }

    function generateRoomId() {
      return Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    }

    const USER_COLORS = [
      "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399",
      "#22d3ee", "#60a5fa", "#a78bfa", "#f472b6", "#fb7185"
    ];

    function randomName() {
      const suffix = Array.from(crypto.getRandomValues(new Uint8Array(2)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
      return "用户_" + suffix;
    }

    function randomColor() {
      return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    }

    function isValidColor(str) {
      return /^#[0-9a-fA-F]{6}$/.test(str);
    }

    function safeColor(color) {
      return (typeof color === "string" && isValidColor(color)) ? color : "#888888";
    }

    let myName = randomName();
    let myColor = randomColor();

    // ---------- 加解密 ----------
    async function generateKey() {
      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      const raw = await crypto.subtle.exportKey("raw", key);
      return { key, raw: new Uint8Array(raw) };
    }

    async function importKey(rawKey) {
      return crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    }

    async function encrypt(key, plaintext) {
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(plaintext)
      );
      const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
      combined.set(iv);
      combined.set(new Uint8Array(ciphertext), iv.length);
      return buf2base64(combined.buffer);
    }

    async function decrypt(key, base64Cipher) {
      const combined = new Uint8Array(base642buf(base64Cipher));
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
      );
      return new TextDecoder().decode(decrypted);
    }

    // ---------- DOM ----------
    const nameModal = document.getElementById("nameModal");
    const nameInput = document.getElementById("nameInput");
    const nameConfirmBtn = document.getElementById("nameConfirmBtn");
    const notificationContainer = document.getElementById("notificationContainer");
    const inactivityWarningDiv = document.getElementById("inactivityWarning");
    const messagesDiv = document.getElementById("messages");
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const roomUrlInput = document.getElementById("roomUrl");
    const copyBtn = document.getElementById("copyBtn");
    const destroyBtn = document.getElementById("destroyBtn");
    const statusDiv = document.getElementById("status");

    let cryptoKey = null;
    let roomId = null;
    let ws = null;
    let inactivityCountdown = null;

    function showInactivityWarning(seconds) {
      const remaining = parseInt(seconds, 10) || 30;
      if (inactivityCountdown) clearInterval(inactivityCountdown);
      inactivityWarningDiv.style.display = 'block';
      let remainingSec = remaining;
      const update = () => {
        if (remainingSec <= 0) {
          clearInterval(inactivityCountdown);
          inactivityCountdown = null;
          inactivityWarningDiv.textContent = '💣 频道已销毁';
          return;
        }
        inactivityWarningDiv.textContent = \`⏳ 由于不活动，频道将在 \${remainingSec} 秒后自动销毁\`;
        remainingSec--;
      };
      update();
      inactivityCountdown = setInterval(update, 1000);
    }

    function clearInactivityWarning() {
      if (inactivityCountdown) {
        clearInterval(inactivityCountdown);
        inactivityCountdown = null;
      }
      inactivityWarningDiv.style.display = 'none';
    }

    function showNotification(name, color) {
      const safeCol = safeColor(color);
      const div = document.createElement("div");
      div.className = "notification";
      div.style.borderLeftColor = safeCol;
      div.innerHTML = \`<span>\${escapeHtml(name)} 加入了频道</span><button class="close-btn">&times;</button>\`;
      div.querySelector(".close-btn").addEventListener("click", () => {
        div.remove();
      });
      notificationContainer.appendChild(div);
    }

    function showGenericNotification(message) {
      const div = document.createElement("div");
      div.className = "notification";
      div.style.borderLeftColor = "#666";
      div.innerHTML = \`<span>\${escapeHtml(message)}</span><button class="close-btn">&times;</button>\`;
      div.querySelector(".close-btn").addEventListener("click", () => {
        div.remove();
      });
      notificationContainer.appendChild(div);
    }

    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    async function initFromHash() {
      const hash = window.location.hash.substring(1);
      if (hash) {
        const [rid, keyB64] = hash.split(":");
        if (rid && keyB64) {
          roomId = rid;
          try {
            const rawKey = new Uint8Array(base642buf(keyB64));
            cryptoKey = await importKey(rawKey);
            return true;
          } catch (e) {
            console.error("密钥导入失败", e);
          }
        }
      }
      return false;
    }

    async function createNewRoom() {
      roomId = generateRoomId();
      const { key, raw } = await generateKey();
      cryptoKey = key;
      const keyB64 = buf2base64(raw.buffer);
      window.location.hash = \`\${roomId}:\${keyB64}\`;
      roomUrlInput.value = window.location.href;
    }

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsPath = (window.CHAT_PATH || "/chat").replace(/\\/$/, '') + "/";
      const wsUrl = \`\${protocol}//\${window.location.host}\${wsPath}?room=\${roomId}\`;
      ws = new WebSocket(wsUrl);

      ws.onopen = async () => {
        statusDiv.textContent = "已连接（加密频道）";
        statusDiv.style.color = "#4ade80";
        try {
          const joinPayload = JSON.stringify({ type: "join", name: myName, color: myColor });
          const cipher = await encrypt(cryptoKey, joinPayload);
          ws.send(cipher);
        } catch (e) {
          console.error("发送加入通知失败", e);
        }
      };

      ws.onmessage = async (event) => {
        const msg = event.data;

        if (typeof msg === "string") {
          if (msg === "!channel_destroyed") {
            clearInactivityWarning();
            statusDiv.textContent = "频道已被销毁";
            statusDiv.style.color = "#f87171";
            messageInput.disabled = true;
            sendBtn.disabled = true;

            if (window.CLEAR_ON_DESTROY === "1") {
              // 清空所有聊天内容和通知
              messagesDiv.innerHTML = "";
              notificationContainer.innerHTML = "";
              document.getElementById("inputArea").style.display = "none";
              addMessage("💣 频道已被销毁，页面内容已清空", false, "系统", "#ff4444", true);
              setTimeout(() => {
                statusDiv.textContent = "频道已销毁，请关闭页面或刷新";
              }, 3000);
            } else {
              addMessage("💣 频道已被销毁，请关闭页面或刷新", false, "系统", "#ff4444", true);
            }

            try { ws.close(); } catch (e) {}
            return;
          }
          if (msg === "!peer_joined") {
            addMessage("一位用户加入了频道", false, "系统", "#666", true);
            showGenericNotification("注意，一位用户加入了频道，如何没有对应的昵称信息，请立即销毁频道，以防泄密风险！");
            return;
          }
          if (msg === "!peer_left") {
            addMessage("一位用户离开了频道", false, "系统", "#666", true);
            return;
          }
          if (msg.startsWith("!inactivity_warning:")) {
            const seconds = msg.split(":")[1];
            showInactivityWarning(seconds);
            return;
          }
          if (msg === "!inactivity_reset") {
            clearInactivityWarning();
            return;
          }
          if (msg === "!rate_limited") {
            statusDiv.textContent = "发送太频繁，请稍候...";
            statusDiv.style.color = "#fbbf24";
            setTimeout(() => {
              if (statusDiv.textContent === "发送太频繁，请稍候...") {
                statusDiv.textContent = "已连接（加密频道）";
                statusDiv.style.color = "#4ade80";
              }
            }, 2000);
            return;
          }
        }

        try {
          const plain = await decrypt(cryptoKey, msg);
          clearInactivityWarning();

          let data;
          try {
            data = JSON.parse(plain);
          } catch {
            data = { name: "未知", color: "#999", text: plain };
          }

          if (data.type === "join") {
            const safeCol = safeColor(data.color);
            showNotification(data.name, safeCol);
            addMessage(data.name + " 加入了频道", false, data.name, safeCol, true);
            return;
          }

          const { name, color, text } = data;
          addMessage(text, false, name, safeColor(color));
        } catch (e) {
          console.warn("解密失败，消息已丢弃", e);
        }
      };

      ws.onclose = () => {
        clearInactivityWarning();
        statusDiv.textContent = "连接已断开，刷新页面重连";
        statusDiv.style.color = "#f87171";
        
        // 根据环境变量决定是否清空历史消息
        if (window.CLEAR_ON_DISCONNECT === "1") {
          // 清空所有聊天内容和通知
          messagesDiv.innerHTML = "";
          notificationContainer.innerHTML = "";
          // 可选：禁用输入区域或显示提示
          messageInput.disabled = true;
          sendBtn.disabled = true;
          addMessage("🔌 连接已断开，页面内容已清空", false, "系统", "#ff4444", true);
        } else {
          addMessage("🔌 连接已断开，请刷新页面重连", false, "系统", "#ff4444", true);
        }
      };

      ws.onerror = () => {
        statusDiv.textContent = "连接错误";
        statusDiv.style.color = "#f87171";
      };
    }

    function addMessage(text, isSelf, senderName = "", senderColor = "#888888", isSystem = false) {
      const div = document.createElement("div");
      if (isSystem) {
        div.className = "msg system";
        div.innerHTML = escapeHtml(text);
      } else if (isSelf) {
        div.className = "msg self";
        div.innerHTML = \`<span class="sender" style="opacity:0.6">我</span><br>\${escapeHtml(text)}\`;
      } else {
        div.className = "msg other";
        div.style.borderLeftColor = senderColor;
        div.innerHTML = \`<span class="sender" style="color:\${senderColor}">\${escapeHtml(senderName)}</span><br>\${escapeHtml(text)}\`;
      }
      messagesDiv.appendChild(div);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    async function sendMessage(plainText) {
      if (!ws || ws.readyState !== WebSocket.OPEN || !cryptoKey) return;
      if (typeof plainText !== "string" || plainText.length > 4000) {
        alert("消息过长，最多允许 4000 字符");
        return;
      }
      const payload = JSON.stringify({ name: myName, color: myColor, text: plainText });
      const cipherB64 = await encrypt(cryptoKey, payload);
      ws.send(cipherB64);
      addMessage(plainText, true);
    }

    // ---------- 事件绑定 ----------
    sendBtn.addEventListener("click", () => {
      const text = messageInput.value.trim();
      if (text) {
        sendMessage(text);
        messageInput.value = "";
      }
    });
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); sendBtn.click(); }
    });
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(roomUrlInput.value).then(() => {
        copyBtn.textContent = "已复制！";
        setTimeout(() => (copyBtn.textContent = "复制链接"), 1500);
      }).catch(() => {
        roomUrlInput.select();
        document.execCommand("copy");
        copyBtn.textContent = "已复制！";
        setTimeout(() => (copyBtn.textContent = "复制链接"), 1500);
      });
    });
    destroyBtn.addEventListener("click", () => {
      if (confirm("确定要立即销毁这个加密频道吗？\\n所有用户都将被断开，频道将永久消失。")) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send("!destroy");
        }
      }
    });
    window.addEventListener("beforeunload", () => {
      if (ws) ws.close();
    });

    nameConfirmBtn.addEventListener("click", () => {
      let inputName = nameInput.value.trim();
      if (inputName.length > 20) inputName = inputName.slice(0, 20);
      if (inputName) myName = inputName;
      nameModal.style.display = "none";
      connect();
    });
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        nameConfirmBtn.click();
      }
    });

    (async () => {
      const hasValidHash = await initFromHash();
      if (!hasValidHash) {
        await createNewRoom();
      } else {
        roomUrlInput.value = window.location.href;
      }
    })();
  </script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 读取自定义路径，默认为 /chat，确保以 / 开头
    let chatPath = (env.CHAT_PATH || "/chat").trim();
    if (!chatPath.startsWith("/")) {
      chatPath = "/" + chatPath;
    }

    // 读取清空页面标志（默认 "1"）
    const clearOnDestroy = env.CLEAR_ON_DESTROY || "1";
    
    // 读取断开连接时清空标志（默认 "1"）
    const clearOnDisconnect = env.CLEAR_ON_DISCONNECT || "1";

    // 判断是否为 WebSocket 升级请求
    if (request.headers.get("Upgrade") === "websocket") {
      // 只处理聊天路径下的 WebSocket
      if (path === chatPath || path === chatPath + "/") {
        const roomId = url.searchParams.get("room");
        if (!roomId) {
          return new Response("Missing room ID", { status: 400 });
        }
        const id = env.CHAT_ROOM.idFromName(roomId);
        const stub = env.CHAT_ROOM.get(id);
        return stub.fetch(request);
      } else {
        // 其他路径的 WebSocket 请求返回 404
        return new Response("Not Found", { status: 404 });
      }
    }

    // 普通 HTTP 请求：区分聊天页面与伪装页面
    if (path === chatPath || path === chatPath + "/") {
      return new Response(getChatHTML(chatPath, clearOnDestroy, clearOnDisconnect), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
          "Referrer-Policy": "no-referrer"
        }
      });
    }

    // 其他所有路径返回 Nginx 伪装页
    return new Response(getNginxHTML(), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY"
      }
    });
  }
};

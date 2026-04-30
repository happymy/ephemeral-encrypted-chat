# 🔐 端到端加密匿名聊天室

一个基于 Cloudflare Workers 和 Durable Objects 的完全匿名、端到端加密的实时聊天应用。  
消息在浏览器内使用 AES-256-GCM 加密，服务器无法解密。  
频道在所有人退出后自动销毁，不留任何记录。

## ✨ 特性

- **端到端加密**：所有消息在本地加密/解密，密钥通过链接分享，服务器不可见
- **零存储**：不保存任何聊天记录、用户信息，消息仅保存在当前页面内存中
- **匿名即用**：无需注册、登录，分享链接即可加入加密频道
- **自动销毁**：频道内所有用户断开后，5 秒后自动销毁
- **手动销毁**：任意用户可一键立即销毁频道
- **自定义昵称**：支持设置显示名称，自动分配颜色，区分不同发言者
- **加入通知**：新用户加入时广播系统消息和弹出通知条
- **安全加固**：已修复 CSS 注入等常见前端漏洞

## 🚀 快速部署

### 准备工作

1. 安装 [Node.js](https://nodejs.org) (v18+) 和 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)：

   ```
   npm install -g wrangler
   ```

2. 登录 Cloudflare 账号：

   ```
   wrangler login
   ```

### 部署步骤

#### 1. 克隆项目

从本仓库获取所有文件内容。

#### 2. 按需求配置 wrangler.toml

可直接使用项目提供的wrangler.toml配置文件：

```
name = "encrypted-chat"
main = "src/index.js"
compatibility_date = "2024-12-01"

[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom"]
```

#### 3. 部署到 Cloudflare

```
wrangler deploy
```

#### 4. 访问你的应用

部署成功后，会得到一个 `*.workers.dev` 域名，加上/chat路径直接打开即可使用。
## 可以通过修改CHAT_PATH环境变量，自定义路径。

## 📖 使用方法

1. 打开网页，会自动生成一个加密房间，并在地址栏显示带密钥的链接。
2. 设置你的昵称后进入聊天室。
3. 将地址栏的完整链接发送给朋友，他们即可加入同一个加密频道。
4. 所有消息在浏览器中加密后发送，只有拥有密钥的人才能解密。
5. 点击 ❌ 关闭标签页或点击 💣 立即销毁频道。

> ⚠️ **重要提示**：链接中包含加密密钥，请通过安全渠道分享，避免公开传播。

## 🧱 架构

```
浏览器 A ──WebSocket──┐
                      ├── Durable Object (房间实例) ── 广播加密消息
浏览器 B ──WebSocket──┘
```

- **前端**：自包含的 HTML，完成密钥生成、消息加解密、UI 交互
- **Worker**：处理静态页面请求，将 WebSocket 升级请求路由到对应的 Durable Object
- **Durable Object**：管理每个房间的连接，只负责转发加密消息，不计录任何内容

### 关键设计

- 房间 ID 和 256 位 AES 密钥编码在 URL 的 hash 中 (`#roomId:base64key`)
- 服务端完全不接触密钥，无法解密消息内容
- 房间在无连接后 5 秒自动清除存储并终止
- 支持手动销毁指令 `!destroy`，服务端立即关闭所有连接

## 🔒 安全审计

已审计并修复以下风险：

- ✅ **CSS 注入**：强制校验用户颜色值，仅允许 `#XXXXXX` 格式
- ✅ **任意销毁**：仅前端提供销毁按钮（有确认弹窗），服务端不做额外权限控制；但频道本就设计为任何人可销毁
- ⚠️ **加入通知伪造**：由于消息加密，服务端无法区分通知类型，建议谨慎信任通知内容
- ⚠️ **重放攻击**：消息不含时间戳，有一定重放可能
- ⚠️ **速率限制**：未实现消息频率限制

详细信息见项目文档或代码注释。

## 📂 文件说明

| 文件 | 说明 |
|------|------|
| `wrangler.toml` | Cloudflare Workers 配置文件 |
| `src/index.js` | Worker 主入口，包含静态页面和 WebSocket 路由 |
| `src/chat-room.js` | Durable Object 类，处理房间广播和销毁逻辑 |

## 🛠️ 技术栈

- Cloudflare Workers & Durable Objects
- Web Crypto API (AES-256-GCM)
- WebSocket
- 原生 JavaScript (无框架)

## 📝 许可证

MIT License

如果你觉得有用，欢迎 ⭐ Star 本项目！  
如有安全问题或建议，请提交 Issue 或 PR。


# 八卦稻香村 (Gossip Village)

一款基于 AI Agent 的江湖模拟游戏。你作为隐形的观察者，通过散布信息操控村民的关系与命运。

## 技术栈

*   **Frontend**: React 19, TypeScript, TailwindCSS
*   **AI**: Google Gemini API (默认) 或 OpenAI 兼容接口 (DeepSeek 等)
*   **Build**: Vite
*   **Deployment**: PM2 + Serve

## 快速开始 (本地开发)

1.  **安装依赖**
    ```bash
    npm install
    ```

2.  **配置环境**
    复制 `.env.example` (如果有) 或直接新建 `.env` 文件，填入你的 API Key：
    ```env
    # Google Gemini API Key
    API_KEY=your_api_key_here
    ```
    > 注意：由于是前端项目，确保构建工具已配置将 `process.env.API_KEY` 注入到代码中 (Vite 通常需要 `VITE_` 前缀或 define 配置，本项目假设已有相关配置处理)。

3.  **启动开发服务器**
    ```bash
    npm run dev
    ```

## 服务器部署指南 (Linux/Mac)

本项目提供了一套完整的脚本，用于在服务器上后台运行、监控和维护。

### 1. 首次部署与启动

确保服务器已安装 Node.js (推荐 v18+)。

```bash
# 1. 赋予脚本执行权限 (仅需一次)
chmod +x server_scripts/*.sh

# 2. 配置 API Key
# 创建 .env 文件并填入 API_KEY=xxx
vim .env 

# 3. 一键启动 (包含安装依赖、构建、后台运行)
./server_scripts/start.sh
```

启动后，应用将运行在 `http://localhost:3000`。
*如果需要外网访问，请确保服务器防火墙放行了 3000 端口，或配置 Nginx 反向代理指向 3000 端口。*

### 2. 运维管理

即使关闭终端（SSH断开），服务也会继续运行。

| 操作 | 脚本命令 | 描述 |
| :--- | :--- | :--- |
| **查看状态** | `./server_scripts/status.sh` | 查看 CPU/内存占用、运行时间等 |
| **查看日志** | `./server_scripts/logs.sh` | 实时查看访问日志和报错信息 (Ctrl+C 退出) |
| **停止服务** | `./server_scripts/stop.sh` | 停止后台进程 |
| **更新重启** | `./server_scripts/restart.sh` | 拉取代码后，执行此命令重新构建并重启 |

### 3. 高级配置

如果需要修改运行端口或其他 PM2 配置，请修改根目录下的 `ecosystem.config.cjs` 文件：

```javascript
module.exports = {
  apps: [
    {
      name: "gossip-village",
      env: {
        PM2_SERVE_PORT: 3000, // 修改此处端口
        // ...
      },
      // ...
    }
  ]
};
```

## 模型切换

本项目支持无痛切换大模型（如从 Gemini 切换到 DeepSeek）。

修改 `config/apiConfig.ts`：

```typescript
export const API_CONFIG = {
  // 'gemini' | 'openai'
  provider: 'openai', 
  
  // 你的模型 ID (例如 deepseek-chat)
  modelId: 'deepseek-chat',
  
  // API Base URL
  baseUrl: 'https://api.deepseek.com',
  
  // ...
};
```

> ** 切换模型需要修改 .env 文件吗？**
> *   **需要**：如果你是从一家服务商切换到另一家（例如 Gemini -> DeepSeek），你需要更新 `.env` 中的 `API_KEY` 为新服务商的密钥。
> *   **不需要**：如果你只是切换同一家服务商的不同模型（例如 `gemini-flash` -> `gemini-pro`），通常无需修改环境变量，直接使用同一个 Key 即可。

修改完成后，执行 `./server_scripts/restart.sh` 生效。

## 常见问题

**Q: 启动后网页白屏？**
A: 
1. 检查浏览器控制台 (F12) 是否有报错。
2. 检查 `./server_scripts/logs.sh` 是否有构建错误。
3. 确保 `.env` 中的 `API_KEY` 正确且有效。

**Q: 如何配置 Nginx 反向代理？**
A: 在 Nginx 配置文件中添加：
```nginx
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 开源协议 (License)

本项目遵循 [MIT License](LICENSE) 开源协议。

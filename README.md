# 八卦稻香村 (Gossip Village)

一款基于 AI Agent 的江湖模拟游戏。你作为隐形的观察者，通过散布信息操控村民的关系与命运。

## 技术栈

* **Frontend**: React 19, TypeScript, TailwindCSS
* **AI**: Google Gemini API (默认) 或 OpenAI 兼容接口 (DeepSeek 等)
* **Build**: Vite
* **Deployment**: PM2 + Serve

## 快速开始 (本地开发)

1.  **安装依赖**
    ```bash
    npm install
    # 如果本地没有安装 serve，可以全局安装或使用 npx 运行
    npm install -g serve
    ```

2.  **配置环境**
    复制 `.env.example` (如果有) 或直接新建 `.env` 文件，填入你的 API Key：
    ```env
    # Google Gemini API Key 或 DeepSeek/OpenAI Key
    API_KEY=your_api_key_here
    ```
    > 注意：Vite 构建时会自动读取以 `VITE_` 开头的变量，或通过配置注入 `process.env`。本项目已配置好环境变量注入。

3.  **启动开发服务器**
    ```bash
    npm run dev
    ```

## 服务器部署指南 (Linux/Mac)

本项目提供了一套完整的脚本，用于在服务器上实现工程化的自动部署和运维。

### 1. 首次部署

确保服务器已安装 **Node.js** (推荐 v18+) 和 **Git**。

```bash
# 1. 克隆代码并进入目录
git clone https://github.com/0Hyacinth0/Gossip-Village.git
cd gossip-village

# 2. 赋予脚本执行权限
chmod +x server_scripts/*.sh

# 3. 配置环境变量
# 创建 .env 文件并填入 API_KEY
vim .env 

# 4. 执行一键部署 (包含安装 PM2、依赖、构建和启动)
./server_scripts/deploy.sh

```

启动后，应用将运行在 `http://localhost:3000`。
*如果需要外网访问，请确保服务器防火墙放行了 3000 端口，或配置 Nginx 反向代理。*

### 2. 运维管理命令

我们采用了动静分离的运维策略：**更新代码请用 `deploy.sh`，日常启停请用 `start/stop/restart.sh**`。

| 操作 | 脚本命令 | 描述 |
| --- | --- | --- |
| **发布/更新** | `./server_scripts/deploy.sh` | **最常用**。拉取 git 代码 -> 安装依赖 -> 构建 -> 平滑重载服务。 |
| **启动服务** | `./server_scripts/start.sh` | 仅启动 PM2 进程（不进行构建）。如果服务已在运行则不会重复启动。 |
| **停止服务** | `./server_scripts/stop.sh` | 停止后台进程。 |
| **重启服务** | `./server_scripts/restart.sh` | 仅重启 PM2 进程（**不**拉取代码或构建）。用于修改 .env 或配置后生效。 |
| **查看日志** | `./server_scripts/logs.sh` | 实时查看访问日志和报错信息 (Ctrl+C 退出)。 |
| **查看状态** | `./server_scripts/status.sh` | 查看 CPU/内存占用、运行时间等。 |

### 3. 高级配置

如果需要修改运行端口、日志路径或内存限制，请修改根目录下的 `ecosystem.config.cjs` 文件：

```javascript
module.exports = {
  apps: [{
    name: "gossip-village",
    script: "npx",
    args: "serve -s dist -l 3000",
    // ...
  }]
};

```

修改配置后，请运行 `./server_scripts/restart.sh` 使其生效。

## 模型切换

本项目支持无痛切换大模型（如从 Gemini 切换到 DeepSeek）。

1. 修改 `config/apiConfig.ts`：

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

2. 如果切换了服务商（如从 Google 换到 DeepSeek），请更新 `.env` 中的 `API_KEY`。
3. 执行构建更新：
```bash
./server_scripts/deploy.sh

```



## 常见问题

**Q: 部署时提示 `command not found: pm2`？**
A: `deploy.sh` 脚本会自动尝试启动服务。如果未找到 PM2，请手动安装：`npm install -g pm2`。

**Q: 修改代码后没有生效？**
A: 请确保你运行的是 `./server_scripts/deploy.sh` 而不是 `restart.sh`。只有 `deploy.sh` 会执行 `npm run build` 重新编译前端资源。

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

本项目遵循 [MIT License](https://www.google.com/search?q=LICENSE) 开源协议。

```
Copyright (c) 2025 Hyacinth. All rights reserved.
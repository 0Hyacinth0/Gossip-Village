#!/bin/bash
# server_scripts/deploy.sh

# 遇到错误立即停止
set -e

# 获取脚本所在目录的上一级（项目根目录）
WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WORK_DIR"

echo -e "\033[34m[Deploy] 开始部署 Gossip Village...\033[0m"

# 1. 拉取代码
echo -e "\033[33m-> 正在拉取最新代码...\033[0m"
git pull

# 2. 安装依赖 (自动处理新增的 Tailwind 依赖)
echo -e "\033[33m-> 正在检查并安装依赖...\033[0m"
# 使用 install 而不是 ci，以确保 package-lock.json 更新（如果你在本地没提交 lock 文件）
npm install

# 3. 检查环境配置
if [ -f .env ]; then
    echo -e "\033[32m-> 检测到 .env 文件\033[0m"
    # 可选：简单的检查，不强制阻断，因为 vite loadEnv 会处理
    if ! grep -q "API_KEY" .env && ! grep -q "GEMINI_API_KEY" .env; then
        echo -e "\033[31m[警告] .env 文件中似乎缺少 API_KEY 或 GEMINI_API_KEY，应用可能无法启动！\033[0m"
    fi
else
    echo -e "\033[31m[警告] 未检测到 .env 文件，构建可能缺少 API Key！\033[0m"
fi

# 4. 构建项目
echo -e "\033[33m-> 正在构建应用 (Build)...\033[0m"
npm run build

# 5. 确保日志目录存在
mkdir -p "$WORK_DIR/logs"

# 6. 重载 PM2 进程
echo -e "\033[33m-> 正在重载 PM2 服务...\033[0m"
if pm2 list | grep -q "gossip-village"; then
    # --update-env 确保读取最新的环境变量
    pm2 reload gossip-village --update-env
else
    pm2 start ecosystem.config.cjs
    pm2 save
fi

echo -e "\033[32m[Success] 部署完成！请刷新浏览器查看。\033[0m"
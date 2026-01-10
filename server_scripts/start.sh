#!/bin/bash
# server_scripts/start.sh

WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WORK_DIR"

echo -e "\033[34m[Start] 启动 Gossip Village...\033[0m"

# 检查 PM2 是否存在
if ! command -v pm2 &> /dev/null; then
    echo -e "\033[31m[错误] 未找到 PM2，请先运行: npm install -g pm2\033[0m"
    exit 1
fi

# 检查应用是否已经在运行
if pm2 list | grep -q "gossip-village"; then
    echo -e "\033[32m应用 'gossip-village' 已经在运行中。\033[0m"
    echo "如果是为了更新代码，请运行 ./server_scripts/deploy.sh"
    echo "如果是为了重启服务，请运行 ./server_scripts/restart.sh"
else
    # 确保 dist 目录存在，如果不存在说明没 build 过
    if [ ! -d "dist" ]; then
        echo -e "\033[33m检测到首次运行，正在执行构建...\033[0m"
        npm install && npm run build
    fi
    
    pm2 start ecosystem.config.cjs
    pm2 save
    echo -e "\033[32m[Success] 应用已启动。\033[0m"
fi
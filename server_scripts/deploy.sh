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

# 2. 安装依赖 (使用 ci 或 install)
echo -e "\033[33m-> 正在检查并安装依赖...\033[0m"
npm install --no-audit --prefer-offline

# 3. 构建项目
echo -e "\033[33m-> 正在构建应用 (Build)...\033[0m"
# 检查环境变量文件是否存在，如果不存在则警告
if [ ! -f .env ]; then
    echo -e "\033[31m[警告] 未检测到 .env 文件，构建可能缺少 API Key！\033[0m"
fi
npm run build

# 4. 确保日志目录存在
mkdir -p "$WORK_DIR/logs"

# 5. 重载 PM2 进程
echo -e "\033[33m-> 正在重载 PM2 服务...\033[0m"
if pm2 list | grep -q "gossip-village"; then
    # 如果已运行，使用 reload 实现平滑重启（更新环境变量）
    pm2 reload gossip-village --update-env
else
    # 如果未运行，则启动
    pm2 start ecosystem.config.cjs
    pm2 save
fi

echo -e "\033[32m[Success] 部署完成！应用已更新。\033[0m"
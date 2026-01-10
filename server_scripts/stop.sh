#!/bin/bash

# stop.sh - 停止应用程序后台进程

# 设置工作目录
# 脚本位于server_scripts目录下，使用../回到项目根目录
WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WORK_DIR"

echo "=== 停止 Gossip Village 应用程序 ==="
echo ""

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "错误: PM2 未安装，请先安装 PM2: npm install -g pm2"
    exit 1
fi

# 检查应用是否在运行
if pm2 status gossip-village &> /dev/null; then
    echo "正在停止应用程序..."
    # 停止应用
    pm2 stop gossip-village
    
    echo ""
    echo "应用程序已成功停止"
    
    # 显示当前PM2状态
    echo ""
    echo "当前PM2进程状态:"
    pm2 status
else
    echo "应用程序未在运行"
    
    # 显示当前PM2状态
    echo ""
    echo "当前PM2进程状态:"
    pm2 status
fi

echo ""
echo "=== 命令提示 ==="
echo "启动应用: ./server_scripts/start.sh"
echo "查看状态: ./server_scripts/status.sh"
echo "查看日志: ./server_scripts/logs.sh"
echo "重启应用: ./server_scripts/restart.sh"

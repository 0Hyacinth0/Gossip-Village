#!/bin/bash

# status.sh - 查看应用程序状态信息

# 设置工作目录
# 脚本位于server_scripts目录下，使用../回到项目根目录
WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WORK_DIR"

echo "=== Gossip Village 应用状态信息 ==="
echo ""

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "错误: PM2 未安装，请先安装 PM2: npm install -g pm2"
    exit 1
fi

# 检查应用是否在运行
if pm2 status gossip-village &> /dev/null; then
    echo "应用状态: 运行中"
    echo ""
    
    # 显示详细状态信息
    pm2 show gossip-village
    
    echo ""
    echo "=== 系统资源占用 ==="
    # 获取进程ID
    PID=$(pm2 pid gossip-village 2>/dev/null)
    if [ -n "$PID" ]; then
        # 使用ps命令查看CPU和内存占用
        ps -p "$PID" -o pid,%cpu,%mem,etime,command
    else
        echo "无法获取进程ID"
    fi
else
    echo "应用状态: 未运行"
fi

echo ""
echo "=== 访问信息 ==="
# 获取服务器IP地址
SERVER_IP=$(hostname -I | awk '{print $1}')
PORT="3000"
echo "访问地址: http://$SERVER_IP:$PORT"
echo "本地访问: http://localhost:$PORT"

echo ""
echo "=== 命令提示 ==="
echo "启动应用: ./server_scripts/start.sh"
echo "停止应用: ./server_scripts/stop.sh"
echo "重启应用: ./server_scripts/restart.sh"
echo "查看日志: ./server_scripts/logs.sh"

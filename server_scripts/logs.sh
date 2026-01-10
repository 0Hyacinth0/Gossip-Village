#!/bin/bash

# logs.sh - 实时查看应用程序日志

# 设置工作目录
WORK_DIR="/Users/hyacinth/Desktop/gossip-village"
LOG_DIR="$WORK_DIR/logs"
cd "$WORK_DIR"

echo "=== Gossip Village 实时日志查看 ==="
echo "按 Ctrl+C 退出日志查看"
echo ""

# 检查日志目录是否存在
if [ ! -d "$LOG_DIR" ]; then
    echo "警告: 日志目录不存在，正在创建..."
    mkdir -p "$LOG_DIR"
fi

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "错误: PM2 未安装，请先安装 PM2: npm install -g pm2"
    exit 1
fi

# 显示日志文件信息
echo "=== 日志文件信息 ==="
echo "访问日志: $LOG_DIR/out.log"
echo "错误日志: $LOG_DIR/error.log"
echo ""

echo "=== 实时访问日志 (最后50行) ==="
# 实时查看访问日志
tail -n 50 -f "$LOG_DIR/out.log" "$LOG_DIR/error.log"

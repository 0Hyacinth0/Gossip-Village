#!/bin/bash

# start.sh - 一键启动应用程序（安装依赖、构建、后台运行）

# 设置工作目录
# 脚本位于server_scripts目录下，使用../回到项目根目录
WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WORK_DIR"

echo "=== 一键启动 Gossip Village 应用程序 ==="
echo "该脚本将执行：安装依赖 → 构建应用 → 后台运行"
echo ""

# 检查Node.js和npm是否安装
if ! command -v node &> /dev/null; then
    echo "错误: Node.js 未安装，请先安装 Node.js"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "错误: npm 未安装，请先安装 npm"
    exit 1
fi

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "=== 安装 PM2 进程管理器 ==="
    npm install -g pm2
    if [ $? -ne 0 ]; then
        echo "错误: PM2 安装失败，请检查网络连接和权限"
        exit 1
    fi
    echo ""
fi

# 1. 安装依赖
echo "=== 1. 安装应用程序依赖 ==="
npm install
if [ $? -ne 0 ]; then
    echo "错误: 依赖安装失败，请检查网络连接和package.json文件"
    exit 1
fi
echo ""

# 2. 构建应用程序
echo "=== 2. 构建应用程序 ==="
npm run build
if [ $? -ne 0 ]; then
    echo "错误: 应用程序构建失败，请检查代码错误"
    exit 1
fi
echo ""

# 3. 使用PM2启动应用
echo "=== 3. 启动应用程序 ==="
# 检查应用是否已存在
if pm2 status gossip-village &> /dev/null; then
    echo "应用程序已存在，正在重启..."
    pm2 restart gossip-village
else
    echo "首次启动应用程序..."
    pm2 start ecosystem.config.cjs
fi
echo ""

# 4. 设置PM2开机自启
echo "=== 4. 配置PM2开机自启 ==="
pm2 startup
pm2 save
echo ""

# 5. 显示应用程序状态
echo "=== 5. 应用程序状态 ==="
echo "应用名称: gossip-village"
echo "访问地址: http://localhost:8080"
echo ""

# 显示详细状态信息
pm2 status gossip-village

echo ""
echo "=== 启动完成 ==="
echo "应用程序已成功启动并在后台运行"
echo "即使关闭终端或断开服务器连接，应用程序也会继续运行"
echo ""
echo "=== 命令提示 ==="
echo "查看状态: ./server_scripts/status.sh"
echo "查看日志: ./server_scripts/logs.sh"
echo "停止应用: ./server_scripts/stop.sh"
echo "更新重启: ./server_scripts/restart.sh"

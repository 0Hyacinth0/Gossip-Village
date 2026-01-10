#!/bin/bash

# restart.sh - 拉取代码后重新构建并重启应用程序

# 设置工作目录
# 脚本位于server_scripts目录下，使用../回到项目根目录
WORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WORK_DIR"

echo "=== 更新并重启 Gossip Village 应用程序 ==="
echo ""

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "错误: PM2 未安装，请先安装 PM2: npm install -g pm2"
    exit 1
fi

# 检查Git是否安装
if ! command -v git &> /dev/null; then
    echo "错误: Git 未安装，请先安装 Git"
    exit 1
fi

# 1. 拉取最新代码
echo "=== 1. 拉取最新代码 ==="
git pull
if [ $? -ne 0 ]; then
    echo "警告: Git 拉取失败，可能存在本地修改或网络问题"
    echo "继续执行后续步骤..."
fi
echo ""

# 2. 安装/更新依赖
echo "=== 2. 安装/更新依赖 ==="
npm install
if [ $? -ne 0 ]; then
    echo "错误: 依赖安装失败，请检查网络连接和package.json文件"
    exit 1
fi
echo ""

# 3. 构建应用程序
echo "=== 3. 构建应用程序 ==="
npm run build
if [ $? -ne 0 ]; then
    echo "错误: 应用程序构建失败，请检查代码错误"
    exit 1
fi
echo ""

# 4. 确保日志目录存在
echo "=== 4. 确保日志目录存在 ==="
mkdir -p "$WORK_DIR/logs"
echo ""

# 5. 检查serve是否安装
echo "=== 5. 检查serve依赖 ==="
if ! command -v serve &> /dev/null; then
    echo "安装 serve 依赖..."
    npm install -g serve
    if [ $? -ne 0 ]; then
        echo "警告: serve 安装失败，尝试使用 pm2-serve..."
        npm install -g pm2-serve
    fi
    echo ""
fi

# 6. 重启应用程序
echo "=== 6. 重启应用程序 ==="
# 检查应用是否在运行
if pm2 status gossip-village &> /dev/null; then
    echo "重启应用程序..."
    pm2 restart gossip-village
else
    echo "应用程序未运行，正在启动..."
    pm2 start ecosystem.config.cjs
fi

echo ""
echo "=== 重启完成 ==="

echo ""
echo "=== 应用程序状态 ==="
pm2 status gossip-village

echo ""
echo "=== 命令提示 ==="
echo "查看状态: ./server_scripts/status.sh"
echo "查看日志: ./server_scripts/logs.sh"
echo "停止应用: ./server_scripts/stop.sh"
echo "启动应用: ./server_scripts/start.sh"

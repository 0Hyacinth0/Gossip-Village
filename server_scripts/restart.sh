#!/bin/bash
# server_scripts/restart.sh

echo -e "\033[34m[Restart] 重启 Gossip Village 服务...\033[0m"

if pm2 list | grep -q "gossip-village"; then
    pm2 restart gossip-village
    echo -e "\033[32m[Success] 服务已重启。\033[0m"
else
    echo -e "\033[31m[错误] 服务未运行。正在尝试启动...\033[0m"
    "$(dirname "$0")/start.sh"
fi
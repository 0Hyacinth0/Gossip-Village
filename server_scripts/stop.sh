#!/bin/bash
# server_scripts/stop.sh

echo -e "\033[34m[Stop] 停止 Gossip Village...\033[0m"

if pm2 list | grep -q "gossip-village"; then
    pm2 stop gossip-village
    echo -e "\033[32m[Success] 服务已停止。\033[0m"
else
    echo -e "\033[33m服务未运行。\033[0m"
fi
/* ecosystem.config.cjs */
module.exports = {
  apps: [{
    name: 'gossip-village',
    // 使用 npx serve 确保使用项目依赖或全局依赖，避免找不到命令
    // -s dist: 单页应用模式(SPA)指向dist目录
    // -l 3000: 监听3000端口
    // --no-clipboard: 禁止复制地址到剪贴板（服务器环境不需要）
    script: 'npx',
    args: 'serve -s dist -l 3000 --no-clipboard',
    cwd: './', // 当前工作目录
    instances: 1,
    autorestart: true,
    watch: false, // 生产环境通常不开启文件监控，由 deploy 脚本触发重启
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    // 日志配置
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    merge_logs: true,
  }]
};
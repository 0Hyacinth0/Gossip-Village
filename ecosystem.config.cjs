module.exports = {
  apps: [{
    name: 'gossip-village',
    script: 'npm',
    args: 'run preview',
    cwd: '/Users/hyacinth/Desktop/gossip-village',
    interpreter: 'none',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    merge_logs: true,
    max_restarts: 10,
    restart_delay: 3000
  }]
};

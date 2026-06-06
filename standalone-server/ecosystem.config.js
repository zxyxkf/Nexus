module.exports = {
  apps: [{
    name: 'design-server',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '512M',
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/app/logs/pm2-error.log',
    out_file: '/app/logs/pm2-out.log',
    merge_logs: true,
    // 优雅关闭
    kill_timeout: 10000,
    listen_timeout: 15000
  }]
};

module.exports = {
  apps: [
    {
      name: 'x-raider-telegram',
      script: 'telegramBot-cli.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M', // Lower memory limit for VPS
      env: {
        NODE_ENV: 'production',
        NODE_PATH: './node_modules'
      },
      error_file: './logs/telegram-err.log',
      out_file: './logs/telegram-out.log',
      log_file: './logs/telegram-combined.log',
      time: true,
      // Restart the app if it crashes
      restart_delay: 5000,
      min_uptime: '10s',
      max_restarts: 10,
      // Environment variables
      env_production: {
        NODE_ENV: 'production',
        NODE_PATH: './node_modules'
      },
      // Linux-specific settings
      cwd: process.cwd(),
      pid_file: './logs/telegram.pid'
    },
    {
      name: 'x-raider-ai-updater',
      script: 'modelUpdaterProcess.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        NODE_PATH: './node_modules'
      },
      error_file: './logs/ai-updater-err.log',
      out_file: './logs/ai-updater-out.log',
      log_file: './logs/ai-updater-combined.log',
      time: true,
      // Don't set min_uptime for long-running processes
      max_restarts: 5,
      restart_delay: 10000, // 10 seconds delay before restart
      // Linux-specific settings
      cwd: process.cwd(),
      pid_file: './logs/ai-updater.pid'
    }
  ]
};
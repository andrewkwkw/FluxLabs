module.exports = {
  apps: [
    {
      // App name
      name: 'fluxlabs-backend',
      
      // Script path
      script: './backend/server.js',
      
      // Instances
      instances: 1,
      exec_mode: 'fork',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      
      // Memory limit
      max_memory_restart: '500M',
      
      // Logging
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Restart policy
      autorestart: true,
      watch: false,
      
      // Ignore patterns for watch mode
      ignore_watch: ['node_modules', 'logs', 'frontend/dist', 'frontend/node_modules', '.git'],
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'root',
      host: '34.57.139.126',
      ref: 'origin/main',
      repo: 'YOUR_GITHUB_REPO_URL', // Replace with your repo
      path: '/var/www/fluxlabs',
      'post-deploy': 'npm install && npm run build && pm2 restart ecosystem.config.js'
    }
  }
};

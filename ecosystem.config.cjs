const path = require("path");

/** PM2: dev server; site is served under /japanote/ */
module.exports = {
  apps: [
    {
      name: "japanote",
      cwd: __dirname,
      script: path.join(__dirname, "dev-serve.cjs"),
      interpreter: "node",
      autorestart: true,
      min_uptime: 3000,
      max_restarts: 5,
      exp_backoff_restart_delay: 2000,
      watch: false,
      env: {
        NODE_ENV: "development",
        PORT: 8080,
      },
    },
  ],
};

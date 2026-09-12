// PM2 process definition for the backend. Run from inside backend/:
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   (so it survives a server reboot)
module.exports = {
  apps: [
    {
      name: "soliflex-backend",
      script: "dist/server.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      // PM2 does not read backend/.env automatically — dotenv (already a
      // dependency, loaded in src/config/env.ts) picks it up at process start
      // as long as backend/.env exists alongside this file.
    },
  ],
};

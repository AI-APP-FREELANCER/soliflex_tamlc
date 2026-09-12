// PM2 process definition for the backend. Run from inside backend/:
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   (so it survives a server reboot)
//
// The name below MUST stay "soliflex-ticketing-backend" — the production
// server hosts several unrelated apps under PM2 (a transport/logistics app,
// an "accounts" app, etc.), and at least one of them is already named
// "soliflex-backend". Restarting/starting under that name silently manages
// the WRONG process. Always confirm with `pm2 describe <name>` (check the
// "script path" field matches this repo's backend/dist/server.js) before
// assuming a PM2 app name is this one.
module.exports = {
  apps: [
    {
      name: "soliflex-ticketing-backend",
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

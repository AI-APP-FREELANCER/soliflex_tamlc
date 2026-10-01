// PM2 process definition for a persistent Expo Go tunnel, so customers can
// test the mobile app any time without depending on a developer's own
// machine staying online. Run from inside mobile/:
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   (so it survives a server reboot)
//
// This server hosts several unrelated apps under PM2 (see DEPLOY.md at the
// repo root) — "soliflex-mobile-tunnel" is a deliberately unique name, but
// always confirm identity with `pm2 describe <name>` before assuming any
// PM2 entry on this shared server is this one.
//
// The QR code / exp:// URL changes every time this process (re)starts —
// after starting or restarting it, fetch the new URL via the ngrok local
// API (see DEPLOY.md) and regenerate the QR with mobile/scripts/print-qr.mjs.
module.exports = {
  apps: [
    {
      name: "soliflex-mobile-tunnel",
      script: "npm",
      args: "run start:tunnel",
      interpreter: "none",
      cwd: __dirname,
      // CI=1 makes the Expo CLI skip/fail interactive prompts (e.g. "Use a
      // different port?") instead of hanging forever — PM2 has no terminal
      // to answer them. The dev server port itself is pinned in the
      // start:tunnel npm script (see package.json) to avoid clashing with
      // other apps on this shared server.
      env: { CI: "1" },
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
    },
  ],
};

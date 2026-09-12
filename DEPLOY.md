# Deploying (no Docker)

The app runs directly on the server with Node.js, PM2 (backend process manager), and
Nginx (reverse proxy + TLS via Certbot). The database is DigitalOcean's managed
Postgres (`soliflex_ticketing`) — it is never run on this server.

Live at: `tms.soliflexpackaging.com`, checked out on the server at
`/home/tms-app/soliflex_ticket_mgmt_system`.

**⚠️ This server hosts several unrelated apps under the same PM2 daemon** (at least
a transport/logistics app and an "accounts" app, as of 2026-09-12), some with
confusingly similar names. **`soliflex-backend` belongs to a different, unrelated
project (port 5000)** — this app's real PM2 name is **`soliflex-ticketing-backend`**
(port 4000). Before running any `pm2 restart`/`pm2 delete` by name, confirm you have
the right one:

```bash
pm2 describe soliflex-ticketing-backend | grep "script path"
# must show: /home/tms-app/soliflex_ticket_mgmt_system/backend/dist/server.js
```

## One-time server setup

```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (process manager for the backend)
sudo npm install -g pm2

# Nginx + Certbot (reverse proxy + free HTTPS cert)
sudo apt install -y nginx certbot python3-certbot-nginx
```

## Deploy / redeploy

```bash
cd /home/tms-app/soliflex_ticket_mgmt_system
git pull origin main

# --- Backend ---
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy      # applies any new migrations to the DO database
npm run build                  # compiles TypeScript to dist/
pm2 restart soliflex-ticketing-backend --update-env
pm2 save

# --- Frontend ---
cd ../frontend
npm ci
npm run build                  # produces frontend/dist, served directly by Nginx (no PM2 process for it)
```

`backend/.env` must exist (copy from `.env.production.example` at the repo root and
fill in real values — see that file for what's required). The frontend defaults to
calling the API via a relative `/api` path (same origin) when built without a
`VITE_API_BASE_URL` override — correct for this Nginx setup, so **no frontend env
file is needed for a normal deploy**. Only set `frontend/.env.production` with an
explicit `VITE_API_BASE_URL` if the frontend and backend ever end up served from
different domains.

## Nginx site config (already in place)

The live Nginx config lives at `/etc/nginx/sites-enabled/tms.soliflexpackaging.com`
on the server (HTTPS via Certbot, `root` pointed at `frontend/dist`, `/api`,
`/uploads`, `/socket.io` proxied to `127.0.0.1:4000`). `deploy/nginx.tms.soliflexpackaging.com.conf.example`
in this repo is a reference copy of that shape for setting up a *new* server from
scratch — it does not need to be re-applied for a normal deploy.

## First-time PM2 setup (only if this app doesn't already have a PM2 entry)

```bash
cd backend
pm2 start ecosystem.config.js   # registers it as "soliflex-ticketing-backend"
pm2 save
pm2 startup   # follow the printed instructions (runs a sudo command once) — skip if PM2 startup is already configured for other apps on this server
```

## Verify

```bash
curl https://tms.soliflexpackaging.com/api/health         # should return {"ok":true}
pm2 logs soliflex-ticketing-backend                        # tail backend logs
curl -i -X POST http://127.0.0.1:4000/api/auth/register -H "Content-Type: application/json" -d '{}'
# should return 400 (validation error), never 404 — a 404 here means the
# running process is stale or you restarted the wrong PM2 app by name
```

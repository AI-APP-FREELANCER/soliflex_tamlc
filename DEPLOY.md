# Deploying (no Docker)

The app runs directly on the server with Node.js, PM2 (backend process manager), and
Nginx (reverse proxy + TLS via Certbot). The database is DigitalOcean's managed
Postgres (`soliflex_ticketing`) — it is never run on this server.

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

Run from wherever you keep the repo on the server (substitute your actual path below):

```bash
cd /path/to/soliflex_tamlc
git pull origin main

# --- Backend ---
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy      # applies any new migrations to the DO database
npm run build                  # compiles TypeScript to dist/
pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js
pm2 save

# --- Frontend ---
cd ../frontend
npm ci
npm run build                  # produces frontend/dist, served by Nginx
```

`backend/.env` must exist (copy from `.env.production.example` at the repo root and
fill in real values — see that file for what's required). The frontend defaults to
calling the API via a relative `/api` path (same origin) when built without a
`VITE_API_BASE_URL` override — correct for this Nginx setup, so **no frontend env
file is needed for a normal deploy**. Only set `frontend/.env.production` with an
explicit `VITE_API_BASE_URL` if the frontend and backend ever end up served from
different domains.

## First-time Nginx + TLS setup

```bash
sudo cp deploy/nginx.tms.soliflexpackaging.com.conf.example /etc/nginx/sites-available/tms.soliflexpackaging.com
# edit the REPLACE_WITH_ABSOLUTE_PATH line to point at your repo's frontend/dist
sudo ln -s /etc/nginx/sites-available/tms.soliflexpackaging.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tms.soliflexpackaging.com   # sets up HTTPS + auto-renewal
```

## First-time PM2 setup (so it survives a reboot)

```bash
pm2 start backend/ecosystem.config.js
pm2 save
pm2 startup   # follow the printed instructions (runs a sudo command once)
```

## Verify

```bash
curl https://tms.soliflexpackaging.com/api/health   # should return {"ok":true}
pm2 logs soliflex-backend                            # tail backend logs
```

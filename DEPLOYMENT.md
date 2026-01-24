# FluxLabs Deployment Guide

## Project Structure

```
fluxlabs/
├── frontend/        - React UI (Vite + TypeScript)
├── backend/         - Express.js API + SQLite
├── package.json     - Root package.json untuk orchestrate
└── README.md
```

## Perubahan Struktur

✅ **Frontend** di folder `frontend/`:
- `index.html`, `index.tsx`, `App.tsx`
- `components/`, `services/`, `controllers/`
- `config.ts`, `types.ts`
- `package.json`, `vite.config.ts`, `tsconfig.json`
- Output build: `frontend/dist/`

✅ **Backend** di folder `backend/`:
- `server.js` - Express server utama
- `schema.sql` - Database schema
- `package.json` - Dependencies
- Database: `backend/fluxlabs.db`
- Serve static: `../frontend/dist`

---

## Deployment Steps untuk VPS

### 1. Di Local Machine (Development)

```bash
# Install all dependencies
npm run install:all

# Build frontend
npm run build

# Test locally
npm start
# Akses http://localhost:3001
```

### 2. Push ke GitHub

```bash
git add .
git commit -m "Restructure: separate frontend & backend folders"
git push origin main
```

### 3. Di VPS

```bash
# Clone/pull repo
cd ~/FluxLabs
git pull origin main

# Install all dependencies
npm run install:all

# Build frontend (generate dist/)
npm run build

# Start dengan PM2
pm2 start backend/server.js --name fluxlabs

# Save PM2 config
pm2 save
pm2 startup
```

### 4. Akses aplikasi

Buka browser: **http://34.57.139.126:3001**

---

## Environment Variables

Buat `.env` di root folder atau di `backend/` folder:

```
GEMINI_API_KEY=your_api_key_here
VITE_API_URL=http://34.57.139.126:3001
```

---

## PM2 Commands di VPS

```bash
# Check status
pm2 status

# View logs
pm2 logs fluxlabs

# Restart
pm2 restart fluxlabs

# Stop
pm2 stop fluxlabs

# Delete
pm2 delete fluxlabs
```

---

## Cara Kerja Production

1. **Frontend Build** (`npm run build`):
   - React components di-compile ke static files
   - Output: `frontend/dist/`
   - Vite auto-optimize & minimize

2. **Backend Serve** (`node backend/server.js`):
   - Express server di port 3001
   - `app.use(express.static(distPath))` → serve `frontend/dist/`
   - SPA fallback untuk non-API routes ke `index.html`
   - Database SQLite di `backend/fluxlabs.db`

3. **API Routes**:
   - `/api/*` → Backend endpoints
   - Frontend auto-use `VITE_API_URL` sebagai base

---

## Troubleshooting

### 1. "Cannot GET /" - Blank page
- ✓ Check `npm run build` sudah dijalankan
- ✓ Check `frontend/dist/` exist
- ✓ Check logs: `pm2 logs fluxlabs`

### 2. API calls 404
- ✓ Pastikan `VITE_API_URL` benar di environment
- ✓ Frontend harus re-build jika ubah env variable
- ✓ Check CORS enabled di backend

### 3. Database issues
- ✓ Check `backend/fluxlabs.db` exist
- ✓ Check `backend/schema.sql` applied

---

## Deploy Script (One-liner untuk VPS)

```bash
cd ~/FluxLabs && git pull && npm run install:all && npm run build && pm2 restart fluxlabs
```

Atau gunakan PM2 dengan env variables:

# WebRTC child monitor (demo)

**Child** page shares camera and microphone; **parent** page views over WebRTC. Signaling (SDP + ICE) goes over **WebSocket** at `/ws` on the same host. Media is peer-to-peer when the network allows.

**Stack:** Vite builds the static UI into [`backend/public`](backend/public); [**NestJS**](backend) serves those files, mounts `/ws`, and exposes `GET /health` for uptime checks (e.g. Render).

## Legal use

Use only where you have the right to record or observe (e.g. consent, your device, applicable law). This repo is a technical demo only.

## Local development

1. From the repo root: `npm install`
2. Install backend deps: `cd backend && npm install && cd ..`
3. Run API + Vite together: `npm run dev`
   - Nest (signaling + API): [http://localhost:3000](http://localhost:3000)
   - Vite dev server: [http://localhost:5173](http://localhost:5173) — proxies `/ws` to port **3000**
4. Open either stack’s URLs:
   - **Via Vite:** [http://localhost:5173/child.html](http://localhost:5173/child.html) and [http://localhost:5173/parent.html](http://localhost:5173/parent.html)
   - **Via Nest (after `npm run build:web`):** [http://localhost:3000/child.html](http://localhost:3000/child.html) and [http://localhost:3000/parent.html](http://localhost:3000/parent.html)
5. Same **room ID** on both; **Connect** on parent, **Start sharing** on child.

## Host on Render (recommended)

Prerequisites: GitHub (or GitLab/Bitbucket) repo with this project pushed, and both **`package-lock.json`** files committed (root and **`backend/package-lock.json`**).

### Option A — Blueprint ([`render.yaml`](render.yaml))

1. In [Render](https://dashboard.render.com), click **New** → **Blueprint**.
2. Connect your Git provider and select the repository.
3. Render reads `render.yaml` and creates a **Web Service** (free tier).
4. Click **Apply** and wait for the first deploy.

### Option B — Manual Web Service

1. **New** → **Web Service** → connect the repo.
2. Settings:
   - **Runtime:** Node
   - **Build command:** `npm ci && npm run build:web && cd backend && npm ci && npm run build`
   - **Start command:** `cd backend && npm run start:prod`
   - **Health check path:** `/health`
3. Add **Environment** → **Node version** `20` (or set `NODE_VERSION=20`).
4. Deploy.

### After deploy

- Open **`https://<your-service>.onrender.com/parent.html`** and **`.../child.html`** (same hostname so **`wss://.../ws`** works).
- **Free** instances **spin down** after ~15 minutes idle; the first request can take **30–60+ seconds** to wake.
- For **TURN**, add `VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` in Render under **Environment** (available at **build** time so Vite can embed them), then **Clear build cache & deploy**.

### Local production check

```bash
npm run build && npm start
```

Then open [http://localhost:3000/parent.html](http://localhost:3000/parent.html) (Render sets `PORT` automatically in production).

## Mobile (Capacitor — child app)

- Build web assets and sync native projects: `npm run build:mobile:sync`
- MDM, signing, and `VITE_SERVER_URL` / managed `serverUrl`: see [ADMIN_MOBILE.md](ADMIN_MOBILE.md)

## STUN and TURN

- **STUN** is enabled in [`src/webrtc-helpers.js`](src/webrtc-helpers.js).
- **TURN:** set `VITE_TURN_*` in `.env` (see [`.env.example`](.env.example)), then rebuild the web assets (`npm run build:web` or full `npm run build`).

## Environment

| Variable       | Where        | Purpose                    |
|----------------|--------------|----------------------------|
| `PORT`         | Nest (backend) | HTTP + WebSocket port  |
| `VITE_TURN_*`  | Vite build   | Optional TURN ICE servers  |
| `VITE_SERVER_URL` | Vite build (mobile) | HTTPS origin of Nest app for Capacitor WebSocket (`wss://…/ws`); optional if MDM sets `serverUrl` at runtime |

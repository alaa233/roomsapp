# WebRTC child monitor (demo)

Vanilla Vite app with two pages: **child** shares camera and microphone; **parent** views the stream over WebRTC. A small Node **WebSocket** server relays signaling only (SDP + ICE); media is peer-to-peer when the network allows.

## Legal use

Use only where you have the right to record or observe (e.g. consent, your device, applicable law). This repo is a technical demo only.

## Local development

1. Install dependencies: `npm install`
2. Run signaling and Vite together: `npm run dev:all`
3. Open:
   - Child: [http://localhost:5173/child.html](http://localhost:5173/child.html)
   - Parent: [http://localhost:5173/parent.html](http://localhost:5173/parent.html)
4. Enter the **same room ID** on both, then **Connect** on the parent and **Start sharing** on the child (any order works once both are in the room).

Alternatively, run `npm run signal` in one terminal and `npm run dev` in another.

## STUN and TURN

- **STUN** is enabled by default (`stun:stun.l.google.com:19302`) in [`src/webrtc-helpers.js`](src/webrtc-helpers.js). This is enough for many LAN and home-network cases.
- **TURN** is optional. If video/audio fails across strict NATs or different networks, add a TURN provider (e.g. Twilio, Metered, or self-hosted coturn) and copy [`.env.example`](.env.example) to `.env`, then set:
  - `VITE_TURN_URLS` — comma-separated `turn:` or `turns:` URLs
  - `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` — if your server requires them

Restart `npm run dev` after changing `VITE_*` variables so Vite picks them up.

## Production notes

- Serve the built app (`npm run build` → `dist/`) over **HTTPS**; browsers require a secure context for `getUserMedia` except on `localhost`.
- Run the signaling server with **WSS** behind the same host or another TLS endpoint, and point the client at that URL (today the client uses `wsUrl()` → `/ws`; configure your reverse proxy to upgrade WebSocket to the Node server on `SIGNAL_PORT`, default **8080**).
- Do not expose unauthenticated room IDs on the public internet; add auth and short-lived tokens for real deployments.

## Environment

| Variable        | Where        | Purpose                          |
|----------------|--------------|----------------------------------|
| `SIGNAL_PORT`  | Node server  | Signaling listen port (default 8080) |
| `VITE_TURN_*`  | Vite / build | Optional TURN ICE servers        |

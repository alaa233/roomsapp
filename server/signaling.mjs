import { WebSocketServer } from 'ws';

const PORT = Number(process.env.SIGNAL_PORT || 8080);

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const rooms = new Map();

function roomPeers(roomId) {
  return rooms.get(roomId);
}

function addToRoom(roomId, ws) {
  let set = rooms.get(roomId);
  if (!set) {
    set = new Set();
    rooms.set(roomId, set);
  }
  set.add(ws);
  ws.__roomId = roomId;
}

function removeFromRoom(ws) {
  const roomId = ws.__roomId;
  if (!roomId) return;
  const set = rooms.get(roomId);
  if (!set) return;
  set.delete(ws);
  delete ws.__roomId;
  if (set.size === 0) rooms.delete(roomId);
  else {
    const msg = JSON.stringify({ type: 'peer-left' });
    for (const peer of set) {
      if (peer.readyState === 1) peer.send(msg);
    }
  }
}

function broadcastToRoom(roomId, sender, rawMessage) {
  const set = rooms.get(roomId);
  if (!set) return;
  for (const peer of set) {
    if (peer !== sender && peer.readyState === 1) peer.send(rawMessage);
  }
}

function maybeNotifyPeerJoined(roomId) {
  const set = rooms.get(roomId);
  if (!set || set.size !== 2) return;
  const msg = JSON.stringify({ type: 'peer-joined' });
  for (const peer of set) {
    if (peer.readyState === 1) peer.send(msg);
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'join') {
      const roomId = typeof msg.roomId === 'string' ? msg.roomId.trim() : '';
      if (!roomId || roomId.length > 128) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid room ID' }));
        return;
      }
      removeFromRoom(ws);
      addToRoom(roomId, ws);
      maybeNotifyPeerJoined(roomId);
      return;
    }

    const roomId = ws.__roomId;
    if (!roomId) return;

    if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'ice') {
      broadcastToRoom(roomId, ws, JSON.stringify(msg));
    }
  });

  ws.on('close', () => removeFromRoom(ws));
});

console.log(`Signaling WebSocket listening on ws://127.0.0.1:${PORT}`);

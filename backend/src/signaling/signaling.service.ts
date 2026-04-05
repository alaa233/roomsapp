import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocket, WebSocketServer } from 'ws';

type ExtWebSocket = WebSocket & { __roomId?: string };

@Injectable()
export class SignalingService implements OnModuleInit {
  private readonly logger = new Logger(SignalingService.name);
  private readonly rooms = new Map<string, Set<ExtWebSocket>>();

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  onModuleInit() {
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();
    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
    wss.on('connection', (socket: ExtWebSocket) => {
      socket.on('message', (raw: Buffer) => {
        this.onMessage(socket, raw);
      });
      socket.on('close', () => this.removeFromRoom(socket));
    });
    this.logger.log('Signaling WebSocket mounted at /ws');
  }

  private addToRoom(roomId: string, ws: ExtWebSocket) {
    let set = this.rooms.get(roomId);
    if (!set) {
      set = new Set();
      this.rooms.set(roomId, set);
    }
    set.add(ws);
    ws.__roomId = roomId;
  }

  private removeFromRoom(ws: ExtWebSocket) {
    const roomId = ws.__roomId;
    if (!roomId) return;
    const set = this.rooms.get(roomId);
    if (!set) return;
    set.delete(ws);
    delete ws.__roomId;
    if (set.size === 0) {
      this.rooms.delete(roomId);
    } else {
      const msg = JSON.stringify({ type: 'peer-left' });
      for (const peer of set) {
        if (peer.readyState === WebSocket.OPEN) peer.send(msg);
      }
    }
  }

  private broadcastToRoom(
    roomId: string,
    sender: ExtWebSocket,
    rawMessage: string,
  ) {
    const set = this.rooms.get(roomId);
    if (!set) return;
    for (const peer of set) {
      if (peer !== sender && peer.readyState === WebSocket.OPEN) {
        peer.send(rawMessage);
      }
    }
  }

  private maybeNotifyPeerJoined(roomId: string) {
    const set = this.rooms.get(roomId);
    if (!set || set.size !== 2) return;
    const msg = JSON.stringify({ type: 'peer-joined' });
    for (const peer of set) {
      if (peer.readyState === WebSocket.OPEN) peer.send(msg);
    }
  }

  private onMessage(ws: ExtWebSocket, raw: Buffer) {
    let msg: { type?: string; roomId?: string };
    try {
      msg = JSON.parse(String(raw)) as { type?: string; roomId?: string };
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'join') {
      const roomId =
        typeof msg.roomId === 'string' ? msg.roomId.trim() : '';
      if (!roomId || roomId.length > 128) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: 'Invalid room ID',
          }),
        );
        return;
      }
      this.removeFromRoom(ws);
      this.addToRoom(roomId, ws);
      this.maybeNotifyPeerJoined(roomId);
      return;
    }

    const roomId = ws.__roomId;
    if (!roomId) return;

    if (
      msg.type === 'offer' ||
      msg.type === 'answer' ||
      msg.type === 'ice' ||
      msg.type === 'child-audio' ||
      msg.type === 'child-video'
    ) {
      this.broadcastToRoom(roomId, ws, JSON.stringify(msg));
    }
  }
}

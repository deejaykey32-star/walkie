import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

interface ClientInfo {
  ws: WebSocket;
  channel: string;
  peerId: string;
  name: string;
  joinedAt: number;
}

const clients = new Map<WebSocket, ClientInfo>();

async function main() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Basic API endpoints
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeConnections: clients.size,
      time: new Date().toISOString(),
    });
  });

  // WebSocket signaling & relay
  wss.on('connection', (ws: WebSocket) => {
    let isAlive = true;

    ws.on('pong', () => {
      isAlive = true;
    });

    ws.on('message', (rawData) => {
      try {
        const message = JSON.parse(rawData.toString());
        const { type } = message;

        switch (type) {
          case 'join': {
            const { channel = 'CH-1', peerId, name = 'Android-1' } = message;
            clients.set(ws, {
              ws,
              channel: channel.toUpperCase().trim(),
              peerId,
              name,
              joinedAt: Date.now(),
            });

            // Gather peers in same channel
            const channelPeers: Array<{ peerId: string; name: string }> = [];
            clients.forEach((info, otherWs) => {
              if (info.channel === channel.toUpperCase().trim() && otherWs !== ws) {
                channelPeers.push({ peerId: info.peerId, name: info.name });
                // Notify existing peer about newcomer
                if (otherWs.readyState === WebSocket.OPEN) {
                  otherWs.send(
                    JSON.stringify({
                      type: 'peer-joined',
                      peerId,
                      name,
                    })
                  );
                }
              }
            });

            // Send back confirmation with existing peers
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'joined-success',
                  channel: channel.toUpperCase().trim(),
                  peerId,
                  peers: channelPeers,
                })
              );
            }
            break;
          }

          case 'signal': {
            // Forward WebRTC signaling (offer, answer, ice-candidate) to target peer
            const { targetId, senderId, data } = message;
            clients.forEach((info, otherWs) => {
              if (info.peerId === targetId && otherWs.readyState === WebSocket.OPEN) {
                otherWs.send(
                  JSON.stringify({
                    type: 'signal',
                    senderId,
                    data,
                  })
                );
              }
            });
            break;
          }

          case 'ptt-start':
          case 'ptt-end': {
            // Broadcast PTT radio status to peers in the same channel
            const sender = clients.get(ws);
            if (!sender) return;

            clients.forEach((info, otherWs) => {
              if (info.channel === sender.channel && otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
                otherWs.send(
                  JSON.stringify({
                    type,
                    peerId: sender.peerId,
                    name: sender.name,
                  })
                );
              }
            });
            break;
          }

          case 'audio-relay': {
            // Audio chunk fallback relay if WebRTC direct P2P is blocked by carrier symmetric NAT
            const sender = clients.get(ws);
            if (!sender) return;

            const { audioData } = message;
            clients.forEach((info, otherWs) => {
              if (info.channel === sender.channel && otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
                otherWs.send(
                  JSON.stringify({
                    type: 'audio-relay',
                    peerId: sender.peerId,
                    audioData,
                  })
                );
              }
            });
            break;
          }

          case 'leave': {
            handleLeave(ws);
            break;
          }

          case 'ping': {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    });

    ws.on('close', () => {
      handleLeave(ws);
    });

    ws.on('error', (err) => {
      console.error('WS client error:', err);
      handleLeave(ws);
    });
  });

  function handleLeave(ws: WebSocket) {
    const info = clients.get(ws);
    if (!info) return;

    clients.delete(ws);

    // Notify peers in the same channel
    clients.forEach((otherInfo, otherWs) => {
      if (otherInfo.channel === info.channel && otherWs.readyState === WebSocket.OPEN) {
        otherWs.send(
          JSON.stringify({
            type: 'peer-left',
            peerId: info.peerId,
            name: info.name,
          })
        );
      }
    });
  }

  // Periodic heartbeat every 20 seconds to prevent mobile sleep/NAT timeout
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 20000);

  // Vite middleware in dev or static server in prod
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Walkie-Talkie] Server listening on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

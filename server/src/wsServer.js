import { WebSocketServer } from 'ws';

/**
 * Thin real-time broadcast layer. Every connected client (React, Android, iOS - anything
 * that can open a plain WebSocket) gets:
 *   1. one "snapshot" message right after connecting, with every vehicle we currently know about
 *   2. an "update" message every poll cycle with only the vehicles that actually moved/changed
 *
 * Message shape (JSON, one object per line):
 *   { "type": "snapshot", "vehicles": [ ...vehicle ] }
 *   { "type": "update",   "vehicles": [ ...vehicle ] }
 * where each vehicle is the cleaned-up shape produced in poller.js.
 */
export function createWsServer(httpServer, getSnapshot) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.send(JSON.stringify({ type: 'snapshot', vehicles: getSnapshot() }));
  });

  // Basic heartbeat so dead connections (phone put to sleep, wifi drop, ...) get cleaned up.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  wss.on('close', () => clearInterval(heartbeat));

  function broadcastUpdate(changedVehicles) {
    if (changedVehicles.length === 0) return;
    const message = JSON.stringify({ type: 'update', vehicles: changedVehicles });
    for (const ws of wss.clients) {
      if (ws.readyState === ws.OPEN) ws.send(message);
    }
  }

  return { wss, broadcastUpdate };
}

import http from 'node:http';
import { config } from './config.js';
import { startPolling, getSnapshot } from './poller.js';
import { createWsServer } from './wsServer.js';
import { closeHistoryStore } from './historyStore.js';
import { handleRailSchedule } from './yandexRasp.js';
import { handleGeocode } from './geocoder.js';
import { handleTraffic } from './yandexTraffic.js';

let lastPollAt = null;
let lastPollError = null;

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      vehiclesTracked: getSnapshot().length,
      lastPollAt,
      lastPollError,
    }));
    return;
  }
  // A plain REST snapshot is handy for quick debugging / a client that hasn't wired up
  // WebSocket yet - the live stream itself is WS-only per the ws server above.
  if (url.pathname === '/vehicles') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getSnapshot()));
    return;
  }
  if ((url.pathname === '/geocode' || url.pathname === '/geocode/reverse') && req.method === 'GET') {
    handleGeocode(req, res, url);
    return;
  }
  if (url.pathname === '/traffic' && req.method === 'GET') {
    await handleTraffic(req, res);
    return;
  }
  if (url.pathname === '/rail/schedule' && req.method === 'GET') {
    await handleRailSchedule(req, res, url);
    return;
  }
  res.writeHead(404).end();
});

const { broadcastUpdate } = createWsServer(httpServer, getSnapshot);

const stopPolling = startPolling(config.pollIntervalMs, {
  onUpdate: (changed) => {
    lastPollAt = new Date().toISOString();
    lastPollError = null;
    broadcastUpdate(changed);
  },
  onError: (err) => {
    lastPollAt = new Date().toISOString();
    lastPollError = String(err.message || err);
    console.error('[poller]', lastPollError);
  },
});

httpServer.listen(config.port, () => {
  console.log(`Proxy listening on http://localhost:${config.port} (WS on the same port)`);
  console.log(`Polling ${config.upstream.url} every ${config.pollIntervalMs}ms`);
});

async function shutdown() {
  console.log('Shutting down...');
  stopPolling();
  await closeHistoryStore();
  httpServer.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

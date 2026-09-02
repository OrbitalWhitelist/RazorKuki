import { createServer } from 'node:http';
import { startBot } from './bot/index';
import { logger } from './lib/logger';

const rawPort = process.env['PORT'];
const port = rawPort ? Number(rawPort) : 0;

if (rawPort && (!Number.isInteger(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (port > 0) {
  const healthServer = createServer((req, res) => {
    if (req.url === '/api/healthz' || req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  healthServer.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Replit liveness listener started');
  });
}

startBot().catch((err) => {
  logger.error({ err }, 'Fatal: bot failed to start');
  process.exit(1);
});

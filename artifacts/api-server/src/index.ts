import { startBot } from './bot/index';
import { logger } from './lib/logger';

startBot().catch((err) => {
  logger.error({ err }, 'Fatal: bot failed to start');
  process.exit(1);
});

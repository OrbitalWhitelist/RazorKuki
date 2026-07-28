import { Client, TextChannel } from 'discord.js';
import { logger } from './logger';

let heartbeatInterval: NodeJS.Timeout | null = null;

export function startHeartbeat(client: Client, channelId: string, intervalHours: number) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(async () => {
    try {
      const channel = client.channels.cache.get(channelId) as TextChannel;
      if (channel) {
        await channel.send('🟢 Razor Tools heartbeat – bot is alive and running.');
      } else {
        logger.warn('Heartbeat channel not found');
      }
    } catch (err) {
      logger.error({ err }, 'Heartbeat failed');
    }
  }, intervalHours * 3600 * 1000);
}
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './env.js';
import { connectDB, disconnectDB } from './lib/db.js';
import { logger } from './lib/logger.js';
import { connectRedis, redis } from './lib/redis.js';
import { attachCollab } from './realtime/collab.js';

async function main() {
  await connectDB(env.MONGO_URI);
  await connectRedis();

  const server = createServer(createApp());
  const collabServer = attachCollab(server);
  server.listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT}`));

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    // Save unsaved edits before closing anything they depend on.
    void collabServer.close();
    server.close(async () => {
      await Promise.allSettled([disconnectDB(), redis?.quit()]);
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

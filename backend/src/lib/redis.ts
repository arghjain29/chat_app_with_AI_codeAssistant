import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../env.js';
import { logger } from './logger.js';

const baseOptions = { maxRetriesPerRequest: 2, lazyConnect: true } satisfies RedisOptions;

function createClient(): Redis | null {
  if (env.REDIS_URL) return new Redis(env.REDIS_URL, baseOptions);
  if (env.REDIS_HOST) {
    return new Redis({
      ...baseOptions,
      host: env.REDIS_HOST,
      port: env.REDIS_PORT ?? 6379,
      username: env.REDIS_USERNAME,
      password: env.REDIS_PASSWORD,
      tls: env.REDIS_TLS ? {} : undefined,
    });
  }
  return null;
}

/**
 * Redis is optional. When it isn't configured or the server is unreachable,
 * callers get `null` and must fall back to in-memory behaviour.
 */
export const redis = createClient();

redis?.on('error', (err) => logger.warn({ err: err.message }, 'Redis error'));

export async function connectRedis(): Promise<void> {
  if (!redis) {
    logger.info('Redis not configured, running without it');
    return;
  }
  try {
    await redis.connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn({ err }, 'Redis unavailable, continuing without it');
  }
}

export const isRedisReady = () => redis === null || redis.status === 'ready';

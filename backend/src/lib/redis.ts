import { Redis } from 'ioredis';
import { env } from '../env.js';
import { logger } from './logger.js';

/**
 * Redis is optional. When REDIS_URL is unset or the server is unreachable,
 * callers get `null` and must fall back to in-memory behaviour.
 */
export const redis: Redis | null = env.REDIS_URL
  ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true })
  : null;

redis?.on('error', (err) => logger.warn({ err: err.message }, 'Redis error'));

export async function connectRedis(): Promise<void> {
  if (!redis) {
    logger.info('REDIS_URL not set, running without Redis');
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

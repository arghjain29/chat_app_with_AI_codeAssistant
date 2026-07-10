import Redis from 'ioredis';
import logger from '../utils/logger.js';

let redisClient;
let redisAvailable = false;

try {
    redisClient = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 10) {
                logger.warn('Redis: max retries reached, giving up');
                return null;
            }
            const delay = Math.min(times * 100, 3000);
            return delay;
        },
        enableOfflineQueue: false,
    });

    redisClient.on('connect', () => {
        redisAvailable = true;
        logger.info('Redis connected');
    });

    redisClient.on('error', (err) => {
        redisAvailable = false;
        logger.error({ err }, 'Redis connection error');
    });

    redisClient.on('reconnecting', () => {
        logger.info('Redis reconnecting');
    });

    redisClient.on('close', () => {
        redisAvailable = false;
    });
} catch (err) {
    logger.error({ err }, 'Redis client creation failed');
    redisClient = null;
}

export const isRedisAvailable = () => redisAvailable && redisClient && redisClient.status === 'ready';

export const safeRedisGet = async (key) => {
    try {
        if (!isRedisAvailable()) return null;
        return await redisClient.get(key);
    } catch (err) {
        logger.warn({ err }, 'Redis GET failed');
        return null;
    }
};

export const safeRedisSet = async (key, value, ...args) => {
    try {
        if (!isRedisAvailable()) return false;
        await redisClient.set(key, value, ...args);
        return true;
    } catch (err) {
        logger.warn({ err }, 'Redis SET failed');
        return false;
    }
};

export default redisClient;

import Redis from 'ioredis';
import logger from '../utils/logger.js';

const redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

redisClient.on('connect', () => {
    logger.info('Redis connected');
});

redisClient.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
});

redisClient.on('reconnecting', () => {
    logger.info('Redis reconnecting');
});

export default redisClient;

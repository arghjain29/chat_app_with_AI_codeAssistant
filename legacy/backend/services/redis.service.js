import Redis from 'ioredis';

let redisClient;
let redisAvailable = false;

try {
    redisClient = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 10) return null;
            return Math.min(times * 100, 3000);
        },
        enableOfflineQueue: false,
    });

    redisClient.on('connect', () => {
        redisAvailable = true;
        console.log('Redis connected');
    });

    redisClient.on('error', () => {
        redisAvailable = false;
    });

    redisClient.on('close', () => {
        redisAvailable = false;
    });
} catch {
    redisClient = null;
}

export const isRedisAvailable = () => redisAvailable && redisClient && redisClient.status === 'ready';

export const safeRedisGet = async (key) => {
    try {
        if (!isRedisAvailable()) return null;
        return await redisClient.get(key);
    } catch {
        return null;
    }
};

export const safeRedisSet = async (key, value, ...args) => {
    try {
        if (!isRedisAvailable()) return false;
        await redisClient.set(key, value, ...args);
        return true;
    } catch {
        return false;
    }
};

export default redisClient;

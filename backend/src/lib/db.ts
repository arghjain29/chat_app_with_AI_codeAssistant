import mongoose from 'mongoose';
import { logger } from './logger.js';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5_000;

export async function connectDB(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(uri);
      logger.info('MongoDB connected');
      return;
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      logger.warn({ err, attempt }, `MongoDB connection failed, retrying in ${RETRY_DELAY_MS}ms`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

export const isDbReady = () => mongoose.connection.readyState === 1;

export const disconnectDB = () => mongoose.disconnect();

import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './env.js';
import { authMiddleware } from './lib/clerk.js';
import { isDbReady } from './lib/db.js';
import { logger } from './lib/logger.js';
import { isRedisReady } from './lib/redis.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { userRouter } from './modules/users/user.routes.js';
import { clerkWebhookRouter } from './modules/webhooks/clerk.routes.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1); // Behind Render/Vercel proxies: use X-Forwarded-For for rate limits.
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      exposedHeaders: ['x-request-id', 'ratelimit-remaining', 'ratelimit-reset'],
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/ready', (_req, res) => {
    const checks = { mongo: isDbReady(), redis: isRedisReady() };
    const ready = Object.values(checks).every(Boolean);
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
  });

  // Webhooks verify signatures against the raw body, so mount them before JSON parsing.
  app.use('/webhooks/clerk', clerkWebhookRouter);

  app.use(express.json({ limit: '1mb' }));

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down', requestId: String(req.id) },
      });
    },
  });

  const api = express.Router();
  api.use(apiLimiter);
  api.use(authMiddleware());
  api.use('/users', userRouter);
  app.use('/api/v1', api);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

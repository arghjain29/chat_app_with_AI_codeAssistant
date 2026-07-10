import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import pinoHttp from 'pino-http';
import connectDB from './database/db.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import aiRoutes from './routes/ai.routes.js';
import requestId from './middleware/requestId.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

import cookieParser from 'cookie-parser';
connectDB();

const app = express();

const httpLogger = pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 400 || err) return 'error';
        return 'info';
    },
});

app.use(helmet());
app.use(mongoSanitize());
app.use(requestId);
app.use(httpLogger);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { message: 'Too many AI requests, please slow down' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/', (req, res) => {
    res.send('Hello World');
});

app.use('/api/users', authLimiter, userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);

app.use(errorHandler);

export default app;

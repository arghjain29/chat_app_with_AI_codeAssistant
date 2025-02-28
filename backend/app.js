import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './database/db.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import aiRoutes from './routes/ai.routes.js';
import dotenv from 'dotenv';
dotenv.config();

import cookieParser from 'cookie-parser';
connectDB();

const app = express();
app.use(morgan('dev'));


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
});

app.get('/', (req, res) => {
    res.send('Hello World');
});


app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ai', aiRoutes);

export default app;


import {createServer} from 'http';
import app from './app.js';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
dotenv.config();
import { socketMiddleware } from './middleware/auth.middleware.js';
import * as ai from './services/ai.service.js';
import logger from './utils/logger.js';

const port = process.env.PORT || 3000;

const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL,
    },
});


io.use(socketMiddleware);

io.on('connection', socket => {
    logger.info({ socketId: socket.id, projectId: socket.projectRoomId, userId: socket.user?._id }, 'Socket connected');
    socket.join(socket.projectRoomId);

    socket.on('project-message', async (data) => {
        const aiIsPresent = data.message.includes('@ai');
        if (aiIsPresent) {
            socket.broadcast.to(socket.projectRoomId).emit('project-message', data);
            try {
                const prompt = data.message.replace('@ai', '');
                const result = await ai.generateResult(prompt);
                data.message = result;
                data.sender = 'CodeAI';
                io.to(socket.projectRoomId).emit('project-message', data);
            } catch (error) {
                logger.error({ err: error, projectId: socket.projectRoomId }, 'AI generation failed');
                socket.emit('project-message', {
                    message: 'AI request failed. Please try again.',
                    sender: 'System',
                });
            }
        } else {
            socket.broadcast.to(socket.projectRoomId).emit('project-message', data);
        }
    });

    socket.on('disconnect', () => {
        logger.info({ socketId: socket.id, projectId: socket.projectRoomId }, 'Socket disconnected');
        socket.leave(socket.projectRoomId);
    });
});


const gracefulShutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(port, () => {
    logger.info(`Server running on port ${port}`);
});

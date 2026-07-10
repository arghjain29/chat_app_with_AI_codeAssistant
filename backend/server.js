import {createServer} from 'http';
import app from './app.js';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
dotenv.config();
import { socketMiddleware } from './middleware/auth.middleware.js';
import * as ai from './services/ai.service.js';

const port = process.env.PORT || 3000;

const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL,
    },
});


io.use(socketMiddleware);

io.on('connection', socket => {
    console.log(`Socket connected: ${socket.id}`);
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
                console.error('AI generation failed:', error.message);
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
        console.log(`Socket disconnected: ${socket.id}`);
        socket.leave(socket.projectRoomId);
    });
});



const gracefulShutdown = (signal) => {
    console.log(`${signal} received. Shutting down...`);
    server.close(() => {
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

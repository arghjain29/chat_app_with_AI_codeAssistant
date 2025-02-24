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
        origin: '*',
    },
});


io.use(socketMiddleware);

io.on('connection', socket => {
    console.log('a user connected');
    console.log(socket.projectRoomId);
    socket.join(socket.projectRoomId);

    socket.on('project-message', async (data) => {

        const aiIsPresent = data.message.includes('@ai');
        if (aiIsPresent) {
            socket.broadcast.to(socket.projectRoomId).emit('project-message', data);
            const prompt = data.message.replace('@ai', '');
            const result = await ai.generateResult(prompt);
            data.message = result;
            data.sender = 'CodeAI';
            io.to(socket.projectRoomId).emit('project-message', data);
        } else {
        socket.broadcast.to(socket.projectRoomId).emit('project-message', data);
        }
    })

    socket.on('disconnect', () => {
        console.log('user disconnected');
        socket.leave(socket.projectRoomId);
    });
});



server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
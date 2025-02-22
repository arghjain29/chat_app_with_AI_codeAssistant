import {createServer} from 'http';
import app from './app.js';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
dotenv.config();
import { socketMiddleware } from './middleware/auth.middleware.js';

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

    socket.on('project-message', data => {
        socket.broadcast.to(socket.projectRoomId).emit('project-message', data);
    })


    socket.on('disconnect', () => {
        console.log('user disconnected');
        socket.leave(socket.projectRoomId);
    });
});



server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
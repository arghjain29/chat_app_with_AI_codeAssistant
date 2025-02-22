import jwt from 'jsonwebtoken';
import redisClient from '../services/redis.service.js';
import mongoose from 'mongoose';
import { getProjectById } from '../services/project.service.js';


export const authUser = async (req, res, next) => {
    try {
        const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
        if (!token) {
            return res.status(401).send({ error: 'Unauthorized Access' });
        }

        const isBlacklisted = await redisClient.get(token);
        if (isBlacklisted) {
            res.cookie('token', '');
            return res.status(401).send({ error: 'Unauthorized Access' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.log(error);
        res.status(401).send({ error: 'Please authenticate' });
    }
};

export const socketMiddleware = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || (socket.handshake.headers.authorization && socket.handshake.headers.authorization.split(' ')[1]);
        if (!token) {
            return next(new Error('not authorized'));
        }

        const projectId = socket.handshake.query.projectId;
        if (!mongoose.Types.ObjectId.isValid(projectId) || !projectId) {
            return next(new Error('Invalid Project ID'));
        }

        const project = await getProjectById({projectId});
        if (! project.status === 200) {
            return next(new Error('Project not found'));
        }
        

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return next(new Error('Authorization Error'));
        }

        socket.user = decoded; // Attach the decoded user to the socket object
        socket.projectRoomId = project.project._id.toString(); // Attach the project ID to the socket object
        next();
    } catch (error) {
        next(new Error('not authorized'));
    }
};


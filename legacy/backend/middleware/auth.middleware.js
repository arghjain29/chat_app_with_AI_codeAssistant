import jwt from 'jsonwebtoken';
import { safeRedisGet } from '../services/redis.service.js';
import mongoose from 'mongoose';
import { getProjectById } from '../services/project.service.js';
import { AuthError } from '../utils/errors.js';


export const authUser = async (req, res, next) => {
    try {
        const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
        if (!token) {
            throw new AuthError();
        }

        const isBlacklisted = await safeRedisGet(token);
        if (isBlacklisted) {
            res.cookie('token', '');
            throw new AuthError('Token has been revoked');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.isOperational) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(401).json({ message: 'Please authenticate' });
    }
};

export const socketMiddleware = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || (socket.handshake.headers.authorization && socket.handshake.headers.authorization.split(' ')[1]);
        if (!token) {
            return next(new Error('not authorized'));
        }

        const projectId = socket.handshake.query.projectId;
        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid Project ID'));
        }

        const project = await getProjectById({projectId});
        if (project.status !== 200) {
            return next(new Error('Project not found'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return next(new Error('Authorization Error'));
        }

        socket.user = decoded;
        socket.projectRoomId = project.project._id.toString();
        next();
    } catch (error) {
        next(new Error('not authorized'));
    }
};

import jwt from 'jsonwebtoken';
import redisClient from '../services/redis.service.js';


export const authUser = async (req, res, next) => {
    try {
        const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
        console.log(token);
        if(!token) {
            return res.status(401).send({ error: 'Unauthorized Access' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(decoded);
        req.user = decoded;
        next();
    } catch (error) {
        console.log(error);
        res.status(401).send({ error: 'Please authenticate' });
    }
};
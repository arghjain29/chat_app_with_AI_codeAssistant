import { v4 as uuidv4 } from 'uuid';

const requestId = (req, res, next) => {
    req.id = uuidv4();
    res.setHeader('X-Request-Id', req.id);
    next();
};

export default requestId;

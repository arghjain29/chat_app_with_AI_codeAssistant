import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.isOperational ? err.message : 'Internal server error';

    logger.error({
        err: {
            message: err.message,
            stack: err.stack,
            code: err.code,
        },
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        statusCode,
    }, `Error: ${err.message}`);

    res.status(statusCode).json({
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};

export default errorHandler;

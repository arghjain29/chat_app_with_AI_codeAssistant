import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody } from '@codecollab/shared';
import { ZodError, z } from 'zod';
import { AppError, NotFoundError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let body: ApiErrorBody['error'] = { code: 'INTERNAL_ERROR', message: 'Something went wrong' };

  if (err instanceof AppError) {
    status = err.statusCode;
    body = { code: err.code, message: err.message, details: err.details };
  } else if (err instanceof ZodError) {
    status = 400;
    body = { code: 'VALIDATION_ERROR', message: 'Invalid request', details: z.flattenError(err) };
  } else if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    status = err.status ?? 400;
    body = { code: 'VALIDATION_ERROR', message: err.message };
  }

  if (status >= 500) logger.error({ err, requestId: req.id }, 'Unhandled error');

  res.status(status).json({ error: { ...body, requestId: String(req.id) } } satisfies ApiErrorBody);
};

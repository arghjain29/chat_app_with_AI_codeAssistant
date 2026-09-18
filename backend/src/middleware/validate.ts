import type { Request } from 'express';
import type { z } from 'zod';

/** Parse and return request data; throws ZodError (-> 400) on failure. */
export const parseBody = <T extends z.ZodType>(schema: T, req: Request): z.infer<T> =>
  schema.parse(req.body);

export const parseParams = <T extends z.ZodType>(schema: T, req: Request): z.infer<T> =>
  schema.parse(req.params);

export const parseQuery = <T extends z.ZodType>(schema: T, req: Request): z.infer<T> =>
  schema.parse(req.query);

import type { UserDoc } from './modules/users/user.model.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireUser`. */
      user?: UserDoc;
    }
  }
}

export {};

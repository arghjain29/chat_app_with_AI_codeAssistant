import { Router } from 'express';
import { query } from 'express-validator';
import { authUser } from '../middleware/auth.middleware.js';
import * as aiController from '../controllers/ai.controller.js';

const router = Router();

router.get('/get-result',
    authUser,
    query('prompt').isString().notEmpty().withMessage('Prompt must be a non-empty string'),
    aiController.getResult);

export default router;

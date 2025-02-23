import { Router } from 'express';
import { body } from 'express-validator';
import { authUser } from '../middleware/auth.middleware.js';
import * as aiController from '../controllers/ai.controller.js';

const router = Router();

router.get('/get-result',
    // body('prompt').isString().withMessage('Prompt must be a string'),
    // authUser,
    aiController.getResult);


export default router;
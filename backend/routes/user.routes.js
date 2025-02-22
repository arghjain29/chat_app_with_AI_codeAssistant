import * as userController from '../controllers/user.controller.js';
import { Router } from 'express';
import { body } from 'express-validator';
import {authUser} from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register',
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    userController.createUserController);

router.post('/login',
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    userController.loginUserController);

router.get('/profile', authUser, userController.profileController);

router.get('/logout', authUser, userController.logoutController);

router.get('/all', authUser ,userController.allUsersController);

export default router;
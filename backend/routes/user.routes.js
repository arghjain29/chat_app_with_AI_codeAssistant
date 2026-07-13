import * as userController from '../controllers/user.controller.js';
import { Router } from 'express';
import { body } from 'express-validator';
import {authUser} from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register',
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('username').isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters long')
        .isAlphanumeric().withMessage('Username must contain only letters and numbers'),
    userController.createUserController);

router.post('/login',
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    userController.loginUserController);

router.get('/profile', authUser, userController.profileController);

router.put('/update-profile', authUser,
    body('username').isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters long')
        .isAlphanumeric().withMessage('Username must contain only letters and numbers'),
    userController.updateProfileController);

router.put('/change-password', authUser,
    body('currentPassword').isLength({ min: 6 }).withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    userController.changePasswordController);

router.delete('/delete-account', authUser, userController.deleteAccountController);

router.post('/logout', authUser, userController.logoutController);

router.get('/all', authUser, userController.allUsersController);

export default router;

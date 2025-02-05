import * as projectController from '../controllers/project.controller.js';
import { Router } from 'express';
import { body } from 'express-validator';
import * as authMiddleware from '../middleware/auth.middleware.js';

const router = Router();


router.post('/create',
    authMiddleware.authUser,
    body('name').isString().withMessage('Name must be a string'),
    projectController.createProjectController);

router.get('/all', authMiddleware.authUser, projectController.getAllProjectsController);

router.put('/add-user',
    authMiddleware.authUser,
    body('users').isArray({ min: 1 }).withMessage('Users must be an array with at least one user').bail()
        .custom((users) => users.every(users => typeof users === 'string')).withMessage('Users must be an array of strings'),
    body('projectId').isString().withMessage('Project Id is required and must be a string'),
    projectController.addUserToProjectController);

router.get('/get-project/:projectId', projectController.getByProjectIdController);

export default router;
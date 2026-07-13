import * as projectController from '../controllers/project.controller.js';
import { Router } from 'express';
import { body } from 'express-validator';
import {authUser} from '../middleware/auth.middleware.js';

const router = Router();


router.post('/create',
    authUser,
    body('name').isString().isLength({ min: 3, max: 50 }).withMessage('Name must be a string between 3-50 characters'),
    projectController.createProjectController);

router.get('/all', authUser, projectController.getAllProjectsController);

router.put('/add-user',
    authUser,
    body('users').isArray({ min: 1 }).withMessage('Users must be an array with at least one user').bail()
        .custom((users) => users.every(user => typeof user === 'string')).withMessage('Users must be an array of strings'),
    body('projectId').isString().withMessage('Project Id is required and must be a string'),
    projectController.addUserToProjectController);

router.put('/remove-user',
    authUser,
    body('userId').isString().withMessage('User ID is required'),
    body('projectId').isString().withMessage('Project Id is required'),
    projectController.removeUserFromProjectController);

router.get('/get-project/:projectId', authUser, projectController.getByProjectIdController);

router.delete('/delete-project/:projectId', authUser, projectController.deleteProjectController);

router.put('/update-project/:projectId', authUser,
    body('name').isString().isLength({ min: 3, max: 50 }).withMessage('Name must be a string between 3-50 characters'),
    projectController.updateProjectController);

export default router;

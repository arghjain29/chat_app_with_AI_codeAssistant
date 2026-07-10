import * as projectService from "../services/project.service.js";
import { validationResult } from "express-validator";
import logger from "../utils/logger.js";

export const createProjectController = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name } = req.body;
        const userId = req.user._id;
        const newProject = await projectService.createProject({ name, userId });
        logger.info({ projectId: newProject._id, userId }, 'Project created');
        res.status(201).json(newProject);
    } catch (error) {
        next(error);
    }
};

export const getAllProjectsController = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const projects = await projectService.getAllProjects(userId);
        res.status(200).json(projects);
    } catch (error) {
        next(error);
    }
};

export const addUserToProjectController = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {users, projectId} = req.body;
        const userId = req.user._id;
        const response = await projectService.addUserToProjects({ users, projectId, loggedInUser: userId });
        logger.info({ projectId, addedUsers: users, addedBy: userId }, 'Users added to project');
        return res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

export const removeUserFromProjectController = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { userId: targetUserId, projectId } = req.body;
        const loggedInUser = req.user._id;
        const response = await projectService.removeUserFromProject({ targetUserId, projectId, loggedInUser });
        logger.info({ projectId, removedUser: targetUserId, removedBy: loggedInUser }, 'User removed from project');
        return res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

export const getByProjectIdController = async (req, res, next) => {
    try {
        const projectId = req.params.projectId;
        const project = await projectService.getProjectById({projectId});
        res.status(200).json(project.project);
    } catch (error) {
        next(error);
    }
};

export const deleteProjectController = async (req, res, next) => {
    try {
        const projectId = req.params.projectId;
        const userId = req.user._id;
        await projectService.deleteProject({ projectId, userId });
        logger.info({ projectId, userId }, 'Project deleted');
        res.status(200).json({ message: 'Project deleted successfully' });
    } catch (error) {
        next(error);
    }
};

export const updateProjectController = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const projectId = req.params.projectId;
        const { name } = req.body;
        const userId = req.user._id;
        const project = await projectService.updateProject({ projectId, name, userId });
        logger.info({ projectId, userId }, 'Project updated');
        res.status(200).json(project);
    } catch (error) {
        next(error);
    }
};

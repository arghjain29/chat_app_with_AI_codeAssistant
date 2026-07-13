import projectModel from '../models/project.model.js';
import { NotFoundError, ValidationError, ConflictError, AuthError } from '../utils/errors.js';

export const createProject = async ({ name, userId }) => {
    if (!name) {
        throw new ValidationError('Name is required');
    }
    if (!userId) {
        throw new ValidationError('User is required');
    }

    try {
        const project = await projectModel.create({
            name, users: [userId]
        });
        return project;
    } catch (error) {
        if (error.code === 11000) {
            throw new ConflictError('Project already exists');
        }
        throw error;
    }
};

export const getAllProjects = async (userId) => {
    if (!userId) {
        throw new ValidationError('User is required');
    }

    const projects = await projectModel.find({ users: userId }).populate('users');
    return projects;
};

export const addUserToProjects = async ({ users, projectId, loggedInUser }) => {
    if (!users || users.length === 0) {
        throw new ValidationError('Users are required');
    }
    if (!projectId) {
        throw new ValidationError('Project Id is required');
    }
    if (!loggedInUser) {
        throw new ValidationError('Logged in user is required');
    }

    const project = await projectModel.findOne({
        _id: projectId,
        users: { $in: [loggedInUser] }
    });
    if (!project) {
        throw new NotFoundError('Project');
    }

    const existingUserIds = new Set(project.users.map(user => user.toString()));
    const newUsers = users.filter(user => !existingUserIds.has(user.toString()));
    if (newUsers.length === 0) {
        throw new ValidationError('Users already exist in project');
    }

    project.users = [...project.users, ...newUsers];
    await project.save();
    return { message: 'Users added successfully', project };
};

export const removeUserFromProject = async ({ targetUserId, projectId, loggedInUser }) => {
    if (!targetUserId) {
        throw new ValidationError('User ID is required');
    }
    if (!projectId) {
        throw new ValidationError('Project Id is required');
    }
    if (!loggedInUser) {
        throw new ValidationError('Logged in user is required');
    }

    const project = await projectModel.findById(projectId);
    if (!project) {
        throw new NotFoundError('Project');
    }

    if (project.users[0].toString() !== loggedInUser.toString()) {
        throw new AuthError('Only the project owner can remove collaborators');
    }

    if (project.users[0].toString() === targetUserId.toString()) {
        throw new ValidationError('Owner cannot be removed from the project');
    }

    const userIndex = project.users.findIndex(u => u.toString() === targetUserId.toString());
    if (userIndex === -1) {
        throw new NotFoundError('User in this project');
    }

    project.users.splice(userIndex, 1);
    await project.save();
    return { message: 'User removed successfully', project };
};

export const getProjectById = async ({ projectId }) => {
    if (!projectId) {
        throw new ValidationError('Project Id is required');
    }

    const project = await projectModel.findById(projectId).populate('users');
    if (!project) {
        throw new NotFoundError('Project');
    }
    return { status: 200, project };
};

export const deleteProject = async ({ projectId, userId }) => {
    if (!projectId) {
        throw new ValidationError('Project Id is required');
    }
    if (!userId) {
        throw new ValidationError('User is required');
    }

    const project = await projectModel.findById(projectId);
    if (!project) {
        throw new NotFoundError('Project');
    }

    if (project.users[0].toString() !== userId.toString()) {
        throw new AuthError('Only the project owner can delete the project');
    }

    await projectModel.findByIdAndDelete(projectId);
    return { message: 'Project deleted successfully' };
};

export const updateProject = async ({ projectId, name, userId }) => {
    if (!projectId) {
        throw new ValidationError('Project Id is required');
    }
    if (!name) {
        throw new ValidationError('Name is required');
    }
    if (!userId) {
        throw new ValidationError('User is required');
    }

    const project = await projectModel.findById(projectId);
    if (!project) {
        throw new NotFoundError('Project');
    }

    if (project.users[0].toString() !== userId.toString()) {
        throw new AuthError('Only the project owner can update the project');
    }

    project.name = name;
    try {
        await project.save();
    } catch (error) {
        if (error.code === 11000) {
            throw new ConflictError('Project name already exists');
        }
        throw error;
    }

    return project;
};

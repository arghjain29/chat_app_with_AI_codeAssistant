import projectModel from '../models/project.model.js';

export const createProject = async ({ name, userId }) => {

    if (!name) {
        throw new Error('Name is required');
    }
    if (!userId) {
        throw new Error('User is required');
    }

    let project;
    try {
        project = await projectModel.create({
            name, users: [userId]
        });
    } catch (error) {
        if (error.code === 11000) {
            return { status: 400, message: 'Project already exists' };
        }
        throw error;
    }

    return project;
};

export const getAllProjects = async (userId) => {
    if (!userId) {
        throw new Error('User is required');
    }

    const projects = await projectModel.find({ users: [userId] });
    if (projects.length === 0) {
        return { status: 400, message: 'No projects found' };
    }
    return projects;
};
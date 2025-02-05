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

export const addUserToProjects = async ({ users, projectId, loggedInUser }) => {
    if (!users || users.length === 0) {
        throw new Error('Users are required');
    }
    if (!projectId) {
        throw new Error('Project Id is required');
    }
    if (!loggedInUser) {
        throw new Error('Logged in user is required');
    }

    try {   
        const project = await projectModel.findOne({
            _id: projectId,
            users: { $in: [loggedInUser] }
        });
        if (!project) {
            return { status: 400, message: 'Project not found or user not authorized' };
        }
    
        // Filter out users that already exist in the project
        const existingUserIds = new Set(project.users.map(user => user.toString()));
        const newUsers = users.filter(user => !existingUserIds.has(user.toString()));
        if (newUsers.length === 0) {
            return { status: 400, message: 'Users already exist in project' };
        }
        
        // Add new users to the existing users
        project.users = [...project.users, ...newUsers];
        await project.save();
        return { status: 200, message: 'Users added successfully', project };
        
    } catch (error) {
        if (error.code === 11000) {
            return { status: 400, message: 'Project already exists' };
        }
        throw error;
    }
    
};

export const getProjectById = async ({ projectId }) => {
    if (!projectId) {
        return { status: 400, message: 'Project Id is required' };
    }

    const project = await projectModel.findById(projectId).populate('users');
    if (!project) {
        return { status: 400, message: 'Project not found' };
    }
    return { status: 200, project };
};
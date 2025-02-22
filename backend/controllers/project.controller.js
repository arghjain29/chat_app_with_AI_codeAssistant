import * as projectService from "../services/project.service.js";
import { validationResult } from "express-validator";

export const createProjectController = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name } = req.body;
        const userId = req.user._id;
        if (!name) {
            return res.status(400).json({ message: "Name is required" });
        }
        if (!userId) {
            return res.status(400).json({ message: "User Authentication Not defined" });
        }
        const newProject = await projectService.createProject({ name, userId });
        if (newProject.status === 400) {
            return res.status(400).json({ message: newProject.message });
        }
        res.status(201).json(newProject);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAllProjectsController = async (req, res) => {
    try {
        const userId = req.user._id;
        if (!userId) {
            return res.status(400).json({ message: "User Authentication Not defined" });
        }
        const projects = await projectService.getAllProjects(userId);
        if (projects.status === 400) {
            return res.status(400).json({ message: projects.message });
        }
        res.status(200).json(projects);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const addUserToProjectController = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {users, projectId} = req.body;
        const userId = req.user._id;

        if (!users || users.length === 0) {
            return res.status(400).json({ message: "Users are required" });
        }
        if (!projectId) {
            return res.status(400).json({ message: "Project Id is required" });
        }
        if (!userId) {
            return res.status(400).json({ message: "User Authentication Not defined" });
        }

        const response = await projectService.addUserToProjects({ users, projectId, loggedInUser: userId });
        if (response.status === 400){
            return res.status(400).json({ message: response.message });
        }
        if (response.status === 200){
            return res.status(200).json(response);
        }

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getByProjectIdController = async (req, res) => {
    try {
        const projectId = req.params.projectId;
        if (!projectId) {
            return res.status(400).json({ message: "Project Id is required" });
        }
        // if (!userId) {
        //     return res.status(400).json({ message: "User Authentication Not defined" });
        // }
        const project = await projectService.getProjectById({projectId});
        if (project.status === 400){
            return res.status(400).json({ message: project.message });
        }
        if (project.status === 200){
            return res.status(200).json(project.project);
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
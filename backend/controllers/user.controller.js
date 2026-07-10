import userModel from "../models/user.model.js";
import { validationResult } from "express-validator";
import radisClient from "../services/redis.service.js";
import { AppError, ConflictError, AuthError, NotFoundError } from "../utils/errors.js";
import logger from "../utils/logger.js";

export const createUserController = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            throw new AppError('Username, email and password are required');
        }
        const userExists = await userModel.findOne({ email });
        if(userExists) {
            throw new ConflictError('User already exists');
        }
        const hashPassword = await userModel.hashPassword(password);
        const user = await userModel.create({ username, email, password: hashPassword });
        const token = await user.generateJWT();

        delete user._doc.password;
        logger.info({ userId: user._id }, 'User registered');
        res.status(201).json({ user, token });
    } catch (error) {
        next(error);
    }
};

export const loginUserController = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            throw new AppError('Email and password are required');
        }
        const user = await userModel.findOne({ email }).select('+password');
        if (!user) {
            throw new AuthError('Invalid credentials');
        }
        const isMatch = await user.isValidPassword(password);
        if (!isMatch) {
            throw new AuthError('Invalid credentials');
        }

        const token = await user.generateJWT();

        delete user._doc.password;
        logger.info({ userId: user._id }, 'User logged in');
        res.status(200).json({ user, token });

    } catch (error) {
        next(error);
    }
}

export const profileController = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const user = await userModel.findById(userId);
        if (!user) {
            throw new NotFoundError('User');
        }
        delete user._doc.password;
        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};

export const logoutController = async (req, res, next) => {
    try {
        const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
        radisClient.set(token, 'logout', 'EX', 60 * 60 * 24);
        res.clearCookie('token');
        logger.info({ userId: req.user._id }, 'User logged out');
        res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        next(error);
    }
};

export const allUsersController = async (req, res, next) => {
    const userId = req.user._id;
    try {
        const users = await userModel.find({ _id: { $ne: userId } });
        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
};

import * as ai from "../services/ai.service.js";
import { validationResult } from "express-validator";
import logger from "../utils/logger.js";

export const getResult = async (req, res, next) => {
    try {
        const prompt = req.query.prompt;
        logger.info({ promptLength: prompt.length, userId: req.user?._id }, 'AI request received');
        const result = await ai.generateResult(prompt);
        logger.info({ userId: req.user?._id }, 'AI response generated');
        res.send(result);
    } catch (error) {
        next(error);
    }
};

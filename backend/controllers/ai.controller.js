import * as ai from "../services/ai.service.js";
import { validationResult } from "express-validator";

export const getResult = async (req, res, next) => {
    try {
        const prompt = req.query.prompt;
        const result = await ai.generateResult(prompt);
        res.send(result);
    } catch (error) {
        next(error);
    }
};

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

const connectDB = async (retryCount = 0) => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            console.log(`MongoDB connection failed, retrying in ${RETRY_DELAY / 1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return connectDB(retryCount + 1);
        }
        console.error('MongoDB connection failed after all retries');
        process.exit(1);
    }
};

export default connectDB;

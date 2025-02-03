import mongoose from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        minLength: [6, "Email must be at least 6 characters long"],
        maxLength: [54, "Email must be at most 254 characters long"],
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
});

userSchema.statics.hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
}

userSchema.methods.isValidPassword = async function (password) {
    console.log(password, this.password);
    return await bcrypt.compare(password, this.password);
}

userSchema.methods.generateJWT = function () {
    return jwt.sign(
        { email: this.email },
        process.env.JWT_SECRET,
        {expiresIn: '24h'}
    );
}

export default mongoose.model("user", userSchema);
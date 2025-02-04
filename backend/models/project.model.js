import mongoose from "mongoose";


const projectSchema = new mongoose.Schema({
    name : {
        type: String,
        lowercase: true,
        unique: true,
        required: true,
        trim: true,
        minLength: [3, "Project name must be at least 3 characters long"],
        maxLength: [50, "Project name must be at most 50 characters long"],
    },

    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
    }],
})

export default mongoose.model("project", projectSchema);
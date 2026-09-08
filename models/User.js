const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },

        passwordHash: {
            type: String,
            required: true,
            select: false
        },

        displayName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        role: {
            type: String,
            enum: ["reporter", "editor"],
            required: true
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

userSchema.index({ role: 1 });

module.exports = mongoose.model("User", userSchema);
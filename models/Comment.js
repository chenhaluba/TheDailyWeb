const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
    {
        article: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Article",
            required: true
        },

        authorName: {
            type: String,
            trim: true,
            maxlength: 50,
            default: "guest"
        },

        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        },

        deviceId: {
            type: String,
            required: true,
            trim: true
        },

        ipAddress: {
            type: String,
            trim: true,
            default: ""
        },

        isVisible: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

commentSchema.index({
    article: 1,
    createdAt: -1
});

commentSchema.index({
    deviceId: 1,
    createdAt: -1
});

module.exports = mongoose.model("Comment", commentSchema);
const mongoose = require("mongoose");
const CONSTANTS = require("../config/constants");

const articleVersionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            trim: true,
            maxlength: 200,
            default: ""
        },

        summary: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },

        content: {
            type: String,
            default: ""
        },

        category: {
            type: String,
            trim: true,
            maxlength: 100,
            default: ""
        },

        mainImage: {
            type: String,
            trim: true,
            default: ""
        },

        savedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        _id: false
    }
);

const publicationHistorySchema = new mongoose.Schema(
    {
        publishedAt: {
            type: Date,
            required: true
        },

        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        versionNumber: {
            type: Number,
            required: true,
            min: 1
        }
    },
    {
        _id: false
    }
);

const articleSchema = new mongoose.Schema(
    {
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        status: {
            type: String,
            enum: Object.values(CONSTANTS.ARTICLE_STATUS),
            default: "draft"
        },

        publishedVersion: {
            type: articleVersionSchema,
            default: null
        },

        workingVersion: {
            type: articleVersionSchema,
            default: () => ({})
        },

        editorNote: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: ""
        },

        publicationHistory: {
            type: [publicationHistorySchema],
            default: []
        },

        totalViews: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

articleSchema.index({ author: 1, status: 1 });

articleSchema.index({
    status: 1,
    "publishedVersion.savedAt": -1
});

articleSchema.index({
    "publishedVersion.category": 1,
    status: 1
});

articleSchema.index({
    totalViews: -1
});

articleSchema.index({
    "publishedVersion.title": "text"
});

module.exports = mongoose.model("Article", articleSchema);

const mongoose = require("mongoose");

const Article = require("../models/Article");
const Comment = require("../models/Comment");

const MAX_AUTHOR_NAME_LENGTH = 50;
const MAX_CONTENT_LENGTH = 1000;

function sendError(res, status, message, errors = []) {
    return res.status(status).json({
        success: false,
        message,
        errors
    });
}

function toPublicComment(comment) {
    return {
        _id: comment._id,
        article: comment.article,
        authorName: comment.authorName,
        content: comment.content,
        isVisible: comment.isVisible,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt
    };
}

async function publishedArticleExists(articleId) {
    return await Article.exists({
        _id: articleId,
        publishedVersion: { $ne: null }
    });
}

async function getComments(req, res) {
    try {
        const { articleId } = req.params;

        if (!mongoose.isValidObjectId(articleId)) {
            return sendError(res, 400, "Invalid article ID");
        }

        if (!await publishedArticleExists(articleId)) {
            return sendError(res, 404, "Published article not found");
        }

        const comments = await Comment.find({
            article: articleId,
            isVisible: true
        })
            .select("-deviceId -ipAddress -__v")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: comments,
            message: "Comments retrieved successfully"
        });
    } catch (error) {
        console.error("Error fetching comments:", error.message);
        return sendError(res, 500, "Failed to retrieve comments");
    }
}

async function createComment(req, res) {
    try {
        const { articleId } = req.params;

        if (!mongoose.isValidObjectId(articleId)) {
            return sendError(res, 400, "Invalid article ID");
        }

        if (!await publishedArticleExists(articleId)) {
            return sendError(res, 404, "Published article not found");
        }

        const rawAuthorName = req.body && req.body.authorName;
        const rawContent = req.body && req.body.content;

        if (
            rawAuthorName !== undefined &&
            rawAuthorName !== null &&
            typeof rawAuthorName !== "string"
        ) {
            return sendError(res, 400, "Author name must be a string");
        }

        if (typeof rawContent !== "string") {
            return sendError(res, 400, "Content must be a string");
        }

        const authorName = typeof rawAuthorName === "string"
            ? rawAuthorName.trim()
            : "";
        const content = rawContent.trim();

        if (!content) {
            return sendError(res, 400, "Comment content is required");
        }

        if (authorName.length > MAX_AUTHOR_NAME_LENGTH) {
            return sendError(
                res,
                400,
                `Author name cannot exceed ${MAX_AUTHOR_NAME_LENGTH} characters`
            );
        }

        if (content.length > MAX_CONTENT_LENGTH) {
            return sendError(
                res,
                400,
                `Comment content cannot exceed ${MAX_CONTENT_LENGTH} characters`
            );
        }

        const commentData = {
            article: articleId,
            content,
            deviceId: req.commentDeviceId,
            ipAddress: req.ip
        };

        if (authorName) {
            commentData.authorName = authorName;
        }

        const comment = await Comment.create(commentData);

        return res.status(201).json({
            success: true,
            data: toPublicComment(comment),
            message: "Comment created successfully"
        });
    } catch (error) {
        console.error("Error creating comment:", error.message);

        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map(
                validationError => validationError.message
            );
            return sendError(res, 400, "Invalid comment data", errors);
        }

        return sendError(res, 500, "Failed to create comment");
    }
}

async function updateComment(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return sendError(res, 400, "Invalid comment ID");
        }

        const body = req.body || {};
        const allowedFields = ["content", "isVisible"];
        const suppliedFields = Object.keys(body);
        const unsupportedFields = suppliedFields.filter(
            field => !allowedFields.includes(field)
        );

        if (unsupportedFields.length > 0) {
            return sendError(
                res,
                400,
                "Only content and isVisible may be updated",
                unsupportedFields
            );
        }

        if (suppliedFields.length === 0) {
            return sendError(res, 400, "No update fields were provided");
        }

        const updateData = {};

        if (Object.prototype.hasOwnProperty.call(body, "content")) {
            if (typeof body.content !== "string") {
                return sendError(res, 400, "Content must be a string");
            }

            const content = body.content.trim();

            if (!content) {
                return sendError(res, 400, "Comment content is required");
            }

            if (content.length > MAX_CONTENT_LENGTH) {
                return sendError(
                    res,
                    400,
                    `Comment content cannot exceed ${MAX_CONTENT_LENGTH} characters`
                );
            }

            updateData.content = content;
        }

        if (Object.prototype.hasOwnProperty.call(body, "isVisible")) {
            if (typeof body.isVisible !== "boolean") {
                return sendError(res, 400, "isVisible must be a boolean");
            }

            updateData.isVisible = body.isVisible;
        }

        const comment = await Comment.findByIdAndUpdate(
            id,
            { $set: updateData },
            {
                new: true,
                runValidators: true
            }
        ).select("-deviceId -ipAddress -__v");

        if (!comment) {
            return sendError(res, 404, "Comment not found");
        }

        return res.status(200).json({
            success: true,
            data: comment,
            message: "Comment updated successfully"
        });
    } catch (error) {
        console.error("Error updating comment:", error.message);

        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map(
                validationError => validationError.message
            );
            return sendError(res, 400, "Invalid comment data", errors);
        }

        return sendError(res, 500, "Failed to update comment");
    }
}

async function deleteComment(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return sendError(res, 400, "Invalid comment ID");
        }

        const comment = await Comment.findByIdAndDelete(id);

        if (!comment) {
            return sendError(res, 404, "Comment not found");
        }

        return res.status(200).json({
            success: true,
            data: toPublicComment(comment),
            message: "Comment deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting comment:", error.message);
        return sendError(res, 500, "Failed to delete comment");
    }
}

module.exports = {
    getComments,
    createComment,
    updateComment,
    deleteComment
};

const Article = require("../models/Article");
const CONSTANTS = require("../config/constants");

function createWorkflowError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function getEditorArticles(status = "") {
    const filter = {};

    if (status) {
        const validStatuses = Object.values(CONSTANTS.ARTICLE_STATUS);

        if (!validStatuses.includes(status)) {
            throw createWorkflowError("Invalid status", 400);
        }

        filter.status = status;
    }

    return Article.find(filter)
        .populate("author", "displayName username")
        .sort({ updatedAt: -1 })
        .lean();
}

async function getEditorArticleById(id) {
    return Article.findById(id)
        .populate("author", "displayName username")
        .lean();
}

async function updateWorkingVersion(id, updates = {}) {
    const article = await Article.findById(id);

    if (!article) {
        throw createWorkflowError("Article not found", 404);
    }

    const allowedFields = [
        "title",
        "summary",
        "content",
        "category",
        "mainImage"
    ];

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            article.workingVersion[field] = updates[field];
        }
    }

    article.workingVersion.savedAt = new Date();

    await article.save();

    return article;
}

async function approveArticle(id, editorId) {
    const article = await Article.findById(id);

    if (!article) {
        throw createWorkflowError("Article not found", 404);
    }

    if (article.status !== CONSTANTS.ARTICLE_STATUS.PENDING) {
        throw createWorkflowError("Article is not pending", 400);
    }

    article.publishedVersion = article.workingVersion.toObject();
    article.status = CONSTANTS.ARTICLE_STATUS.PUBLISHED;
    article.editorNote = "";

    const versionNumber = article.publicationHistory.length + 1;

    article.publicationHistory.push({
        publishedAt: new Date(),
        approvedBy: editorId,
        versionNumber
    });

    await article.save();

    return article;
}

async function returnArticle(id, editorNote) {
    const article = await Article.findById(id);

    if (!article) {
        throw createWorkflowError("Article not found", 404);
    }

    const canReturn =
        article.status === CONSTANTS.ARTICLE_STATUS.PENDING ||
        article.status === CONSTANTS.ARTICLE_STATUS.PUBLISHED;

    if (!canReturn) {
        throw createWorkflowError(
            "Only pending or published articles can be returned",
            400
        );
    }

    if (typeof editorNote !== "string" || !editorNote.trim()) {
        throw createWorkflowError("Editor note is required", 400);
    }

    if (
        article.status === CONSTANTS.ARTICLE_STATUS.PUBLISHED &&
        article.publishedVersion
    ) {
        article.workingVersion = {
            ...article.publishedVersion.toObject(),
            savedAt: new Date()
        };
    }

    article.status = CONSTANTS.ARTICLE_STATUS.RETURNED;
    article.editorNote = editorNote.trim();

    await article.save();

    return article;
}
async function deleteArticle(id) {
    const article = await Article.findByIdAndDelete(id);

    if (!article) {
        throw createWorkflowError("Article not found", 404);
    }

    return article;
}

module.exports = {
    getEditorArticles,
    getEditorArticleById,
    updateWorkingVersion,
    approveArticle,
    returnArticle,
    deleteArticle
};
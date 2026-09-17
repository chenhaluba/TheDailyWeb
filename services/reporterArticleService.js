const mongoose = require("mongoose");
const Article = require("../models/Article");
const CONSTANTS = require("../config/constants");

const { ARTICLE_STATUS, CATEGORIES } = CONSTANTS;
const editableStatuses = [ARTICLE_STATUS.DRAFT, ARTICLE_STATUS.RETURNED];
const statusDetails = {
    [ARTICLE_STATUS.DRAFT]: { label: "Draft", cssClass: "draft" },
    [ARTICLE_STATUS.PENDING]: { label: "Pending Review", cssClass: "pending" },
    [ARTICLE_STATUS.PUBLISHED]: { label: "Published", cssClass: "published" },
    [ARTICLE_STATUS.RETURNED]: { label: "Returned for Revisions", cssClass: "returned" }
};

function formatDate(date) {
    if (!date) return "Not saved yet";
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "Not saved yet";
    return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(parsedDate);
}

function getStatusDetails(status) {
    return statusDetails[status] || { label: status || "Unknown", cssClass: "unknown" };
}

function getVersionFromBody(body = {}) {
    const getString = (value) => typeof value === "string" ? value.trim() : "";
    return {
        title: getString(body.title),
        summary: getString(body.summary),
        content: getString(body.content),
        category: getString(body.category),
        mainImage: getString(body.mainImage),
        savedAt: new Date()
    };
}

function validateCategory(category) {
    if (!category || CATEGORIES.includes(category)) return [];
    return [`Category must be one of: ${CATEGORIES.join(", ")}`];
}

function validateArticleForSubmission(version = {}) {
    const requiredFields = [
        { name: "title", label: "Title" },
        { name: "summary", label: "Summary" },
        { name: "content", label: "Content" },
        { name: "category", label: "Category" },
        { name: "mainImage", label: "Main Image" }
    ];
    const errors = requiredFields
        .filter(({ name }) => typeof version[name] !== "string" || !version[name].trim())
        .map(({ label }) => `${label} is required`);
    return errors.concat(validateCategory(version.category));
}

function isEditableStatus(status) {
    return editableStatuses.includes(status);
}

function createArticleViewModel(article) {
    const workingVersion = article.workingVersion || {};
    const publishedVersion = article.publishedVersion || {};
    const status = getStatusDetails(article.status);
    return {
        id: article._id.toString(),
        title: workingVersion.title || publishedVersion.title || "Untitled Article",
        status: article.status,
        statusLabel: status.label,
        statusClass: status.cssClass,
        editorNote: article.editorNote || "",
        savedAt: formatDate(workingVersion.savedAt || article.updatedAt),
        canEdit: isEditableStatus(article.status),
        canStartUpdate: article.status === ARTICLE_STATUS.PUBLISHED
    };
}

function serializeArticle(article) {
    const status = getStatusDetails(article.status);
    return {
        id: article._id.toString(),
        status: article.status,
        statusLabel: status.label,
        statusClass: status.cssClass,
        workingVersion: article.workingVersion || {},
        publishedVersion: article.publishedVersion || null,
        editorNote: article.editorNote || "",
        updatedAt: article.updatedAt
    };
}

function createStatusCounts(articles) {
    const counts = { draft: 0, pending: 0, published: 0, returned: 0 };
    articles.forEach(({ status }) => {
        if (Object.hasOwn(counts, status)) counts[status] += 1;
    });
    return counts;
}

async function getDashboardData(userId) {
    const articles = await Article.find({ author: userId })
        .select("_id status workingVersion.title workingVersion.savedAt publishedVersion.title editorNote updatedAt")
        .sort({ updatedAt: -1 })
        .lean();
    return { articles: articles.map(createArticleViewModel), statusCounts: createStatusCounts(articles) };
}

function isValidArticleId(articleId) {
    return mongoose.isValidObjectId(articleId);
}

async function findOwnedArticle(articleId, userId, { lean = false } = {}) {
    const query = Article.findOne({ _id: articleId, author: userId });
    return lean ? query.lean() : query;
}

function createWorkingVersionFromPublished(article) {
    const { title, summary, content, category, mainImage } = article.publishedVersion;
    return { title, summary, content, category, mainImage, savedAt: new Date() };
}

module.exports = {
    ARTICLE_STATUS,
    CATEGORIES,
    getVersionFromBody,
    validateCategory,
    validateArticleForSubmission,
    isEditableStatus,
    serializeArticle,
    getDashboardData,
    isValidArticleId,
    findOwnedArticle,
    createWorkingVersionFromPublished
};

const Article = require("../models/Article");
const {
    ARTICLE_STATUS,
    getVersionFromBody,
    validateCategory,
    validateArticleForSubmission,
    isEditableStatus,
    serializeArticle,
    isValidArticleId,
    findOwnedArticle,
    createWorkingVersionFromPublished
} = require("../services/reporterArticleService");

function sendSuccess(res, statusCode, data, message = "") {
    return res.status(statusCode).json({ success: true, data, message });
}

function sendApiError(res, statusCode, message, errors = []) {
    return res.status(statusCode).json({ success: false, message, errors });
}

function getValidationErrors(error) {
    if (error.name !== "ValidationError") return [];
    return Object.values(error.errors).map(({ message }) => message);
}

function handleUnexpectedError(res, error, logMessage, userMessage) {
    console.error(`${logMessage}:`, error.message);
    if (error.name === "ValidationError") {
        return sendApiError(res, 400, "Invalid article data", getValidationErrors(error));
    }
    return sendApiError(res, 500, userMessage);
}

async function getReporterArticles(req, res) {
    const requestedStatus = req.query.status;
    if (requestedStatus && (typeof requestedStatus !== "string" || !Object.values(ARTICLE_STATUS).includes(requestedStatus))) {
        return sendApiError(res, 400, "Invalid article status");
    }

    try {
        const filter = { author: req.user.userID };
        if (requestedStatus) filter.status = requestedStatus;
        const articles = await Article.find(filter).sort({ updatedAt: -1 }).lean();
        return sendSuccess(res, 200, { items: articles.map(serializeArticle) });
    } catch (error) {
        return handleUnexpectedError(res, error, "Failed to get reporter articles", "Failed to load articles");
    }
}

async function getReporterArticleById(req, res) {
    const articleId = req.params.id;
    if (!isValidArticleId(articleId)) return sendApiError(res, 400, "Invalid article ID");

    try {
        const article = await findOwnedArticle(articleId, req.user.userID, { lean: true });
        if (!article) return sendApiError(res, 404, "Article not found");
        return sendSuccess(res, 200, { article: serializeArticle(article) });
    } catch (error) {
        return handleUnexpectedError(res, error, "Failed to get reporter article", "Failed to load article");
    }
}

async function createReporterArticle(req, res) {
    const workingVersion = getVersionFromBody(req.body);
    const categoryErrors = validateCategory(workingVersion.category);
    if (categoryErrors.length) return sendApiError(res, 400, "Invalid article data", categoryErrors);

    try {
        const article = await Article.create({
            author: req.user.userID,
            status: ARTICLE_STATUS.DRAFT,
            workingVersion,
            publishedVersion: null
        });
        return sendSuccess(
            res,
            201,
            { article: { id: article._id.toString(), status: article.status } },
            "Draft created successfully"
        );
    } catch (error) {
        return handleUnexpectedError(res, error, "Failed to create reporter article", "Failed to create article");
    }
}

async function saveReporterDraft(req, res) {
    const articleId = req.params.id;
    if (!isValidArticleId(articleId)) return sendApiError(res, 400, "Invalid article ID");

    const workingVersion = getVersionFromBody(req.body);
    const categoryErrors = validateCategory(workingVersion.category);
    if (categoryErrors.length) return sendApiError(res, 400, "Invalid article data", categoryErrors);

    try {
        const article = await findOwnedArticle(articleId, req.user.userID);
        if (!article) return sendApiError(res, 404, "Article not found");
        if (!isEditableStatus(article.status)) {
            return sendApiError(res, 400, "Cannot edit an article in its current status");
        }

        article.workingVersion = workingVersion;
        await article.save();
        return sendSuccess(
            res,
            200,
            { article: { id: article._id.toString(), status: article.status, savedAt: article.workingVersion.savedAt } },
            "Draft saved successfully"
        );
    } catch (error) {
        return handleUnexpectedError(res, error, "Failed to save reporter draft", "Failed to save article");
    }
}

async function submitReporterArticle(req, res) {
    const articleId = req.params.id;
    if (!isValidArticleId(articleId)) return sendApiError(res, 400, "Invalid article ID");

    try {
        const article = await findOwnedArticle(articleId, req.user.userID);
        if (!article) return sendApiError(res, 404, "Article not found");
        if (!isEditableStatus(article.status)) {
            return sendApiError(res, 400, "Only draft or returned articles can be submitted for review");
        }

        const validationErrors = validateArticleForSubmission(article.workingVersion);
        if (validationErrors.length) {
            return sendApiError(res, 400, "Please complete all required fields before submitting", validationErrors);
        }

        article.status = ARTICLE_STATUS.PENDING;
        article.editorNote = "";
        await article.save();
        return sendSuccess(
            res,
            200,
            { article: { id: article._id.toString(), status: article.status } },
            "Article submitted for editor review"
        );
    } catch (error) {
        return handleUnexpectedError(res, error, "Failed to submit reporter article", "Failed to submit article for review");
    }
}

async function startPublishedArticleUpdate(req, res) {
    const articleId = req.params.id;
    if (!isValidArticleId(articleId)) return sendApiError(res, 400, "Invalid article ID");

    try {
        const article = await findOwnedArticle(articleId, req.user.userID);
        if (!article) return sendApiError(res, 404, "Article not found");
        if (article.status !== ARTICLE_STATUS.PUBLISHED) {
            return sendApiError(res, 400, "Cannot start an update for an article in its current status");
        }
        if (!article.publishedVersion) {
            return sendApiError(res, 400, "This article has no published version");
        }

        article.workingVersion = createWorkingVersionFromPublished(article);
        article.status = ARTICLE_STATUS.DRAFT;
        article.editorNote = "";
        await article.save();
        return sendSuccess(
            res,
            200,
            { article: { id: article._id.toString(), status: article.status } },
            "Working version created for article"
        );
    } catch (error) {
        return handleUnexpectedError(res, error, "Failed to start published article update", "Failed to start article update");
    }
}

module.exports = {
    getReporterArticles,
    getReporterArticleById,
    createReporterArticle,
    saveReporterDraft,
    submitReporterArticle,
    startPublishedArticleUpdate
};

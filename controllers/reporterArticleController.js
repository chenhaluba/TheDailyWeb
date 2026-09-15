const mongoose = require("mongoose");
const Article = require("../models/Article");

const statusDetails = {
    draft: { label: "Draft", cssClass: "draft" },
    pending: { label: "Pending Review", cssClass: "pending" },
    published: { label: "Published", cssClass: "published" },
    returned: { label: "Returned for Revisions", cssClass: "returned" }
};

const allowedStatuses = Object.keys(statusDetails);

function formatDate(date) {
    if (!date) return "Not saved yet";

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "Not saved yet";

    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(parsedDate);
}

function getStatusDetails(status) {
    return statusDetails[status] || { label: status, cssClass: "unknown" };
}

function getVersionFromBody(body) {
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
        canEdit: ["draft", "returned"].includes(article.status),
        canStartUpdate: article.status === "published"
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

function sendApiError(res, statusCode, message, errors = []) {
    return res.status(statusCode).json({ success: false, message, errors });
}

function getValidationErrors(error) {
    if (error.name !== "ValidationError") return [];
    return Object.values(error.errors).map((validationError) => validationError.message);
}

function validateArticleForSubmission(workingVersion) {
    const requiredFields = [
        { name: "title", label: "Title" },
        { name: "summary", label: "Summary" },
        { name: "content", label: "Content" },
        { name: "category", label: "Category" },
        { name: "mainImage", label: "Main Image" }
    ];

    return requiredFields
        .filter((field) => {
            const value = workingVersion ? workingVersion[field.name] : null;
            return typeof value !== "string" || !value.trim();
        })
        .map((field) => `${field.label} is required`);
}

async function renderDashboard(req, res) {
    try {
        const articles = await Article.find({ author: req.user.userID })
            .select("_id status workingVersion.title workingVersion.savedAt publishedVersion.title editorNote updatedAt")
            .sort({ updatedAt: -1 })
            .lean();

        return res.render("reporter/dashboard", {
            pageTitle: "Reporter Dashboard",
            articles: articles.map(createArticleViewModel),
            errorMessage: ""
        });
    } catch (error) {
        console.error("Failed to load reporter articles:", error.message);

        return res.status(500).render("reporter/dashboard", {
            pageTitle: "Reporter Dashboard",
            articles: [],
            errorMessage: "Failed to load articles. Please try again later."
        });
    }
}

function renderNewArticle(req, res) {
    return res.render("reporter/editArticle", {
        pageTitle: "New Article",
        article: {
            id: "",
            status: "draft",
            statusLabel: statusDetails.draft.label,
            statusClass: "draft",
            workingVersion: { title: "", summary: "", content: "", category: "", mainImage: "" },
            publishedVersion: null,
            editorNote: ""
        },
        isNew: true,
        isEditable: true
    });
}

async function renderEditArticle(req, res) {
    const articleId = req.params.id;

    if (!mongoose.isValidObjectId(articleId)) {
        return res.status(404).render("notFound", { pageTitle: "Article Not Found" });
    }

    try {
        const article = await Article.findOne({ _id: articleId, author: req.user.userID }).lean();

        if (!article) {
            return res.status(404).render("notFound", { pageTitle: "Article Not Found" });
        }

        const articleForView = serializeArticle(article);

        return res.render("reporter/editArticle", {
            pageTitle: articleForView.workingVersion.title || "Edit Article",
            article: articleForView,
            isNew: false,
            isEditable: ["draft", "returned"].includes(article.status)
        });
    } catch (error) {
        console.error("Failed to load reporter article:", error.message);
        return res.status(500).render("notFound", { pageTitle: "Error Loading Article" });
    }
}

async function getReporterArticles(req, res) {
    const requestedStatus = req.query.status;

    if (requestedStatus && (typeof requestedStatus !== "string" || !allowedStatuses.includes(requestedStatus))) {
        return sendApiError(res, 400, "Invalid article status");
    }

    try {
        const filter = { author: req.user.userID };
        if (requestedStatus) filter.status = requestedStatus;

        const articles = await Article.find(filter).sort({ updatedAt: -1 }).lean();

        return res.status(200).json({
            success: true,
            data: { items: articles.map(serializeArticle) },
            message: ""
        });
    } catch (error) {
        console.error("Failed to get reporter articles:", error.message);
        return sendApiError(res, 500, "Failed to load articles");
    }
}

async function getReporterArticleById(req, res) {
    const articleId = req.params.id;

    if (!mongoose.isValidObjectId(articleId)) {
        return sendApiError(res, 400, "Invalid article ID");
    }

    try {
        const article = await Article.findOne({ _id: articleId, author: req.user.userID }).lean();

        if (!article) {
            return sendApiError(res, 404, "Article not found");
        }

        return res.status(200).json({
            success: true,
            data: { article: serializeArticle(article) },
            message: ""
        });
    } catch (error) {
        console.error("Failed to get reporter article:", error.message);
        return sendApiError(res, 500, "Failed to load article");
    }
}

async function createReporterArticle(req, res) {
    try {
        const article = await Article.create({
            author: req.user.userID,
            status: "draft",
            workingVersion: getVersionFromBody(req.body),
            publishedVersion: null
        });

        return res.status(201).json({
            success: true,
            data: { article: { id: article._id.toString(), status: article.status } },
            message: "Draft created successfully"
        });
    } catch (error) {
        console.error("Failed to create reporter article:", error.message);

        if (error.name === "ValidationError") {
            return sendApiError(res, 400, "Invalid data provided", getValidationErrors(error));
        }

        return sendApiError(res, 500, "Failed to create article");
    }
}

async function saveReporterDraft(req, res) {
    const articleId = req.params.id;

    if (!mongoose.isValidObjectId(articleId)) {
        return sendApiError(res, 400, "Invalid article ID");
    }

    try {
        const article = await Article.findOne({ _id: articleId, author: req.user.userID });

        if (!article) {
            return sendApiError(res, 404, "Article not found");
        }

        if (!["draft", "returned"].includes(article.status)) {
            return sendApiError(res, 400, "Cannot edit an article in its current status");
        }

        const workingVersion = getVersionFromBody(req.body);

        article.workingVersion.title = workingVersion.title;
        article.workingVersion.summary = workingVersion.summary;
        article.workingVersion.content = workingVersion.content;
        article.workingVersion.category = workingVersion.category;
        article.workingVersion.mainImage = workingVersion.mainImage;
        article.workingVersion.savedAt = workingVersion.savedAt;

        await article.save();

        return res.status(200).json({
            success: true,
            data: {
                article: {
                    id: article._id.toString(),
                    status: article.status,
                    savedAt: article.workingVersion.savedAt
                }
            },
            message: "Draft saved successfully"
        });
    } catch (error) {
        console.error("Failed to save reporter draft:", error.message);

        if (error.name === "ValidationError") {
            return sendApiError(res, 400, "Invalid data provided", getValidationErrors(error));
        }

        return sendApiError(res, 500, "Failed to save article");
    }
}

async function submitReporterArticle(req, res) {
    const articleId = req.params.id;

    if (!mongoose.isValidObjectId(articleId)) {
        return sendApiError(res, 400, "Invalid article ID");
    }

    try {
        const article = await Article.findOne({ _id: articleId, author: req.user.userID });

        if (!article) {
            return sendApiError(res, 404, "Article not found");
        }

        if (!["draft", "returned"].includes(article.status)) {
            return sendApiError(res, 400, "Only draft or returned articles can be submitted for review");
        }

        const validationErrors = validateArticleForSubmission(article.workingVersion);

        if (validationErrors.length > 0) {
            return sendApiError(res, 400, "Please complete all required fields before submitting", validationErrors);
        }

        article.status = "pending";
        article.editorNote = "";
        await article.save();

        return res.status(200).json({
            success: true,
            data: { article: { id: article._id.toString(), status: article.status } },
            message: "Article submitted for editor review"
        });
    } catch (error) {
        console.error("Failed to submit reporter article:", error.message);

        if (error.name === "ValidationError") {
            return sendApiError(res, 400, "Invalid data provided", getValidationErrors(error));
        }

        return sendApiError(res, 500, "Failed to submit article for review");
    }
}

async function startPublishedArticleUpdate(req, res) {
    const articleId = req.params.id;

    if (!mongoose.isValidObjectId(articleId)) {
        return sendApiError(res, 400, "Invalid article ID");
    }

    try {
        const article = await Article.findOne({ _id: articleId, author: req.user.userID });

        if (!article) {
            return sendApiError(res, 404, "Article not found");
        }

        if (article.status !== "published") {
            return sendApiError(res, 400, "Cannot start an update for an article in its current status");
        }

        if (!article.publishedVersion) {
            return sendApiError(res, 400, "This article has no published version");
        }

        article.workingVersion = {
            title: article.publishedVersion.title,
            summary: article.publishedVersion.summary,
            content: article.publishedVersion.content,
            category: article.publishedVersion.category,
            mainImage: article.publishedVersion.mainImage,
            savedAt: new Date()
        };

        article.status = "draft";
        article.editorNote = "";
        await article.save();

        return res.status(200).json({
            success: true,
            data: { article: { id: article._id.toString(), status: article.status } },
            message: "Working version created for article"
        });
    } catch (error) {
        console.error("Failed to start published article update:", error.message);
        return sendApiError(res, 500, "Failed to start article update");
    }
}

module.exports = {
    renderDashboard,
    renderNewArticle,
    renderEditArticle,
    getReporterArticles,
    getReporterArticleById,
    createReporterArticle,
    saveReporterDraft,
    submitReporterArticle,
    startPublishedArticleUpdate
};
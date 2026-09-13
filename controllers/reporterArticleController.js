const mongoose = require("mongoose");
const Article = require("../models/Article");

const statusDetails = {
    draft: { label: "בהכנה", cssClass: "draft" },
    pending: { label: "ממתינה לאישור עורך", cssClass: "pending" },
    published: { label: "פורסמה", cssClass: "published" },
    returned: { label: "הוחזרה לתיקונים", cssClass: "returned" }
};

function formatDate(date) {
    if (!date) return "טרם נשמרה";

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "טרם נשמרה";

    return new Intl.DateTimeFormat("he-IL", {
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
        title: workingVersion.title || publishedVersion.title || "כתבה ללא כותרת",
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

async function renderDashboard(req, res) {
    try {
        const articles = await Article.find({ author: req.user.userID }).sort({ updatedAt: -1 }).lean();
        const articlesForView = articles.map(createArticleViewModel);

        return res.render("reporter/dashboard", {
            pageTitle: "אזור הכתב",
            articles: articlesForView,
            errorMessage: ""
        });
    } catch (error) {
        console.error("Failed to load reporter articles:", error.message);

        return res.status(500).render("reporter/dashboard", {
            pageTitle: "אזור הכתב",
            articles: [],
            errorMessage: "לא ניתן היה לטעון את הכתבות. נסו שוב מאוחר יותר."
        });
    }
}

function renderNewArticle(req, res) {
    return res.render("reporter/editArticle", {
        pageTitle: "כתבה חדשה",
        article: {
            id: "",
            status: "draft",
            statusLabel: "בהכנה",
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
        return res.status(404).render("notFound", { pageTitle: "הכתבה לא נמצאה" });
    }

    try {
        const article = await Article.findOne({ _id: articleId, author: req.user.userID }).lean();

        if (!article) {
            return res.status(404).render("notFound", { pageTitle: "הכתבה לא נמצאה" });
        }

        const articleForView = serializeArticle(article);

        return res.render("reporter/editArticle", {
            pageTitle: articleForView.workingVersion.title || "עריכת כתבה",
            article: articleForView,
            isNew: false,
            isEditable: ["draft", "returned"].includes(article.status)
        });
    } catch (error) {
        console.error("Failed to load reporter article:", error.message);
        return res.status(500).render("notFound", { pageTitle: "שגיאה בטעינת הכתבה" });
    }
}

async function getReporterArticles(req, res) {
    try {
        const articles = await Article.find({ author: req.user.userID }).sort({ updatedAt: -1 }).lean();

        return res.status(200).json({
            success: true,
            data: { items: articles.map(serializeArticle) },
            message: ""
        });
    } catch (error) {
        console.error("Failed to get reporter articles:", error.message);
        return sendApiError(res, 500, "לא ניתן היה לטעון את הכתבות");
    }
}

async function getReporterArticleById(req, res) {
    const articleId = req.params.id;

    if (!mongoose.isValidObjectId(articleId)) {
        return sendApiError(res, 400, "מזהה הכתבה אינו תקין");
    }

    try {
        const article = await Article.findOne({ _id: articleId, author: req.user.userID }).lean();

        if (!article) {
            return sendApiError(res, 404, "הכתבה לא נמצאה");
        }

        return res.status(200).json({
            success: true,
            data: { article: serializeArticle(article) },
            message: ""
        });
    } catch (error) {
        console.error("Failed to get reporter article:", error.message);
        return sendApiError(res, 500, "לא ניתן היה לטעון את הכתבה");
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
            message: "הטיוטה נוצרה בהצלחה"
        });
    } catch (error) {
        console.error("Failed to create reporter article:", error.message);

        if (error.name === "ValidationError") {
            return sendApiError(res, 400, "הנתונים שהוזנו אינם תקינים", getValidationErrors(error));
        }

        return sendApiError(res, 500, "לא ניתן היה ליצור את הכתבה");
    }
}

async function saveReporterDraft(req, res) {
    const articleId = req.params.id;

    if (!mongoose.isValidObjectId(articleId)) {
        return sendApiError(res, 400, "מזהה הכתבה אינו תקין");
    }

    try {
        const article = await Article.findOne({ _id: articleId, author: req.user.userID });

        if (!article) {
            return sendApiError(res, 404, "הכתבה לא נמצאה");
        }

        if (!["draft", "returned"].includes(article.status)) {
            return sendApiError(res, 400, "לא ניתן לערוך כתבה במצב הנוכחי");
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
            message: "הטיוטה נשמרה בהצלחה"
        });
    } catch (error) {
        console.error("Failed to save reporter draft:", error.message);

        if (error.name === "ValidationError") {
            return sendApiError(res, 400, "הנתונים שהוזנו אינם תקינים", getValidationErrors(error));
        }

        return sendApiError(res, 500, "לא ניתן היה לשמור את הכתבה");
    }
}

function validateArticleForSubmission(workingVersion) {
    const requiredFields = [
        { name: "title", label: "כותרת" },
        { name: "summary", label: "תקציר" },
        { name: "content", label: "תוכן" },
        { name: "category", label: "קטגוריה" },
        { name: "mainImage", label: "תמונה ראשית" }
    ];

    return requiredFields
        .filter((field) => !workingVersion[field.name] || !workingVersion[field.name].trim())
        .map((field) => `השדה ${field.label} הוא שדה חובה`);
}

async function submitReporterArticle(req, res) {
    const articleId = req.params.id;

    if (!mongoose.isValidObjectId(articleId)) {
        return sendApiError(res, 400, "מזהה הכתבה אינו תקין");
    }

    try {
        const article = await Article.findOne({ _id: articleId, author: req.user.userID });

        if (!article) {
            return sendApiError(res, 404, "הכתבה לא נמצאה");
        }

        if (!["draft", "returned"].includes(article.status)) {
            return sendApiError(res, 400, "לא ניתן לשלוח את הכתבה לאישור במצב הנוכחי");
        }

        const validationErrors = validateArticleForSubmission(article.workingVersion);

        if (validationErrors.length > 0) {
            return sendApiError(res, 400, "יש להשלים את כל שדות הכתבה לפני השליחה", validationErrors);
        }

        article.status = "pending";
        article.editorNote = "";
        await article.save();

        return res.status(200).json({
            success: true,
            data: { article: { id: article._id.toString(), status: article.status } },
            message: "הכתבה נשלחה לאישור העורך"
        });
    } catch (error) {
        console.error("Failed to submit reporter article:", error.message);
        return sendApiError(res, 500, "לא ניתן היה לשלוח את הכתבה לאישור");
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
    submitReporterArticle
};
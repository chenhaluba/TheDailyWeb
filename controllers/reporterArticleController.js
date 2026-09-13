const Article = require("../models/Article");

const statusDetails = {
    draft: {
        label: "בהכנה",
        cssClass: "draft"
    },
    pending: {
        label: "ממתינה לאישור עורך",
        cssClass: "pending"
    },
    published: {
        label: "פורסמה",
        cssClass: "published"
    },
    returned: {
        label: "הוחזרה לתיקונים",
        cssClass: "returned"
    }
};

function formatDate(date) {
    if (!date) {
        return "טרם נשמרה";
    }

    return new Intl.DateTimeFormat("he-IL", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(new Date(date));
}

function createArticleViewModel(article) {
    const workingVersion = article.workingVersion || {};
    const publishedVersion = article.publishedVersion || {};

    const title =
        workingVersion.title ||
        publishedVersion.title ||
        "כתבה ללא כותרת";

    const savedAt =
        workingVersion.savedAt ||
        article.updatedAt;

    const status =
        statusDetails[article.status] ||
        {
            label: article.status,
            cssClass: "unknown"
        };

    return {
        id: article._id.toString(),
        title,
        status: article.status,
        statusLabel: status.label,
        statusClass: status.cssClass,
        editorNote: article.editorNote,
        savedAt: formatDate(savedAt),
        canEdit: ["draft", "returned"].includes(article.status),
        canStartUpdate: article.status === "published"
    };
}

async function renderDashboard(req, res) {
    try {
        const articles = await Article.find({
            author: req.user.userID
        })
            .sort({ updatedAt: -1 })
            .lean();

        const articlesForView = articles.map(createArticleViewModel);

        return res.render("reporter/dashboard", {
            pageTitle: "אזור הכתב",
            articles: articlesForView,
            errorMessage: ""
        });
    } catch (error) {
        console.error(
            "Failed to load reporter articles:",
            error.message
        );

        return res.status(500).render("reporter/dashboard", {
            pageTitle: "אזור הכתב",
            articles: [],
            errorMessage: "לא ניתן היה לטעון את הכתבות. נסו שוב מאוחר יותר."
        });
    }
}

module.exports = {
    renderDashboard
};
const {
    ARTICLE_STATUS,
    CATEGORIES,
    isEditableStatus,
    serializeArticle,
    getDashboardData,
    isValidArticleId,
    findOwnedArticle
} = require("../services/reporterArticleService");

const emptyStatusCounts = { draft: 0, pending: 0, published: 0, returned: 0 };

async function renderDashboard(req, res) {
    try {
        const { articles, statusCounts } = await getDashboardData(req.user.userID);
        return res.render("reporter/dashboard", {
            pageTitle: "Reporter Dashboard",
            articles,
            statusCounts,
            errorMessage: ""
        });
    } catch (error) {
        console.error("Failed to load reporter articles:", error.message);
        return res.status(500).render("reporter/dashboard", {
            pageTitle: "Reporter Dashboard",
            articles: [],
            statusCounts: emptyStatusCounts,
            errorMessage: "Failed to load articles. Please try again later."
        });
    }
}

function renderNewArticle(req, res) {
    return res.render("reporter/editArticle", {
        pageTitle: "New Article",
        article: {
            id: "",
            status: ARTICLE_STATUS.DRAFT,
            statusLabel: "Draft",
            statusClass: "draft",
            workingVersion: { title: "", summary: "", content: "", category: "", mainImage: "" },
            publishedVersion: null,
            editorNote: ""
        },
        categories: CATEGORIES,
        isNew: true,
        isEditable: true
    });
}

async function renderEditArticle(req, res) {
    const articleId = req.params.id;
    if (!isValidArticleId(articleId)) {
        return res.status(404).render("notFound", { pageTitle: "Article Not Found" });
    }

    try {
        const article = await findOwnedArticle(articleId, req.user.userID, { lean: true });
        if (!article) return res.status(404).render("notFound", { pageTitle: "Article Not Found" });

        const articleForView = serializeArticle(article);
        return res.render("reporter/editArticle", {
            pageTitle: articleForView.workingVersion.title || "Edit Article",
            article: articleForView,
            categories: CATEGORIES,
            isNew: false,
            isEditable: isEditableStatus(article.status)
        });
    } catch (error) {
        console.error("Failed to load reporter article:", error.message);
        return res.status(500).render("notFound", { pageTitle: "Error Loading Article" });
    }
}

module.exports = { renderDashboard, renderNewArticle, renderEditArticle };

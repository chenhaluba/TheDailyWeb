const articleWorkflowService = require("../services/articleWorkflowService");

function sendError(res, error, fallbackMessage) {
    if (error.name === "CastError") {
        return res.status(404).json({
            success: false,
            message: "Article not found",
            errors: []
        });
    }

    if (error.statusCode) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message,
            errors: []
        });
    }

    console.error(fallbackMessage, error);

    return res.status(500).json({
        success: false,
        message: "Internal Server Error",
        errors: []
    });
}

exports.getEditorArticles = async (req, res) => {
    try {
        const { status = "" } = req.query;

        const articles =
            await articleWorkflowService.getEditorArticles(status);

        return res.status(200).json({
            success: true,
            data: articles,
            message: ""
        });

    } catch (error) {
        return sendError(
            res,
            error,
            "Failed to load editor articles:"
        );
    }
};

exports.getEditorArticleById = async (req, res) => {
    try {
        const article =
            await articleWorkflowService.getEditorArticleById(
                req.params.id
            );

        if (!article) {
            return res.status(404).json({
                success: false,
                message: "Article not found",
                errors: []
            });
        }

        return res.status(200).json({
            success: true,
            data: article,
            message: ""
        });

    } catch (error) {
        return sendError(
            res,
            error,
            "Failed to load editor article:"
        );
    }
};

exports.updateEditorArticle = async (req, res) => {
    try {
        const article =
            await articleWorkflowService.updateWorkingVersion(
                req.params.id,
                req.body
            );

        return res.status(200).json({
            success: true,
            data: article,
            message: "Article updated successfully"
        });

    } catch (error) {
        return sendError(
            res,
            error,
            "Failed to update editor article:"
        );
    }
};

exports.approveArticle = async (req, res) => {
    try {
        const article =
            await articleWorkflowService.approveArticle(
                req.params.id,
                req.user.userID
            );

        return res.status(200).json({
            success: true,
            data: article,
            message: "Article approved successfully"
        });

    } catch (error) {
        return sendError(
            res,
            error,
            "Failed to approve article:"
        );
    }
};

exports.returnArticle = async (req, res) => {
    try {
        const article =
            await articleWorkflowService.returnArticle(
                req.params.id,
                req.body.editorNote
            );

        return res.status(200).json({
            success: true,
            data: article,
            message: "Article returned for corrections"
        });

    } catch (error) {
        return sendError(
            res,
            error,
            "Failed to return article:"
        );
    }
};

exports.deleteArticle = async (req, res) => {
    try {
        const article =
            await articleWorkflowService.deleteArticle(
                req.params.id
            );

        return res.status(200).json({
            success: true,
            data: article,
            message: "Article deleted successfully"
        });

    } catch (error) {
        return sendError(
            res,
            error,
            "Failed to delete article:"
        );
    }
};

exports.renderDashboard = async (req, res) => {
    try {
        const articles =
            await articleWorkflowService.getEditorArticles();

        const statusCounts = {
            draft: 0,
            pending: 0,
            published: 0,
            returned: 0
        };

        for (const article of articles) {
            if (statusCounts[article.status] !== undefined) {
                statusCounts[article.status]++;
            }
        }

        return res.render("editor/dashboard", {
            pageTitle: "Editor Dashboard",
            articles,
            statusCounts,
            errorMessage: ""
        });

    } catch (error) {
        console.error("Failed to load editor dashboard:", error);

        return res.status(500).render("editor/dashboard", {
            pageTitle: "Editor Dashboard",
            articles: [],
            statusCounts: {
                draft: 0,
                pending: 0,
                published: 0,
                returned: 0
            },
            errorMessage: "Failed to load articles. Please try again later."
        });
    }
};
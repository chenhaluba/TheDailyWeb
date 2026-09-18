const mongoose = require("mongoose");
const analyticsService = require("../services/analyticsService");

function sendError(res, status, message, errors = []) {
    return res.status(status).json({
        success: false,
        message,
        errors
    });
}

function renderAnalyticsPage(req, res) {
    return res.render("editor/analytics", {
        pageTitle: "Impact Analytics"
    });
}

async function recordView(req, res) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return sendError(res, 400, "Invalid article ID");
    }

    try {
        await analyticsService.recordView(id);

        return res.status(200).json({
            success: true,
            data: {},
            message: ""
        });
    } catch (error) {
        if (error.statusCode) {
            return sendError(res, error.statusCode, error.message);
        }

        console.error("Failed to record view:", error.message);
        return sendError(res, 500, "Failed to record view");
    }
}

async function getArticleAnalytics(req, res) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return sendError(res, 400, "Invalid article ID");
    }

    const { from, to } = req.query;

    try {
        const data = await analyticsService.getArticleAnalytics(id, from, to);

        return res.status(200).json({
            success: true,
            data,
            message: ""
        });
    } catch (error) {
        if (error.statusCode) {
            return sendError(res, error.statusCode, error.message);
        }

        console.error("Failed to retrieve analytics:", error.message);
        return sendError(res, 500, "Failed to retrieve analytics");
    }
}

async function updateStatistic(req, res) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return sendError(res, 400, "Invalid view statistic ID");
    }

    const updates = req.body || {};

    try {
        const data = await analyticsService.updateStatistic(id, updates);

        return res.status(200).json({
            success: true,
            data,
            message: "View statistic updated successfully"
        });
    } catch (error) {
        if (error.statusCode) {
            return sendError(res, error.statusCode, error.message);
        }

        console.error("Failed to update view statistic:", error.message);
        return sendError(res, 500, "Failed to update view statistic");
    }
}

async function deleteStatistic(req, res) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return sendError(res, 400, "Invalid view statistic ID");
    }

    try {
        const data = await analyticsService.deleteStatistic(id);

        return res.status(200).json({
            success: true,
            data,
            message: "View statistic deleted successfully"
        });
    } catch (error) {
        if (error.statusCode) {
            return sendError(res, error.statusCode, error.message);
        }

        console.error("Failed to delete view statistic:", error.message);
        return sendError(res, 500, "Failed to delete view statistic");
    }
}

module.exports = {
    renderAnalyticsPage,
    recordView,
    getArticleAnalytics,
    updateStatistic,
    deleteStatistic
};

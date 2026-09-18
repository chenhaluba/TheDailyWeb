const express = require("express");
const router = express.Router();

const analyticsController = require("../controllers/analyticsController");
const { validateSession } = require("../middleware/authMiddleware");
const { validateRole } = require("../middleware/roleMiddleware");

router.get(
    "/editor/analytics",
    validateSession,
    validateRole("editor"),
    analyticsController.renderAnalyticsPage
);

router.post(
    "/api/articles/:id/view",
    analyticsController.recordView
);

router.get(
    "/api/analytics/articles/:id",
    validateSession,
    validateRole("editor"),
    analyticsController.getArticleAnalytics
);

router.patch(
    "/api/analytics/:id",
    validateSession,
    validateRole("editor"),
    analyticsController.updateStatistic
);

router.delete(
    "/api/analytics/:id",
    validateSession,
    validateRole("editor"),
    analyticsController.deleteStatistic
);

module.exports = router;

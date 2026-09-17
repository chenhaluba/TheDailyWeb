const express = require("express");
const { validateSession } = require("../middleware/authMiddleware");
const { validateRole } = require("../middleware/roleMiddleware");
const {
    renderDashboard,
    renderNewArticle,
    renderEditArticle
} = require("../controllers/reporterPageController");

const router = express.Router();

router.use(validateSession);
router.use(validateRole("reporter"));
router.get("/dashboard", renderDashboard);
router.get("/articles/new", renderNewArticle);
router.get("/articles/:id/edit", renderEditArticle);

module.exports = router;

const express = require("express");
const { validateSession } = require("../middleware/authMiddleware");
const { validateRole } = require("../middleware/roleMiddleware");
const {
    getReporterArticles,
    getReporterArticleById,
    createReporterArticle,
    saveReporterDraft,
    submitReporterArticle
} = require("../controllers/reporterArticleController");

const router = express.Router();

router.use(validateSession);
router.use(validateRole("reporter"));

router.get("/", getReporterArticles);
router.get("/:id", getReporterArticleById);
router.post("/", createReporterArticle);
router.patch("/:id/draft", saveReporterDraft);
router.post("/:id/submit", submitReporterArticle);

module.exports = router;
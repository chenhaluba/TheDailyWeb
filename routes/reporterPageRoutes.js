const express = require("express");

const {
    validateSession
} = require("../middleware/authMiddleware");

const {
    validateRole
} = require("../middleware/roleMiddleware");

const {
    renderDashboard
} = require("../controllers/reporterArticleController");

const router = express.Router();

router.use(validateSession);
router.use(validateRole("reporter"));

router.get("/dashboard", renderDashboard);

module.exports = router;
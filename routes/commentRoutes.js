const express = require("express");
const router = express.Router();

const commentController = require("../controllers/commentController");
const { commentRateLimit } = require("../middleware/commentRateLimitMiddleware");
const { validateSession } = require("../middleware/authMiddleware");
const { validateRole } = require("../middleware/roleMiddleware");

router.get(
    "/api/articles/:articleId/comments",
    commentController.getComments
);

router.post(
    "/api/articles/:articleId/comments",
    commentRateLimit,
    commentController.createComment
);

router.patch(
    "/api/comments/:id",
    validateSession,
    validateRole("editor"),
    commentController.updateComment
);

router.delete(
    "/api/comments/:id",
    validateSession,
    validateRole("editor"),
    commentController.deleteComment
);

module.exports = router;

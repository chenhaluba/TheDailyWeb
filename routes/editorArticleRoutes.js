const express = require("express");
const router = express.Router();

const editorArticleController =
    require("../controllers/editorArticleController");

const {
    validateSession
} = require("../middleware/authMiddleware");

const {
    validateRole
} = require("../middleware/roleMiddleware");

router.get(
    "/api/editor/articles",
    validateSession,
    validateRole("editor"),
    editorArticleController.getEditorArticles
);

router.get(
    "/api/editor/articles/:id",
    validateSession,
    validateRole("editor"),
    editorArticleController.getEditorArticleById
);

router.patch(
    "/api/editor/articles/:id",
    validateSession,
    validateRole("editor"),
    editorArticleController.updateEditorArticle
);

router.post(
    "/api/editor/articles/:id/approve",
    validateSession,
    validateRole("editor"),
    editorArticleController.approveArticle
);

router.post(
    "/api/editor/articles/:id/return",
    validateSession,
    validateRole("editor"),
    editorArticleController.returnArticle
);

router.delete(
    "/api/editor/articles/:id",
    validateSession,
    validateRole("editor"),
    editorArticleController.deleteArticle
);

module.exports = router;
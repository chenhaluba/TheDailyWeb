const express = require("express");
const router = express.Router();

const articleController = require("../controllers/articleController");

router.get("/", articleController.getHomePage);

router.get("/articles/:id", articleController.getArticlePage);

module.exports = router;
const mongoose = require("mongoose");
const CONSTANTS = require("../config/constants");
const articleService = require("../services/articleService");
const weatherController = require("./weatherController");

exports.getHomePage = async (req, res) => {
    try {

        const [data, weather] = await Promise.all([
            articleService.getHomePageData(req.query),
            getWeatherData()
        ]);

        return res.render("public/home", {
            pageTitle: "The Daily Web",
            weather,
            ...data
        });

    } catch (error) {

        if (error.message === "Invalid category") {
            return res.status(404).render("notFound", {
                pageTitle: "Category Not Found"
            });
        }

        console.error("Failed to load home page:", error);

        return res.status(500).send("Internal Server Error");
    }
};

exports.getArticlePage = async (req, res) => {

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).render("notFound", {
            pageTitle: "Article Not Found"
        });
    }

    try {

        const article = await articleService.getArticleById(req.params.id);

        if (!article) {
            return res.status(404).render("notFound", {
                pageTitle: "Article Not Found"
            });
        }

        return res.render("public/article", {
            pageTitle: article.publishedVersion.title,
            article,
            search: "",
            category: "",
            sort: CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST
        });

    } catch (error) {

        console.error("Failed to load article:", error);
        return res.status(500).send("Internal Server Error");
    }
};

exports.getArticles = async (req, res) => {

    try {

        const data = await articleService.getFeed(req.query);

        return res.status(200).json({
            success: true,
            data,
            message: ""
        });

    } catch (error) {

        if (error.message === "Invalid category") {
            return res.status(404).json({
                success: false,
                message: "Category Not Found",
                errors: []
            });
        }

        console.error("Failed to load articles:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            errors: []
        });
    }
};
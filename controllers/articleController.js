const Article = require("../models/Article");
const CONSTANTS = require("../config/constants");


async function fetchPublishedArticles(filter = {}, options = {}) {
    const {
        limit = 20,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    return await Article.find(filter)
        .populate("author", "displayName")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
}

exports.getHomePage = async (req, res) => {
    try {
        const articles = await fetchPublishedArticles(
            { status: CONSTANTS.ARTICLE_STATUS.PUBLISHED },
            { limit: 20 }
        );

        const mainArticle = articles.length ? articles[0] : null;
        const feedArticles = articles.slice(1);

        res.render("public/home", {
            pageTitle: "The Daily Web",
            mainArticle,
            articles: feedArticles
        });

    } catch (error) {
        console.error("Failed to load home page:", error);

        return res.status(500).send("Internal Server Error");
    }
};

exports.getArticlePage = async (req, res) => {
    try {
        const article = await Article.findOne({
            _id: req.params.id,
            status: CONSTANTS.ARTICLE_STATUS.PUBLISHED
        })
            .populate("author", "displayName")
            .lean();

        if (!article) {
            return res.status(404).render("notFound", {
                pageTitle: "Article Not Found"
            });
        }

        res.render("public/article", {
            pageTitle: article.publishedVersion.title,
            article
        });

    } catch (error) {
        console.error("Failed to load article:", error);

        return res.status(500).send("Internal Server Error");
    }
};

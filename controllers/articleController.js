const mongoose = require("mongoose");
const Article = require("../models/Article");
const CONSTANTS = require("../config/constants");

const DEFAULT_LIMIT = 20;

const SORT_OPTIONS = {
    [CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST]: {
        createdAt: -1
    },
    [CONSTANTS.ARTICLE_SORT_OPTIONS.POPULAR]: {
        totalViews: -1,
        createdAt: -1
    }
};

async function getPublishedArticles(filter = {}, options = {}) {
    const {
        limit = DEFAULT_LIMIT,
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

const escapeRegex = (text = "") =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildArticleQuery({
    search = "",
    category = "",
    sort = CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST
} = {}) {

    const cleanSearch = search.trim();

    if (
        category &&
        !CONSTANTS.CATEGORIES.includes(category)
    ) {
        throw new Error("Invalid category");
    }

    const filter = {
        status: CONSTANTS.ARTICLE_STATUS.PUBLISHED
    };

    if (cleanSearch) {
        filter["publishedVersion.title"] = {
            $regex: escapeRegex(cleanSearch),
            $options: "i"
        };
    }

    if (category) {
        filter["publishedVersion.category"] = category;
    }

    return {
        search: cleanSearch,
        category,
        sort,
        filter,
        sortOption:
            SORT_OPTIONS[sort] ||
            SORT_OPTIONS[CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST]
    };
}

exports.getHomePage = async (req, res) => {
    try {
        const {
            search,
            category,
            sort,
            filter,
            sortOption
        } = buildArticleQuery(req.query);

        const articles = await getPublishedArticles(filter, {
            limit: DEFAULT_LIMIT + 1,
            sort: sortOption
        });

        const showMainArticle = !search && !category;

        const mainArticle = showMainArticle
            ? articles[0] || null
            : null;
        
        const feedArticles = showMainArticle
            ? articles.slice(1)
            : articles;
            
        res.render("public/home", {
            pageTitle: "The Daily Web",
            mainArticle,
            articles: feedArticles,
            search,
            category,
            sort,
            resultsCount: showMainArticle
            ? feedArticles.length
            : articles.length        
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

        const page = Number.parseInt(req.query.page, 10) || 1;

        const limit = Math.min(
            Number.parseInt(req.query.limit, 10) || DEFAULT_LIMIT,
            DEFAULT_LIMIT
        );
        
        const safePage = Math.max(page, 1);
        const safeLimit = Math.max(limit, 1);
        
        const skip = (safePage - 1) * safeLimit;

        const {
            filter,
            sortOption
        } = buildArticleQuery(req.query);

        const articles = await getPublishedArticles(filter, {
            skip,
            limit: safeLimit + 1,
            sort: sortOption
        });

        const hasMore = articles.length > safeLimit;

        if (hasMore) {
            articles.pop();
        }

        return res.status(200).json({
            success: true,
            data: {
                items: articles,
                pagination: {
                    page: safePage,
                    limit: safeLimit,
                    hasMore
                }
            },
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
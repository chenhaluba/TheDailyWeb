const Article = require("../models/Article");
const CONSTANTS = require("../config/constants");

async function getPublishedArticles(filter = {}, options = {}) {
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

function escapeRegex(text = "") {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildArticleQuery(query) {

    const search = (query.search || "").trim();

    const category = query.category || "";
    
    if (
        category &&
        !CONSTANTS.CATEGORIES.includes(category)
    ) {
        throw new Error("Invalid category");
    }

    const sort =
        query.sort || CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST;

    const filter = {
        status: CONSTANTS.ARTICLE_STATUS.PUBLISHED
    };

    if (search) {
        filter["publishedVersion.title"] = {
            $regex: escapeRegex(search),
            $options: "i"
        };
    }

    if (category) {
        filter["publishedVersion.category"] = category;
    }

    const sortOptions = {
        [CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST]: {
            createdAt: -1
        },
        [CONSTANTS.ARTICLE_SORT_OPTIONS.POPULAR]: {
            totalViews: -1
        }
    };

    return {
        search,
        category,
        sort,
        filter,
        sortOption:
            sortOptions[sort] ||
            sortOptions[CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST]
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
            limit: 20,
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
            resultsCount: articles.length
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
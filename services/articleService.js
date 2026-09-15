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

function escapeRegex(text = "") {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
            SORT_OPTIONS[sort] ??
            SORT_OPTIONS[CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST]
    };
}

async function getPublishedArticles(filter = {}, options = {}) {

    const {
        limit = DEFAULT_LIMIT,
        skip = 0,
        sort = SORT_OPTIONS[CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST]
    } = options;

    return Article.find(filter)
        .populate("author", "displayName")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
}

async function getHomePageData(query = {}) {

    const {
        search,
        category,
        sort,
        filter,
        sortOption
    } = buildArticleQuery(query);

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

    return {
        mainArticle,
        articles: feedArticles,
        search,
        category,
        sort,
        resultsCount: showMainArticle
            ? feedArticles.length
            : articles.length
    };
}

async function getFeed(query = {}) {

    const page = Math.max(
        Number.parseInt(query.page, 10) || 1,
        1
    );

    const limit = Math.max(
        Math.min(
            Number.parseInt(query.limit, 10) || DEFAULT_LIMIT,
            DEFAULT_LIMIT
        ),
        1
    );

    const skip = (page - 1) * limit;

    const {
        filter,
        sortOption
    } = buildArticleQuery(query);

    const articles = await getPublishedArticles(filter, {
        skip,
        limit: limit + 1,
        sort: sortOption
    });

    const hasMore = articles.length > limit;

    if (hasMore) {
        articles.pop();
    }

    return {
        items: articles,
        pagination: {
            page,
            limit,
            hasMore
        }
    };
}

async function getArticleById(id) {

    return Article.findOne({
        _id: id,
        status: CONSTANTS.ARTICLE_STATUS.PUBLISHED
    })
        .populate("author", "displayName")
        .lean();
}

module.exports = {
    getHomePageData,
    getFeed,
    getArticleById
};
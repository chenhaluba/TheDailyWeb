const Article = require("../models/Article");
const CONSTANTS = require("../config/constants");

const DEFAULT_LIMIT = 20;

const SORT_OPTIONS = {
    [CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST]: {
        "publishedVersion.savedAt": -1,
        _id: -1
    },
    [CONSTANTS.ARTICLE_SORT_OPTIONS.POPULAR]: {
        totalViews: -1,
        "publishedVersion.savedAt": -1,
        _id: -1
    }
};

const PUBLIC_ARTICLE_FILTER = {
    publishedVersion: { $ne: null }
};

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQueryValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function buildArticleQuery(query = {}) {
    const search = normalizeQueryValue(query.search);
    const category = normalizeQueryValue(query.category);
    const requestedSort = normalizeQueryValue(query.sort);

    const sort = Object.values(
        CONSTANTS.ARTICLE_SORT_OPTIONS
    ).includes(requestedSort)
        ? requestedSort
        : CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST;

    if (category && !CONSTANTS.CATEGORIES.includes(category)) {
        throw new Error("Invalid category");
    }

    const filter = {
        ...PUBLIC_ARTICLE_FILTER
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

    return {
        search,
        category,
        sort,
        filter,
        sortOption: SORT_OPTIONS[sort]
    };
}

async function getPublishedArticles(filter, options = {}) {
    const {
        limit = DEFAULT_LIMIT,
        skip = 0,
        sort = SORT_OPTIONS[CONSTANTS.ARTICLE_SORT_OPTIONS.NEWEST]
    } = options;

    return Article.find(filter)
        .select("_id publishedVersion author totalViews")
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

    // Fetch one extra article to check whether another page exists.
    const hasMore = articles.length > DEFAULT_LIMIT;

    if (hasMore) {
        articles.pop();
    }

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
        hasMore,
        resultsCount: feedArticles.length
    };
}

async function getFeed(query = {}) {
    const requestedPage = Number.parseInt(
        normalizeQueryValue(query.page),
        10
    );

    const page =
        Number.isSafeInteger(requestedPage) && requestedPage > 0
            ? requestedPage
            : 1;

    const requestedLimit = Number.parseInt(
        normalizeQueryValue(query.limit),
        10
    );

    const limit = Math.max(
        Math.min(requestedLimit || DEFAULT_LIMIT, DEFAULT_LIMIT),
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
        ...PUBLIC_ARTICLE_FILTER
    })
        .select("_id publishedVersion author totalViews")
        .populate("author", "displayName")
        .lean();
}

module.exports = {
    getHomePageData,
    getFeed,
    getArticleById
};
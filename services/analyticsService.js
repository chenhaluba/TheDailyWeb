const Article = require("../models/Article");
const ViewStatistic = require("../models/ViewStatistic");

function createAnalyticsError(message, statusCode) {

    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function getHourBucket(date = new Date()) {

    const bucketStart = new Date(date);
    bucketStart.setUTCMinutes(0, 0, 0);
    return bucketStart;
}

async function recordView(articleId) {

    const articleFilter = {
        _id: articleId,
        publishedVersion: { $ne: null }
    };

    const article = await Article.findOne(articleFilter);

    if (!article) {
        throw createAnalyticsError("Published article not found", 404);
    }

    const statistic = await ViewStatistic.findOneAndUpdate(
        {
            article: articleId,
            bucketStart: getHourBucket()
        },
        {
            $inc: { viewCount: 1 }
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            runValidators: true
        }
    );

    await Article.updateOne(
        articleFilter,
        {
            $inc: { totalViews: 1 }
        }
    );

    return statistic;
}

async function getArticleAnalytics(articleId, from, to) {

    const article = await Article.findById(articleId)
        .select("publishedVersion.title workingVersion.title publicationHistory")
        .lean();

    if (!article) {
        throw createAnalyticsError("Article not found", 404);
    }

    const hasFrom = from !== undefined && from !== null && from !== "";
    const hasTo = to !== undefined && to !== null && to !== "";
    let fromDate;
    let toDate;

    try {
        if (hasFrom) fromDate = new Date(from);
        if (hasTo) toDate = new Date(to);
    } catch {
        throw createAnalyticsError("Invalid date range", 400);
    }

    if (
        (hasFrom && Number.isNaN(fromDate.getTime())) ||
        (hasTo && Number.isNaN(toDate.getTime())) ||
        (hasFrom && hasTo && fromDate > toDate)
    ) {
        throw createAnalyticsError("Invalid date range", 400);
    }

    const statisticFilter = {
        article: articleId
    };

    if (hasFrom || hasTo) {
        statisticFilter.bucketStart = {};

        if (hasFrom) statisticFilter.bucketStart.$gte = fromDate;
        if (hasTo) statisticFilter.bucketStart.$lte = toDate;
    }

    const statistics = await ViewStatistic.find(statisticFilter)
        .sort({ bucketStart: 1 })
        .lean();

    const publications = (article.publicationHistory || [])
        .slice()
        .sort((first, second) => first.publishedAt - second.publishedAt)
        .map((publication) => ({
            time: publication.publishedAt,
            versionNumber: publication.versionNumber
        }));

    return {
        article: {
            id: article._id,
            title:
                article.publishedVersion?.title ||
                article.workingVersion?.title ||
                ""
        },
        views: statistics.map((statistic) => ({
            time: statistic.bucketStart,
            count: statistic.viewCount
        })),
        publications
    };
}

async function updateStatistic(id, updates = {}) {

    const fields = Object.keys(updates);
    const allowedFields = ["viewCount", "bucketStart"];

    if (fields.length === 0) {
        throw createAnalyticsError("No update fields were provided", 400);
    }

    if (fields.some((field) => !allowedFields.includes(field))) {
        throw createAnalyticsError(
            "Only viewCount and bucketStart may be updated",
            400
        );
    }

    const validatedUpdates = {};

    if (fields.includes("viewCount")) {
        if (
            typeof updates.viewCount !== "number" ||
            !Number.isInteger(updates.viewCount) ||
            updates.viewCount < 0
        ) {
            throw createAnalyticsError(
                "viewCount must be a non-negative integer",
                400
            );
        }

        validatedUpdates.viewCount = updates.viewCount;
    }

    if (fields.includes("bucketStart")) {
        let bucketStart;

        try {
            bucketStart = new Date(updates.bucketStart);
        } catch {
            throw createAnalyticsError(
                "bucketStart must be a valid date",
                400
            );
        }

        if (Number.isNaN(bucketStart.getTime())) {
            throw createAnalyticsError(
                "bucketStart must be a valid date",
                400
            );
        }

        validatedUpdates.bucketStart = bucketStart;
    }

    const statistic = await ViewStatistic.findByIdAndUpdate(
        id,
        {
            $set: validatedUpdates
        },
        {
            new: true,
            runValidators: true
        }
    );

    if (!statistic) {
        throw createAnalyticsError("View statistic not found", 404);
    }

    return statistic;
}

async function deleteStatistic(id) {

    const statistic = await ViewStatistic.findByIdAndDelete(id);

    if (!statistic) {
        throw createAnalyticsError("View statistic not found", 404);
    }

    return statistic;
}

module.exports = {
    recordView,
    getArticleAnalytics,
    updateStatistic,
    deleteStatistic
};

require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env")
});

const mongoose = require("mongoose");

const analyticsService = require("../services/analyticsService");
const User = require("../models/User");
const Article = require("../models/Article");
const Comment = require("../models/Comment");
const ViewStatistic = require("../models/ViewStatistic");

const REPORTER_ID = new mongoose.Types.ObjectId("7a2200000000000000000001");
const EDITOR_ID = new mongoose.Types.ObjectId("7a2200000000000000000002");
const PUBLISHED_ARTICLE_ID = new mongoose.Types.ObjectId("7a2200000000000000000011");
const UNPUBLISHED_ARTICLE_ID = new mongoose.Types.ObjectId("7a2200000000000000000012");
const MISSING_ARTICLE_ID = new mongoose.Types.ObjectId("7a2200000000000000000013");
const FIRST_STATISTIC_ID = new mongoose.Types.ObjectId("7a2200000000000000000021");
const SECOND_STATISTIC_ID = new mongoose.Types.ObjectId("7a2200000000000000000022");
const THIRD_STATISTIC_ID = new mongoose.Types.ObjectId("7a2200000000000000000023");
const UPDATE_STATISTIC_ID = new mongoose.Types.ObjectId("7a2200000000000000000024");
const DELETE_STATISTIC_ID = new mongoose.Types.ObjectId("7a2200000000000000000025");
const MISSING_STATISTIC_ID = new mongoose.Types.ObjectId("7a2200000000000000000026");

const REPORTER_USERNAME = "test_analytics_service_reporter";
const EDITOR_USERNAME = "test_analytics_service_editor";
const TEST_USER_IDS = [REPORTER_ID, EDITOR_ID];
const TEST_USERNAMES = [REPORTER_USERNAME, EDITOR_USERNAME];
const TEST_ARTICLE_IDS = [PUBLISHED_ARTICLE_ID, UNPUBLISHED_ARTICLE_ID];
const TEST_STATISTIC_IDS = [
    FIRST_STATISTIC_ID,
    SECOND_STATISTIC_ID,
    THIRD_STATISTIC_ID,
    UPDATE_STATISTIC_ID,
    DELETE_STATISTIC_ID,
    MISSING_STATISTIC_ID
];

function getHourBucket(date) {
    const bucketStart = new Date(date);
    bucketStart.setUTCMinutes(0, 0, 0);
    return bucketStart;
}

async function cleanupFixtures() {
    await Comment.deleteMany({
        article: { $in: TEST_ARTICLE_IDS }
    });

    await ViewStatistic.deleteMany({
        $or: [
            { article: { $in: TEST_ARTICLE_IDS } },
            { _id: { $in: TEST_STATISTIC_IDS } }
        ]
    });

    await Article.deleteMany({
        _id: { $in: TEST_ARTICLE_IDS }
    });

    await User.deleteMany({
        $or: [
            { _id: { $in: TEST_USER_IDS } },
            { username: { $in: TEST_USERNAMES } }
        ]
    });
}

async function resetAnalyticsState() {
    await ViewStatistic.deleteMany({
        article: { $in: TEST_ARTICLE_IDS }
    });

    await Article.updateMany(
        { _id: { $in: TEST_ARTICLE_IDS } },
        { $set: { totalViews: 0 } }
    );
}

describe("Analytics Service", () => {

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI);
        await cleanupFixtures();

        await User.insertMany([
            {
                _id: REPORTER_ID,
                username: REPORTER_USERNAME,
                passwordHash: "analytics-service-reporter-hash",
                displayName: "Analytics Service Reporter",
                role: "reporter",
                isActive: true
            },
            {
                _id: EDITOR_ID,
                username: EDITOR_USERNAME,
                passwordHash: "analytics-service-editor-hash",
                displayName: "Analytics Service Editor",
                role: "editor",
                isActive: true
            }
        ]);

        const firstPublishedAt = new Date("2024-01-01T08:00:00.000Z");
        const secondPublishedAt = new Date("2024-01-03T08:00:00.000Z");
        const articleVersion = {
            title: "Analytics Service Fixture Article",
            summary: "A dedicated article used by analytics service tests.",
            content: "Dedicated analytics service fixture content.",
            category: "Technology",
            mainImage: "image2.jpg",
            savedAt: secondPublishedAt
        };

        await Article.insertMany([
            {
                _id: PUBLISHED_ARTICLE_ID,
                author: REPORTER_ID,
                status: "published",
                publishedVersion: articleVersion,
                workingVersion: articleVersion,
                publicationHistory: [
                    {
                        publishedAt: secondPublishedAt,
                        approvedBy: EDITOR_ID,
                        versionNumber: 2
                    },
                    {
                        publishedAt: firstPublishedAt,
                        approvedBy: EDITOR_ID,
                        versionNumber: 1
                    }
                ],
                totalViews: 0,
                createdAt: new Date("2023-12-31T08:00:00.000Z"),
                updatedAt: secondPublishedAt
            },
            {
                _id: UNPUBLISHED_ARTICLE_ID,
                author: REPORTER_ID,
                status: "draft",
                publishedVersion: null,
                workingVersion: {
                    title: "Unpublished Analytics Service Fixture",
                    summary: "",
                    content: "",
                    category: "Technology",
                    mainImage: "image2.jpg",
                    savedAt: secondPublishedAt
                },
                totalViews: 0
            }
        ]);
    });

    beforeEach(async () => {
        await resetAnalyticsState();
    });

    afterAll(async () => {
        try {
            if (mongoose.connection.readyState !== 0) {
                await cleanupFixtures();
            }
        } finally {
            await mongoose.disconnect();
        }
    });

    test("recordView rejects a valid missing article ID", async () => {
        await expect(
            analyticsService.recordView(MISSING_ARTICLE_ID)
        ).rejects.toMatchObject({
            message: "Published article not found",
            statusCode: 404
        });
    });

    test("recordView rejects an unpublished article", async () => {
        await expect(
            analyticsService.recordView(UNPUBLISHED_ARTICLE_ID)
        ).rejects.toMatchObject({
            message: "Published article not found",
            statusCode: 404
        });

        const statistics = await ViewStatistic.find({
            article: UNPUBLISHED_ARTICLE_ID
        });
        expect(statistics).toHaveLength(0);
    });

    test("recordView creates the current UTC-hour bucket and increments totalViews", async () => {
        const earliestBucket = getHourBucket(new Date());
        const statistic = await analyticsService.recordView(PUBLISHED_ARTICLE_ID);
        const latestBucket = getHourBucket(new Date());

        expect([
            earliestBucket.getTime(),
            latestBucket.getTime()
        ]).toContain(statistic.bucketStart.getTime());
        expect(statistic.viewCount).toBe(1);

        const article = await Article.findById(PUBLISHED_ARTICLE_ID).lean();
        expect(article.totalViews).toBe(1);
    });

    test("repeated recordView calls share one hourly bucket", async () => {
        let result;

        for (let attempt = 0; attempt < 2 && !result; attempt++) {
            await resetAnalyticsState();

            const startBucket = getHourBucket(new Date());
            const firstStatistic = await analyticsService.recordView(
                PUBLISHED_ARTICLE_ID
            );
            const secondStatistic = await analyticsService.recordView(
                PUBLISHED_ARTICLE_ID
            );
            const endBucket = getHourBucket(new Date());

            if (startBucket.getTime() === endBucket.getTime()) {
                result = { firstStatistic, secondStatistic };
            }
        }

        expect(result).toBeDefined();
        expect(result.secondStatistic._id.toString())
            .toBe(result.firstStatistic._id.toString());
        expect(result.secondStatistic.viewCount).toBe(2);

        const statistics = await ViewStatistic.find({
            article: PUBLISHED_ARTICLE_ID
        });
        expect(statistics).toHaveLength(1);

        const article = await Article.findById(PUBLISHED_ARTICLE_ID).lean();
        expect(article.totalViews).toBe(2);
    });

    test("getArticleAnalytics returns sorted dedicated analytics data", async () => {
        const buckets = [
            new Date("2024-02-01T08:00:00.000Z"),
            new Date("2024-02-02T08:00:00.000Z"),
            new Date("2024-02-03T08:00:00.000Z")
        ];

        await ViewStatistic.insertMany([
            {
                _id: THIRD_STATISTIC_ID,
                article: PUBLISHED_ARTICLE_ID,
                bucketStart: buckets[2],
                viewCount: 5
            },
            {
                _id: FIRST_STATISTIC_ID,
                article: PUBLISHED_ARTICLE_ID,
                bucketStart: buckets[0],
                viewCount: 3
            },
            {
                _id: SECOND_STATISTIC_ID,
                article: PUBLISHED_ARTICLE_ID,
                bucketStart: buckets[1],
                viewCount: 4
            }
        ]);

        await Article.updateOne(
            { _id: PUBLISHED_ARTICLE_ID },
            { $set: { totalViews: 12 } }
        );

        const analytics = await analyticsService.getArticleAnalytics(
            PUBLISHED_ARTICLE_ID
        );

        expect(analytics.article.id.toString())
            .toBe(PUBLISHED_ARTICLE_ID.toString());
        expect(analytics.article.title)
            .toBe("Analytics Service Fixture Article");
        expect(analytics.views.map(view => view.time.toISOString()))
            .toEqual(buckets.map(bucket => bucket.toISOString()));
        expect(analytics.views.map(view => view.count)).toEqual([3, 4, 5]);
        expect(analytics.views.reduce((total, view) => total + view.count, 0))
            .toBe(12);
        expect(analytics.publications.map(publication => publication.versionNumber))
            .toEqual([1, 2]);
    });

    test("getArticleAnalytics filters dedicated buckets by from and to", async () => {
        const buckets = [
            new Date("2024-03-01T08:00:00.000Z"),
            new Date("2024-03-02T08:00:00.000Z"),
            new Date("2024-03-03T08:00:00.000Z")
        ];

        await ViewStatistic.insertMany(buckets.map((bucketStart, index) => ({
            _id: TEST_STATISTIC_IDS[index],
            article: PUBLISHED_ARTICLE_ID,
            bucketStart,
            viewCount: index + 1
        })));

        const analytics = await analyticsService.getArticleAnalytics(
            PUBLISHED_ARTICLE_ID,
            buckets[1].toISOString(),
            buckets[1].toISOString()
        );

        expect(analytics.views).toHaveLength(1);
        expect(analytics.views[0].time.toISOString())
            .toBe(buckets[1].toISOString());
        expect(analytics.views[0].count).toBe(2);
    });

    test.each([
        ["invalid from", "not-a-date", undefined],
        ["invalid to", undefined, "not-a-date"],
        [
            "reversed range",
            "2024-04-02T00:00:00.000Z",
            "2024-04-01T00:00:00.000Z"
        ]
    ])("getArticleAnalytics rejects an %s", async (caseName, from, to) => {
        await expect(
            analyticsService.getArticleAnalytics(
                PUBLISHED_ARTICLE_ID,
                from,
                to
            )
        ).rejects.toMatchObject({
            message: "Invalid date range",
            statusCode: 400
        });
    });

    test("getArticleAnalytics rejects a missing article", async () => {
        await expect(
            analyticsService.getArticleAnalytics(MISSING_ARTICLE_ID)
        ).rejects.toMatchObject({
            message: "Article not found",
            statusCode: 404
        });
    });

    test.each([
        ["no fields", {}, "No update fields were provided"],
        [
            "an unsupported field",
            { article: PUBLISHED_ARTICLE_ID },
            "Only viewCount and bucketStart may be updated"
        ],
        ["a negative viewCount", { viewCount: -1 }, "viewCount must be a non-negative integer"],
        ["a fractional viewCount", { viewCount: 1.5 }, "viewCount must be a non-negative integer"],
        ["a string viewCount", { viewCount: "1" }, "viewCount must be a non-negative integer"],
        ["an invalid bucketStart", { bucketStart: "not-a-date" }, "bucketStart must be a valid date"]
    ])("updateStatistic rejects %s", async (caseName, updates, message) => {
        await expect(
            analyticsService.updateStatistic(UPDATE_STATISTIC_ID, updates)
        ).rejects.toMatchObject({
            message,
            statusCode: 400
        });
    });

    test("updateStatistic updates only a dedicated statistic", async () => {
        const originalBucket = new Date("2024-05-01T08:00:00.000Z");
        const updatedBucket = new Date("2024-05-01T12:00:00.000Z");

        await ViewStatistic.create({
            _id: UPDATE_STATISTIC_ID,
            article: PUBLISHED_ARTICLE_ID,
            bucketStart: originalBucket,
            viewCount: 2
        });

        await Article.updateOne(
            { _id: PUBLISHED_ARTICLE_ID },
            { $set: { totalViews: 2 } }
        );

        const statistic = await analyticsService.updateStatistic(
            UPDATE_STATISTIC_ID,
            {
                viewCount: 9,
                bucketStart: updatedBucket.toISOString()
            }
        );

        expect(statistic._id.toString()).toBe(UPDATE_STATISTIC_ID.toString());
        expect(statistic.viewCount).toBe(9);
        expect(statistic.bucketStart.toISOString())
            .toBe(updatedBucket.toISOString());

        const storedStatistic = await ViewStatistic.findById(
            UPDATE_STATISTIC_ID
        ).lean();
        expect(storedStatistic.viewCount).toBe(9);
        expect(storedStatistic.bucketStart.toISOString())
            .toBe(updatedBucket.toISOString());

        const article = await Article.findById(PUBLISHED_ARTICLE_ID).lean();
        expect(article.totalViews).toBe(9);
    });

    test("deleteStatistic deletes only a dedicated statistic", async () => {
        await ViewStatistic.create({
            _id: DELETE_STATISTIC_ID,
            article: PUBLISHED_ARTICLE_ID,
            bucketStart: new Date("2024-06-01T08:00:00.000Z"),
            viewCount: 4
        });

        await Article.updateOne(
            { _id: PUBLISHED_ARTICLE_ID },
            { $set: { totalViews: 4 } }
        );

        const statistic = await analyticsService.deleteStatistic(
            DELETE_STATISTIC_ID
        );

        expect(statistic._id.toString()).toBe(DELETE_STATISTIC_ID.toString());

        const deletedStatistic = await ViewStatistic.findById(
            DELETE_STATISTIC_ID
        );
        expect(deletedStatistic).toBeNull();

        const article = await Article.findById(PUBLISHED_ARTICLE_ID).lean();
        expect(article.totalViews).toBe(0);
    });

    test("deleteStatistic reports a missing statistic", async () => {
        await expect(
            analyticsService.deleteStatistic(MISSING_STATISTIC_ID)
        ).rejects.toMatchObject({
            message: "View statistic not found",
            statusCode: 404
        });
    });

});

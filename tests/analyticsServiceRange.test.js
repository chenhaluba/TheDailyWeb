jest.mock("../models/Article", () => ({
    findById: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn()
}));

jest.mock("../models/ViewStatistic", () => ({
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn()
}));

const Article = require("../models/Article");
const ViewStatistic = require("../models/ViewStatistic");
const analyticsService = require("../services/analyticsService");

const NOW = new Date("2026-10-08T12:34:56.789Z");
const FIRST_PUBLICATION = new Date("2026-09-01T08:15:30.250Z");
const SECOND_PUBLICATION = new Date("2026-09-05T10:00:00.000Z");
const ARTICLE_ID = "analytics-range-article";

function mockArticle(publicationHistory = [
    {
        publishedAt: SECOND_PUBLICATION,
        versionNumber: 2
    },
    {
        publishedAt: FIRST_PUBLICATION,
        versionNumber: 1
    }
]) {
    Article.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                _id: ARTICLE_ID,
                publishedVersion: { title: "Range fixture" },
                workingVersion: { title: "Range fixture" },
                publicationHistory
            })
        })
    });
}

function mockStatistics(statistics = []) {
    ViewStatistic.find.mockImplementation(filter => ({
        sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(statistics)
        }),
        filter
    }));
}

describe("getArticleAnalytics article lifetime", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(NOW);
        jest.clearAllMocks();
        mockArticle();
        mockStatistics();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("accepts a valid range and preserves its exact bounds", async () => {
        const from = new Date("2026-09-02T09:00:00.125Z");
        const to = new Date("2026-09-03T11:30:00.875Z");

        const result = await analyticsService.getArticleAnalytics(
            ARTICLE_ID,
            from.toISOString(),
            to.toISOString()
        );

        expect(ViewStatistic.find).toHaveBeenCalledWith({
            article: ARTICLE_ID,
            bucketStart: {
                $gte: new Date("2026-09-02T09:00:00.000Z"),
                $lte: new Date("2026-09-03T11:00:00.000Z")
            }
        });
        expect(result.range).toEqual({ from, to });
    });

    test("rejects a date before the first publication", async () => {
        await expect(analyticsService.getArticleAnalytics(
            ARTICLE_ID,
            "2026-09-01T08:15:30.249Z"
        )).rejects.toMatchObject({
            message: "Analytics dates cannot be before the first publication",
            statusCode: 400
        });
    });

    test("rejects a future date", async () => {
        await expect(analyticsService.getArticleAnalytics(
            ARTICLE_ID,
            undefined,
            "2026-10-08T12:34:56.790Z"
        )).rejects.toMatchObject({
            message: "Analytics dates cannot be in the future",
            statusCode: 400
        });
    });

    test("fills in the missing boundary when only one is provided", async () => {
        const selectedFrom = new Date("2026-09-10T00:00:00.000Z");
        const fromOnly = await analyticsService.getArticleAnalytics(
            ARTICLE_ID,
            selectedFrom.toISOString()
        );

        expect(fromOnly.range).toEqual({
            from: selectedFrom,
            to: NOW
        });

        const selectedTo = new Date("2026-09-20T00:00:00.000Z");
        const toOnly = await analyticsService.getArticleAnalytics(
            ARTICLE_ID,
            undefined,
            selectedTo.toISOString()
        );

        expect(toOnly.range).toEqual({
            from: FIRST_PUBLICATION,
            to: selectedTo
        });
    });

    test("uses the full article lifetime when filters are omitted", async () => {
        const result = await analyticsService.getArticleAnalytics(ARTICLE_ID);

        expect(result.range).toEqual({
            from: FIRST_PUBLICATION,
            to: NOW
        });
        expect(result.bounds).toEqual({
            from: FIRST_PUBLICATION,
            to: NOW
        });
        expect(ViewStatistic.find).toHaveBeenCalledWith({
            article: ARTICLE_ID,
            bucketStart: {
                $gte: new Date("2026-09-01T08:00:00.000Z"),
                $lte: new Date("2026-10-08T12:00:00.000Z")
            }
        });
    });

    test("keeps the first hourly bucket when publication is mid-hour", async () => {
        const firstPublication = new Date("2026-09-01T10:30:00.000Z");
        const firstBucket = new Date("2026-09-01T10:00:00.000Z");
        mockArticle([{
            publishedAt: firstPublication,
            versionNumber: 1
        }]);
        mockStatistics([{
            bucketStart: firstBucket,
            viewCount: 7
        }]);

        const result = await analyticsService.getArticleAnalytics(ARTICLE_ID);

        expect(ViewStatistic.find).toHaveBeenCalledWith({
            article: ARTICLE_ID,
            bucketStart: {
                $gte: firstBucket,
                $lte: new Date("2026-10-08T12:00:00.000Z")
            }
        });
        expect(result.views).toEqual([{
            time: firstBucket,
            count: 7
        }]);
        expect(result.views.reduce((sum, view) => sum + view.count, 0)).toBe(7);
        expect(result.range.from).toEqual(firstPublication);
    });

    test("includes every hourly bucket overlapping a mid-hour range", async () => {
        const from = new Date("2026-09-01T10:45:00.000Z");
        const to = new Date("2026-09-01T11:15:00.000Z");

        await analyticsService.getArticleAnalytics(
            ARTICLE_ID,
            from.toISOString(),
            to.toISOString()
        );

        expect(ViewStatistic.find).toHaveBeenCalledWith({
            article: ARTICLE_ID,
            bucketStart: {
                $gte: new Date("2026-09-01T10:00:00.000Z"),
                $lte: new Date("2026-09-01T11:00:00.000Z")
            }
        });
    });

    test("uses the earliest publication from unsorted history", async () => {
        const result = await analyticsService.getArticleAnalytics(ARTICLE_ID);

        expect(result.publications.map(event => event.versionNumber))
            .toEqual([1, 2]);
        expect(result.bounds.from).toEqual(FIRST_PUBLICATION);
    });

    test("rejects an article without valid publication history", async () => {
        mockArticle([{ publishedAt: "invalid", versionNumber: 1 }]);

        await expect(
            analyticsService.getArticleAnalytics(ARTICLE_ID)
        ).rejects.toMatchObject({
            message: "Article has no valid publication history",
            statusCode: 400
        });
    });
});

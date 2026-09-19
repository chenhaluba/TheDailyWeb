const request = require("supertest");

const BASE_URL = "http://localhost:3000";

describe("Articles API", () => {

    describe("GET /api/articles", () => {

        test("should return published articles", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles");

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.items)).toBe(true);

        });

        test("should return the expected response structure", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles");

            expect(response.status).toBe(200);

            expect(response.body).toHaveProperty("success");
            expect(response.body).toHaveProperty("data");
            expect(response.body).toHaveProperty("message");

            expect(response.body.data).toHaveProperty("items");
            expect(response.body.data).toHaveProperty("pagination");

            expect(response.body.data.pagination).toHaveProperty("page");
            expect(response.body.data.pagination).toHaveProperty("limit");
            expect(response.body.data.pagination).toHaveProperty("hasMore");

        });

    });

    describe("Pagination", () => {

        test("should return the requested page", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    page: 2
                });

            expect(response.status).toBe(200);
            expect(response.body.data.pagination.page).toBe(2);

        });

        test("should respect the requested limit", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    limit: 5
                });

            expect(response.status).toBe(200);
            expect(response.body.data.pagination.limit).toBe(5);
            expect(response.body.data.items.length)
                .toBeLessThanOrEqual(5);

        });

        test("should return an empty array when requesting a page beyond the available data", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    page: 9999
                });

            expect(response.status).toBe(200);
            expect(response.body.data.items).toEqual([]);

        });

    });

    describe("Search", () => {

        test("should return matching articles", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    search: "tech"
                });

            expect(response.status).toBe(200);

            response.body.data.items.forEach(article => {

                expect(
                    article.publishedVersion.title.toLowerCase()
                ).toContain("tech");

            });

        });

        test("should return an empty array when no articles match the search", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    search: "this_article_does_not_exist_12345"
                });

            expect(response.status).toBe(200);
            expect(response.body.data.items).toHaveLength(0);

        });

    });

    describe("Category Filter", () => {

        test("should filter articles by category", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    category: "Technology"
                });

            expect(response.status).toBe(200);

            response.body.data.items.forEach(article => {

                expect(article.publishedVersion.category)
                    .toBe("Technology");

            });

        });

        test("should return 404 for an invalid category", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    category: "InvalidCategory"
                });

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);

        });

    });

    describe("Sorting", () => {

        test("should sort articles by newest", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    sort: "newest"
                });

            expect(response.status).toBe(200);

            const dates = response.body.data.items.map(
                article => new Date(article.createdAt)
            );

            for (let i = 1; i < dates.length; i++) {

                expect(dates[i].getTime())
                    .toBeLessThanOrEqual(dates[i - 1].getTime());

            }

        });

        test("should sort articles by popularity", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    sort: "popular"
                });

            expect(response.status).toBe(200);

            const views = response.body.data.items.map(
                article => article.totalViews
            );

            for (let i = 1; i < views.length; i++) {

                expect(views[i])
                    .toBeLessThanOrEqual(views[i - 1]);

            }

        });

    });

    describe("Combined Filters", () => {

        test("should combine search, category and sorting", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    search: "tech",
                    category: "Technology",
                    sort: "popular"
                });

            expect(response.status).toBe(200);

        });

    });

    describe("Validation", () => {

        test("should default negative page values to page 1", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    page: -5
                });

            expect(response.status).toBe(200);
            expect(response.body.data.pagination.page).toBe(1);

        });

        test("should enforce the maximum page size", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    limit: 999
                });

            expect(response.status).toBe(200);
            expect(response.body.data.pagination.limit)
                .toBeLessThanOrEqual(20);

        });

        test("should fallback to newest sorting for invalid sort values", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles")
                .query({
                    sort: "invalid"
                });

            expect(response.status).toBe(200);

        });

    });

    describe("Article Response", () => {

        test("should return the expected article structure", async () => {

            const response = await request(BASE_URL)
                .get("/api/articles");

            expect(response.status).toBe(200);

            const article = response.body.data.items[0];

            expect(article).toHaveProperty("_id");
            expect(article).toHaveProperty("author");
            expect(article).toHaveProperty("publishedVersion");

            expect(article.author)
                .toHaveProperty("displayName");

            expect(article.publishedVersion)
                .toHaveProperty("title");

            expect(article.publishedVersion)
                .toHaveProperty("summary");

            expect(article.publishedVersion)
                .toHaveProperty("category");

            expect(article.publishedVersion)
                .toHaveProperty("mainImage");

        });

    });

    describe("Published Version Visibility", () => {

        test("should return only articles that have a published version", async () => {
    
            const response = await request(BASE_URL)
                .get("/api/articles");
    
            expect(response.status).toBe(200);
    
            response.body.data.items.forEach(article => {
                expect(article.publishedVersion).not.toBeNull();
            });
    
        });
    
        test("should return published version data for every article", async () => {
    
            const response = await request(BASE_URL)
                .get("/api/articles");
    
            expect(response.status).toBe(200);
    
            response.body.data.items.forEach(article => {
    
                expect(article.publishedVersion).toBeDefined();
    
                expect(article.publishedVersion.title)
                    .toBeDefined();
    
                expect(article.publishedVersion.content)
                    .toBeDefined();
    
                expect(article.publishedVersion.summary)
                    .toBeDefined();
    
            });
    
        });
    
        test("should not expose articles without a published version", async () => {
    
            const response = await request(BASE_URL)
                .get("/api/articles");
    
            expect(response.status).toBe(200);
    
            const draftOnlyArticles = response.body.data.items.filter(
                article => article.publishedVersion === null
            );
    
            expect(draftOnlyArticles).toHaveLength(0);
    
        });
    
    });

});
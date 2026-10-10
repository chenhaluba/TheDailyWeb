const request = require("supertest");

const BASE_URL = "http://localhost:3000";

describe("Article View Page", () => {

    test("should include the article ID and view recording script", async () => {
        const articlesResponse = await request(BASE_URL)
            .get("/api/articles")
            .query({ limit: 1 });

        expect(articlesResponse.status).toBe(200);
        expect(articlesResponse.body.success).toBe(true);
        expect(articlesResponse.body.data.items.length).toBeGreaterThan(0);

        const articleId = articlesResponse.body.data.items[0]._id;
        const response = await request(BASE_URL)
            .get(`/articles/${articleId}`);

        expect(response.status).toBe(200);
        expect(response.text)
            .toContain(`data-article-id="${articleId}"`);
        expect(response.text).toContain("/js/articleViews.js");
    });

});

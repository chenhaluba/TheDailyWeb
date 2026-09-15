const request = require("supertest");

const BASE_URL = "http://localhost:3000";

describe("Not Found", () => {

    test("should return 404 for unknown page", async () => {

        const response = await request(BASE_URL)
            .get("/this-page-does-not-exist");

        expect(response.status).toBe(404);

    });

    test("should render custom 404 page", async () => {

        const response = await request(BASE_URL)
            .get("/this-page-does-not-exist");

        expect(response.text)
            .toContain("Page Not Found");

    });

});
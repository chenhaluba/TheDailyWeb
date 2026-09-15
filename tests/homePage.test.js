const request = require("supertest");

const BASE_URL = "http://localhost:3000";

describe("Home Page", () => {

    test("should return status 200", async () => {

        const response = await request(BASE_URL)
            .get("/");

        expect(response.status).toBe(200);

    });

    test("should return HTML", async () => {

        const response = await request(BASE_URL)
            .get("/");

        expect(response.headers["content-type"])
            .toContain("text/html");

    });

    test("should render The Daily Web title", async () => {

        const response = await request(BASE_URL)
            .get("/");

        expect(response.text)
            .toContain("The Daily Web");

    });

    test("should render search form", async () => {

        const response = await request(BASE_URL)
            .get("/");

        expect(response.text)
            .toContain("search-form");

    });

    test("should render articles grid", async () => {

        const response = await request(BASE_URL)
            .get("/");

        expect(response.text)
            .toContain("articles-grid");

    });

    test("should render feed sentinel", async () => {

        const response = await request(BASE_URL)
            .get("/");

        expect(response.text)
            .toContain("feed-sentinel");

    });

});
const request = require("supertest");
const mongoose = require("mongoose");

const BASE_URL = "http://localhost:3000";

describe("Article Page", () => {

    test("should return 404 for invalid ObjectId", async () => {

        const response = await request(BASE_URL)
            .get("/articles/123");

        expect(response.status).toBe(404);

    });

    test("should return HTML for 404 page", async () => {

        const response = await request(BASE_URL)
            .get("/articles/123");

        expect(response.headers["content-type"])
            .toContain("text/html");

    });

    test("should render not found page", async () => {

        const response = await request(BASE_URL)
            .get("/articles/123");

        expect(response.text)
            .toContain("Article Not Found");

    });

    test("should return 404 for non existing ObjectId", async () => {
        const id = new mongoose.Types.ObjectId().toString();
    
        const response = await request(BASE_URL)
            .get(`/articles/${id}`);
    
        expect(response.status).toBe(404);
    });

});
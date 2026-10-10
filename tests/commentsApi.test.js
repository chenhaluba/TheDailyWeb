require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env")
});

const { randomUUID } = require("crypto");
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const Article = require("../models/Article");
const Comment = require("../models/Comment");

const BASE_URL = "http://localhost:3000";

const REPORTER_ID = new mongoose.Types.ObjectId("7a1100000000000000000001");
const EDITOR_ID = new mongoose.Types.ObjectId("7a1100000000000000000002");
const PUBLISHED_ARTICLE_ID = new mongoose.Types.ObjectId("7a1100000000000000000011");
const UNPUBLISHED_ARTICLE_ID = new mongoose.Types.ObjectId("7a1100000000000000000012");
const MISSING_ARTICLE_ID = new mongoose.Types.ObjectId("7a1100000000000000000013");
const RETURNED_ARTICLE_ID = new mongoose.Types.ObjectId("7a1100000000000000000014");
const OLDER_COMMENT_ID = new mongoose.Types.ObjectId("7a1100000000000000000021");
const NEWER_COMMENT_ID = new mongoose.Types.ObjectId("7a1100000000000000000022");
const HIDDEN_COMMENT_ID = new mongoose.Types.ObjectId("7a1100000000000000000023");
const PATCH_COMMENT_ID = new mongoose.Types.ObjectId("7a1100000000000000000024");
const DELETE_COMMENT_ID = new mongoose.Types.ObjectId("7a1100000000000000000025");
const RETURNED_ARTICLE_COMMENT_ID = new mongoose.Types.ObjectId("7a1100000000000000000026");

const REPORTER_USERNAME = "test_comments_api_reporter";
const EDITOR_USERNAME = "test_comments_api_editor";
const TEST_USER_IDS = [REPORTER_ID, EDITOR_ID];
const TEST_USERNAMES = [REPORTER_USERNAME, EDITOR_USERNAME];
const TEST_ARTICLE_IDS = [
    PUBLISHED_ARTICLE_ID,
    UNPUBLISHED_ARTICLE_ID,
    RETURNED_ARTICLE_ID
];
const FIXED_COMMENT_IDS = [
    OLDER_COMMENT_ID,
    NEWER_COMMENT_ID,
    HIDDEN_COMMENT_ID,
    PATCH_COMMENT_ID,
    DELETE_COMMENT_ID,
    RETURNED_ARTICLE_COMMENT_ID
];

const trackedCommentIds = [];
const editorAgent = request.agent(BASE_URL);
let editorPassword;

function trackCreatedComment(response) {
    const commentId = response.body &&
        response.body.data &&
        response.body.data._id;

    if (commentId && mongoose.isValidObjectId(commentId)) {
        trackedCommentIds.push(new mongoose.Types.ObjectId(commentId));
    }
}

function expectPrivateFieldsHidden(comment) {
    expect(comment).not.toHaveProperty("deviceId");
    expect(comment).not.toHaveProperty("ipAddress");
    expect(comment).not.toHaveProperty("__v");
}

function postComment(deviceId, body) {
    return request(BASE_URL)
        .post(`/api/articles/${PUBLISHED_ARTICLE_ID}/comments`)
        .set("Cookie", `deviceId=${deviceId}`)
        .send(body);
}

async function cleanupFixtures() {
    const commentIds = FIXED_COMMENT_IDS.concat(trackedCommentIds);

    await Comment.deleteMany({
        $or: [
            { article: { $in: TEST_ARTICLE_IDS } },
            { _id: { $in: commentIds } }
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

describe("Comments API", () => {

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI);
        await cleanupFixtures();

        editorPassword = randomUUID();
        const passwordHash = await bcrypt.hash(editorPassword, 10);

        await User.insertMany([
            {
                _id: REPORTER_ID,
                username: REPORTER_USERNAME,
                passwordHash,
                displayName: "Comments API Reporter",
                role: "reporter",
                isActive: true
            },
            {
                _id: EDITOR_ID,
                username: EDITOR_USERNAME,
                passwordHash,
                displayName: "Comments API Editor",
                role: "editor",
                isActive: true
            }
        ]);

        const publishedAt = new Date("2024-01-02T10:00:00.000Z");
        const articleVersion = {
            title: "Comments API Fixture Article",
            summary: "A dedicated article used by the comments API tests.",
            content: "Dedicated comments API fixture content.",
            category: "Science",
            mainImage: "image1.jpg",
            savedAt: publishedAt
        };

        await Article.insertMany([
            {
                _id: PUBLISHED_ARTICLE_ID,
                author: REPORTER_ID,
                status: "published",
                publishedVersion: articleVersion,
                workingVersion: articleVersion,
                publicationHistory: [{
                    publishedAt,
                    approvedBy: EDITOR_ID,
                    versionNumber: 1
                }],
                totalViews: 0,
                createdAt: new Date("2024-01-01T10:00:00.000Z"),
                updatedAt: publishedAt
            },
            {
                _id: UNPUBLISHED_ARTICLE_ID,
                author: REPORTER_ID,
                status: "draft",
                publishedVersion: null,
                workingVersion: {
                    title: "Unpublished Comments API Fixture",
                    summary: "",
                    content: "",
                    category: "Science",
                    mainImage: "image1.jpg",
                    savedAt: publishedAt
                },
                totalViews: 0
            },
            {
                _id: RETURNED_ARTICLE_ID,
                author: REPORTER_ID,
                status: "returned",
                publishedVersion: {
                    ...articleVersion,
                    title: "Returned Article With Published Version"
                },
                workingVersion: {
                    ...articleVersion,
                    title: "Returned Article Working Version"
                },
                publicationHistory: [{
                    publishedAt,
                    approvedBy: EDITOR_ID,
                    versionNumber: 1
                }],
                totalViews: 0,
                createdAt: new Date("2024-01-01T10:00:00.000Z"),
                updatedAt: publishedAt
            }
        ]);

        await Comment.insertMany([
            {
                _id: OLDER_COMMENT_ID,
                article: PUBLISHED_ARTICLE_ID,
                authorName: "Older Reader",
                content: "Older visible comment.",
                deviceId: "comments-api-visible-older",
                ipAddress: "",
                isVisible: true,
                createdAt: new Date("2024-02-01T10:00:00.000Z"),
                updatedAt: new Date("2024-02-01T10:00:00.000Z")
            },
            {
                _id: NEWER_COMMENT_ID,
                article: PUBLISHED_ARTICLE_ID,
                authorName: "Newer Reader",
                content: "Newer visible comment.",
                deviceId: "comments-api-visible-newer",
                ipAddress: "",
                isVisible: true,
                createdAt: new Date("2024-02-02T10:00:00.000Z"),
                updatedAt: new Date("2024-02-02T10:00:00.000Z")
            },
            {
                _id: HIDDEN_COMMENT_ID,
                article: PUBLISHED_ARTICLE_ID,
                authorName: "Hidden Reader",
                content: "Hidden comment.",
                deviceId: "comments-api-hidden",
                ipAddress: "",
                isVisible: false,
                createdAt: new Date("2024-02-03T10:00:00.000Z"),
                updatedAt: new Date("2024-02-03T10:00:00.000Z")
            },
            {
                _id: PATCH_COMMENT_ID,
                article: PUBLISHED_ARTICLE_ID,
                authorName: "Patch Reader",
                content: "Comment awaiting moderation update.",
                deviceId: "comments-api-patch",
                ipAddress: "",
                isVisible: true,
                createdAt: new Date("2024-01-30T10:00:00.000Z"),
                updatedAt: new Date("2024-01-30T10:00:00.000Z")
            },
            {
                _id: DELETE_COMMENT_ID,
                article: PUBLISHED_ARTICLE_ID,
                authorName: "Delete Reader",
                content: "Comment awaiting deletion.",
                deviceId: "comments-api-delete",
                ipAddress: "",
                isVisible: true,
                createdAt: new Date("2024-01-29T10:00:00.000Z"),
                updatedAt: new Date("2024-01-29T10:00:00.000Z")
            },
            {
                _id: RETURNED_ARTICLE_COMMENT_ID,
                article: RETURNED_ARTICLE_ID,
                authorName: "Returned Article Reader",
                content: "Visible comment on a returned article.",
                deviceId: "comments-api-returned-article",
                ipAddress: "",
                isVisible: true,
                createdAt: new Date("2024-02-04T10:00:00.000Z"),
                updatedAt: new Date("2024-02-04T10:00:00.000Z")
            }
        ]);

        const loginResponse = await editorAgent
            .post("/login")
            .type("form")
            .send({
                username: EDITOR_USERNAME,
                password: editorPassword
            });

        if (loginResponse.status !== 302) {
            throw new Error("Dedicated editor login failed");
        }
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

    test("GET rejects an invalid article ID", async () => {
        const response = await request(BASE_URL)
            .get("/api/articles/not-an-object-id/comments");

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Invalid article ID");
    });

    test("GET returns 404 for a valid missing article ID", async () => {
        const response = await request(BASE_URL)
            .get(`/api/articles/${MISSING_ARTICLE_ID}/comments`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Published article not found");
    });

    test("GET returns 404 for an unpublished article", async () => {
        const response = await request(BASE_URL)
            .get(`/api/articles/${UNPUBLISHED_ARTICLE_ID}/comments`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Published article not found");
    });

    test("GET returns comments when publishedVersion exists on a returned article", async () => {
        const response = await request(BASE_URL)
            .get(`/api/articles/${RETURNED_ARTICLE_ID}/comments`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    _id: RETURNED_ARTICLE_COMMENT_ID.toString(),
                    content: "Visible comment on a returned article."
                })
            ])
        );
    });

    test("GET returns only visible comments newest first", async () => {
        const response = await request(BASE_URL)
            .get(`/api/articles/${PUBLISHED_ARTICLE_ID}/comments`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const returnedIds = response.body.data.map(comment => comment._id);

        expect(returnedIds).not.toContain(HIDDEN_COMMENT_ID.toString());
        expect(returnedIds.indexOf(NEWER_COMMENT_ID.toString()))
            .toBeLessThan(returnedIds.indexOf(OLDER_COMMENT_ID.toString()));

        response.body.data.forEach(expectPrivateFieldsHidden);
    });

    test("POST creates a trimmed named comment", async () => {
        const response = await postComment(
            "comments-api-post-named",
            {
                authorName: "  Test Reader  ",
                content: "  A test comment with surrounding space.  "
            }
        );

        trackCreatedComment(response);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.authorName).toBe("Test Reader");
        expect(response.body.data.content)
            .toBe("A test comment with surrounding space.");
        expectPrivateFieldsHidden(response.body.data);
    });

    test("POST without authorName uses the guest default", async () => {
        const response = await postComment(
            "comments-api-post-guest",
            { content: "A comment without an author name." }
        );

        trackCreatedComment(response);

        expect(response.status).toBe(201);
        expect(response.body.data.authorName).toBe("guest");
        expectPrivateFieldsHidden(response.body.data);
    });

    test("POST ignores a client-supplied deviceId in the request body", async () => {
        const cookieDeviceId = "comments-api-cookie-device";
        const bodyDeviceId = "comments-api-body-device";
        const response = await postComment(cookieDeviceId, {
            content: "A comment with conflicting device identifiers.",
            deviceId: bodyDeviceId
        });

        trackCreatedComment(response);

        expect(response.status).toBe(201);

        const storedComment = await Comment.findById(
            response.body.data._id
        ).lean();

        expect(storedComment.deviceId).toBe(cookieDeviceId);
        expect(storedComment.deviceId).not.toBe(bodyDeviceId);
    });

    test.each([
        ["missing", {}, "Content must be a string"],
        ["blank", { content: "   " }, "Comment content is required"],
        ["non-string", { content: 123 }, "Content must be a string"],
        [
            "longer than 1000 characters",
            { content: "x".repeat(1001) },
            "Comment content cannot exceed 1000 characters"
        ]
    ])("POST rejects %s content", async (caseName, body, message) => {
        const response = await postComment(
            `comments-api-invalid-content-${caseName.replaceAll(" ", "-")}`,
            body
        );

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(message);
    });

    test.each([
        ["non-string", { authorName: 123, content: "Valid content." }, "Author name must be a string"],
        [
            "longer than 50 characters",
            { authorName: "a".repeat(51), content: "Valid content." },
            "Author name cannot exceed 50 characters"
        ]
    ])("POST rejects an author name that is %s", async (caseName, body, message) => {
        const response = await postComment(
            `comments-api-invalid-author-${caseName.replaceAll(" ", "-")}`,
            body
        );

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(message);
    });

    test("rate limiting permits three comments and rejects the fourth", async () => {
        const deviceId = "comments-api-rate-limit";

        for (let index = 1; index <= 3; index++) {
            const response = await postComment(deviceId, {
                content: `Rate limit comment ${index}.`
            });

            trackCreatedComment(response);
            expect(response.status).toBe(201);
        }

        const response = await postComment(deviceId, {
            content: "Rate limit comment 4."
        });

        expect(response.status).toBe(429);
        expect(response.body.success).toBe(false);
        expect(response.body.message)
            .toBe("Comment limit reached. Please wait before posting again");
    });

    test("unauthenticated PATCH and DELETE requests redirect to login", async () => {
        const patchResponse = await request(BASE_URL)
            .patch(`/api/comments/${PATCH_COMMENT_ID}`)
            .send({ content: "Unauthenticated update." });
        const deleteResponse = await request(BASE_URL)
            .delete(`/api/comments/${DELETE_COMMENT_ID}`);

        expect(patchResponse.status).toBe(302);
        expect(patchResponse.headers.location).toBe("/login");
        expect(deleteResponse.status).toBe(302);
        expect(deleteResponse.headers.location).toBe("/login");
    });

    test("an authenticated editor updates content and visibility", async () => {
        const response = await editorAgent
            .patch(`/api/comments/${PATCH_COMMENT_ID}`)
            .send({
                content: "  Updated by the dedicated editor.  ",
                isVisible: false
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.content)
            .toBe("Updated by the dedicated editor.");
        expect(response.body.data.isVisible).toBe(false);
        expectPrivateFieldsHidden(response.body.data);

        const storedComment = await Comment.findById(PATCH_COMMENT_ID).lean();
        expect(storedComment.content).toBe("Updated by the dedicated editor.");
        expect(storedComment.isVisible).toBe(false);
    });

    test("PATCH rejects unsupported fields", async () => {
        const response = await editorAgent
            .patch(`/api/comments/${PATCH_COMMENT_ID}`)
            .send({ authorName: "Unsupported update" });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message)
            .toBe("Only content and isVisible may be updated");
        expect(response.body.errors).toEqual(["authorName"]);
    });

    test("an authenticated editor deletes a test comment", async () => {
        const response = await editorAgent
            .delete(`/api/comments/${DELETE_COMMENT_ID}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data._id).toBe(DELETE_COMMENT_ID.toString());
        expectPrivateFieldsHidden(response.body.data);

        const deletedComment = await Comment.findById(DELETE_COMMENT_ID);
        expect(deletedComment).toBeNull();
    });

});

const { randomUUID } = require("crypto");

const Comment = require("../models/Comment");

const DEVICE_COOKIE_NAME = "deviceId";
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_COMMENTS_PER_WINDOW = 3;

function sendError(res, status, message) {
    return res.status(status).json({
        success: false,
        message,
        errors: []
    });
}

async function commentRateLimit(req, res, next) {
    try {
        const cookieDeviceId = req.cookies && req.cookies[DEVICE_COOKIE_NAME];
        let deviceId = typeof cookieDeviceId === "string"
            ? cookieDeviceId.trim()
            : "";

        if (!deviceId) {
            deviceId = randomUUID();
            res.cookie(DEVICE_COOKIE_NAME, deviceId, {
                httpOnly: true,
                sameSite: "lax"
            });
        }

        req.commentDeviceId = deviceId;

        const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
        const recentCommentCount = await Comment.countDocuments({
            deviceId,
            createdAt: { $gte: windowStart }
        });

        if (recentCommentCount >= MAX_COMMENTS_PER_WINDOW) {
            return sendError(
                res,
                429,
                "Comment limit reached. Please wait before posting again"
            );
        }

        return next();
    } catch (error) {
        console.error("Error checking comment rate limit:", error.message);
        return sendError(res, 500, "Failed to check comment rate limit");
    }
}

module.exports = { commentRateLimit };

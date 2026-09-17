const jwt = require('jsonwebtoken');
const Article = require('../models/Article');

const validateSession = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        console.log("no jwt token");
        return res.redirect('/login');
    }
    try {
        const decodeToken = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decodeToken;
        next();

    }
    catch (error) {
        console.error("Token validation error:", error.message);
        return res.redirect('/login');
    }
}


const validateArticleOwner = async (req, res, next) => {
    try {
        const articleId = req.params.id;
        const article = await Article.findById(articleId);

        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }

        if (req.user.role === 'editor' || article.author.toString() === req.user.userID) {
            req.article = article;
            return next();
        }

        return res.status(403).json({ message: "Forbidden: You do not own this article" });
    } catch (error) {
        console.error("Ownership validation error:", error);
        return res.status(500).json({ message: "Server error checking ownership" });
    }
};


module.exports = { validateSession, validateArticleOwner };
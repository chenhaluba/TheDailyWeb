require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const connectDatabase = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const pageRoutes = require("./routes/pageRoutes");
const reporterPageRoutes = require("./routes/reporterPageRoutes");
const reporterArticleRoutes = require("./routes/reporterArticleRoutes");
const commentRoutes = require("./routes/commentRoutes");
const articleRoutes = require("./routes/articleRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

connectDatabase();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", authRoutes);
app.use("/reporter", reporterPageRoutes);
app.use("/api/reporter/articles", reporterArticleRoutes);
app.use("/", pageRoutes);
app.use("/", commentRoutes);
app.use("/api/articles", articleRoutes);
app.use("/user", userRoutes);

app.use((req, res) => {
    res.status(404).render("notFound", { pageTitle: "Page Not Found" });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

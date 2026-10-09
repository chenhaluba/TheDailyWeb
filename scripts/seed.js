require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const connectDatabase = require("../config/database");
const User = require("../models/User");
const Article = require("../models/Article");
const Comment = require("../models/Comment");
const ViewStatistic = require("../models/ViewStatistic");

const names = ["yuval", "noy", "chen", "shirK", "shirA"];
const categories = ["News", "Economy", "Politics", "Sports", "Culture", "Technology", "Science"];

// Helper to pick a random item from an array
const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seedDatabase() {
    try {
        await connectDatabase();
        console.log("Connected to Db. Starting seed process...");

        await Comment.deleteMany({});
        await ViewStatistic.deleteMany({});
        await Article.deleteMany({});
        await User.deleteMany({});
        console.log("Cleared old data...");

        const editors = [];
        const reporters = [];

        // 1. Generate the 10 users (5 editors, 5 reporters)
        for (const name of names) {
            const passwordHash = await bcrypt.hash(name, 10); // Password matches their first name
            
            // Create Editor
            const editor = await User.create({
                username: `${name}_editor`,
                passwordHash,
                displayName: `${name.charAt(0).toUpperCase() + name.slice(1)} (Editor)`,
                role: "editor",
                isActive: true
            });
            editors.push(editor);

            // Create Reporter
            const reporter = await User.create({
                username: `${name}_reporter`,
                passwordHash,
                displayName: `${name.charAt(0).toUpperCase() + name.slice(1)} (Reporter)`,
                role: "reporter",
                isActive: true
            });
            reporters.push(reporter);
        }
        console.log(`Created ${editors.length} editors and ${reporters.length} reporters.`);

        // 2. Generate 50 distinct articles
        const seedExecutionTime = new Date();
        const articlesToInsert = [];
        for (let i = 1; i <= 50; i++) {
            const category = sample(categories);
            const reporter = sample(reporters);
            const editor = sample(editors);
            
            const statusOptions = ["draft", "pending", "published", "returned"];
            // Force the first 35 to be 'published' so the public feed has plenty of data to show
            const status = i <= 35 ? "published" : sample(statusOptions);
            let publishedAt = null;

            if (status === "published") {
                publishedAt = new Date(seedExecutionTime);
                publishedAt.setUTCDate(publishedAt.getUTCDate() - (8 + ((i - 1) % 7)));
                publishedAt.setUTCHours(9, 0, 0, 0);
            }

            // Generate unique content
            const title = `Breaking News in ${category}: Report #${i}`;
            const summary = `This is a quick summary for the breaking news in ${category}. Article number ${i} brings you the latest updates and exclusive insights.`;
            const content = `Here is the full detailed content for article number ${i}. The world of ${category} is constantly evolving. In this article, we delve deep into the recent events that shook the industry. It is important to stay updated with the latest trends. As reported by ${reporter.displayName}, there are many facets to consider here.\n\nFurthermore, experts agree that this might be a turning point. Stay tuned for more updates as this story develops.`;
            
            // We will use only local images to guarantee they never break and always load instantly.
            // We cycle through the 11 local images using the remainder operator (%).
            const localImageOptions = [
                "image1.jpg", "image2.jpg", "image3.jpg", "image4.jpg", "image5.jpg", 
                "image6.jpg", "image7.jpg", "image8.jpg", "image9.jpg", "image10.jpg", 
                "quantum-launch.jpg"
            ];
            const mainImage = localImageOptions[i % localImageOptions.length];

            const articleVersion = {
                title,
                summary,
                content,
                category,
                mainImage,
                savedAt: publishedAt || new Date()
            };

            const articleData = {
                author: reporter._id,
                status: status,
                workingVersion: articleVersion, // Everyone has a working version
            };

            // If it's published, copy it to publishedVersion and add history
            if (status === "published") {
                const secondPublicationAt = new Date(Date.UTC(
                    seedExecutionTime.getUTCFullYear(),
                    seedExecutionTime.getUTCMonth(),
                    seedExecutionTime.getUTCDate() - 6,
                    10,
                    30,
                    0,
                    0
                ));
                const thirdPublicationAt = new Date(Date.UTC(
                    seedExecutionTime.getUTCFullYear(),
                    seedExecutionTime.getUTCMonth(),
                    seedExecutionTime.getUTCDate() - 3,
                    18,
                    30,
                    0,
                    0
                ));
                const approvedContent = `${content}\n\nUpdate 1: The editorial team added verified context and further background after the initial publication.\n\nUpdate 2: The latest approved revision adds follow-up details and clarifies how the story has developed.`;
                const approvedVersion = {
                    ...articleVersion,
                    content: approvedContent,
                    savedAt: thirdPublicationAt
                };
                const createdAt = new Date(publishedAt);
                createdAt.setUTCDate(createdAt.getUTCDate() - 1);
                articleData.createdAt = createdAt;
                articleData.updatedAt = thirdPublicationAt;
                articleData.publishedVersion = approvedVersion;
                articleData.workingVersion = approvedVersion;
                articleData.publicationHistory = [
                    {
                        publishedAt,
                        approvedBy: editor._id,
                        versionNumber: 1
                    },
                    {
                        publishedAt: secondPublicationAt,
                        approvedBy: editor._id,
                        versionNumber: 2
                    },
                    {
                        publishedAt: thirdPublicationAt,
                        approvedBy: editor._id,
                        versionNumber: 3
                    }
                ];
            } else if (status === "returned") {
                articleData.editorNote = "Please fix the grammatical errors in the second paragraph before I can publish this.";
            }

            articlesToInsert.push(articleData);
        }

        // Insert all 50 articles in bulk
        const insertedArticles = await Article.insertMany(articlesToInsert);
        console.log(`Successfully seeded ${articlesToInsert.length} distinct articles with Picsum images!`);

        const publishedArticles = insertedArticles
            .map((article, index) => ({ article, index }))
            .filter(({ article }) => article.publishedVersion !== null);
        const viewHours = [8, 12, 16, 20];
        const viewStatistics = [];
        const articleViewTotals = new Map();

        for (const { article, index } of publishedArticles) {
            let totalViews = 0;

            for (let dayOffset = 7; dayOffset >= 1; dayOffset--) {
                for (let hourIndex = 0; hourIndex < viewHours.length; hourIndex++) {
                    const bucketStart = new Date(Date.UTC(
                        seedExecutionTime.getUTCFullYear(),
                        seedExecutionTime.getUTCMonth(),
                        seedExecutionTime.getUTCDate() - dayOffset,
                        viewHours[hourIndex],
                        0,
                        0,
                        0
                    ));
                    const viewCount = 10 + (((index + 1) * 7 + dayOffset * 5 + hourIndex * 3) % 61);

                    viewStatistics.push({
                        article: article._id,
                        bucketStart,
                        viewCount
                    });
                    totalViews += viewCount;
                }
            }

            articleViewTotals.set(article._id.toString(), totalViews);
        }

        await ViewStatistic.insertMany(viewStatistics);

        const totalViewUpdates = publishedArticles.map(({ article }) => ({
            updateOne: {
                filter: { _id: article._id },
                update: { $set: { totalViews: articleViewTotals.get(article._id.toString()) } },
                timestamps: false
            }
        }));
        await Article.bulkWrite(totalViewUpdates);

        const commentAuthors = ["Dana", "Ariel", "Noam", "Maya", "Lior", "Roni"];
        const commentContents = [
            "A clear overview of the topic. Thanks for the update.",
            "The background details made this easy to follow.",
            "I appreciated the follow-up context in the latest revision.",
            "This raises an interesting question about what happens next."
        ];
        const commentTimes = [
            { dayOffset: 7, hour: 11, minute: 15 },
            { dayOffset: 5, hour: 14, minute: 40 },
            { dayOffset: 2, hour: 9, minute: 25 },
            { dayOffset: 1, hour: 21, minute: 5 }
        ];
        const comments = [];

        for (const { article, index } of publishedArticles) {
            const publishedAt = article.publicationHistory[0].publishedAt;

            for (let commentIndex = 0; commentIndex < commentContents.length; commentIndex++) {
                const commentTime = commentTimes[commentIndex];
                const createdAt = new Date(Date.UTC(
                    seedExecutionTime.getUTCFullYear(),
                    seedExecutionTime.getUTCMonth(),
                    seedExecutionTime.getUTCDate() - commentTime.dayOffset,
                    commentTime.hour,
                    commentTime.minute,
                    0,
                    0
                ));

                if (createdAt <= publishedAt) {
                    createdAt.setTime(publishedAt.getTime() + ((commentIndex + 1) * 60 * 60 * 1000));
                }

                comments.push({
                    article: article._id,
                    authorName: commentAuthors[(index + commentIndex) % commentAuthors.length],
                    content: commentContents[commentIndex],
                    deviceId: `seed-device-${index + 1}-${commentIndex + 1}`,
                    isVisible: true,
                    createdAt,
                    updatedAt: createdAt
                });
            }
        }

        await Comment.insertMany(comments);
        console.log(`Created ${comments.length} comments.`);
        console.log(`Created ${viewStatistics.length} ViewStatistic records.`);
        console.log(`Updated totalViews for ${totalViewUpdates.length} articles.`);

        console.log("Seeding process finished completely.");
        process.exit(0);
    } catch (error) {
        console.error("Error during seeding:", error);
        process.exit(1);
    }
}

seedDatabase();

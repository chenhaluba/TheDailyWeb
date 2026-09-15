require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const connectDatabase = require("../config/database");
const User = require("../models/User");
const Article = require("../models/Article");

const names = ["yuval", "noy", "chen", "shirK", "shirA"];
const categories = ["Technology", "Politics", "Sports", "Entertainment", "Health", "Economy", "Science"];

// Helper to pick a random item from an array
const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seedDatabase() {
    try {
        await connectDatabase();
        console.log("Connected to Db. Starting seed process...");

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
        const articlesToInsert = [];
        for (let i = 1; i <= 50; i++) {
            const category = sample(categories);
            const reporter = sample(reporters);
            const editor = sample(editors);
            
            const statusOptions = ["draft", "pending", "published", "returned"];
            // Force the first 35 to be 'published' so the public feed has plenty of data to show
            const status = i <= 35 ? "published" : sample(statusOptions);

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
                savedAt: new Date()
            };

            const articleData = {
                author: reporter._id,
                status: status,
                workingVersion: articleVersion, // Everyone has a working version
            };

            // If it's published, copy it to publishedVersion and add history
            if (status === "published") {
                articleData.publishedVersion = articleVersion;
                articleData.publicationHistory = [{
                    publishedAt: new Date(),
                    approvedBy: editor._id,
                    versionNumber: 1
                }];
            } else if (status === "returned") {
                articleData.editorNote = "Please fix the grammatical errors in the second paragraph before I can publish this.";
            }

            articlesToInsert.push(articleData);
        }

        // Insert all 50 articles in bulk
        await Article.insertMany(articlesToInsert);
        console.log(`Successfully seeded ${articlesToInsert.length} distinct articles with Picsum images!`);

        console.log("Seeding process finished completely.");
        process.exit(0);
    } catch (error) {
        console.error("Error during seeding:", error);
        process.exit(1);
    }
}

seedDatabase();
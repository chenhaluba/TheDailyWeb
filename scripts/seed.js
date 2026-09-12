require("dotenv").config();

const Article = require("../models/Article");
const User = require("../models/User");
const mongoose = require("mongoose");
const connectDatabase = require("../config/database");
const bcrypt = require("bcrypt");

const seedDatabase = async () =>{
    try{
        await connectDatabase()
        console.log("Connecting to Db and starting seed process...");

        await Article.deleteMany({});
        await User.deleteMany({});
        console.log("Cleared old data...");

        const hashedEditorPass = await bcrypt.hash("main_editor", 10);
        const hashedReporterPass = await bcrypt.hash("star_reporter", 10);

        const editor = await User.create({
            username: "main_editor",
            passwordHash: hashedEditorPass,
            displayName: "Alice The Editor",
            role: "editor",
            isActive: true
        });

        const reporter = await User.create({
            username: "star_reporter",
            passwordHash: hashedReporterPass,
            displayName: "Bob The Reporter",
            role: "reporter",
            isActive: true
        });

        console.log("Created dummy users with hashed passwords...");

        const articles = [
            // 1. Published Article
            {
                author: reporter._id,
                status: "published",
                publishedVersion: {
                    title: "Tech Giant Unveils Revolutionary Quantum Computer",
                    summary: "The new quantum machine promises to solve complex problems in seconds, revolutionizing the tech industry.",
                    content: "In a highly anticipated press conference today, the leading tech corporation announced their breakthrough in quantum computing. The new processor, boasting 1000 qubits, aims to tackle simulations that were previously impossible for classical computers. Experts believe this will change the fields of cryptography and medicine forever.",
                    category: "Technology",
                    mainImage: "quantum-launch.jpg"
                },
                workingVersion: {
                    title: "Tech Giant Unveils Revolutionary Quantum Computer",
                    summary: "The new quantum machine promises to solve complex problems in seconds, revolutionizing the tech industry.",
                    content: "In a highly anticipated press conference today, the leading tech corporation announced their breakthrough in quantum computing. The new processor, boasting 1000 qubits, aims to tackle simulations that were previously impossible for classical computers. Experts believe this will change the fields of cryptography and medicine forever.",
                    category: "Technology",
                    mainImage: "quantum-launch.jpg"
                },
                totalViews: 1250,
                publicationHistory: [
                    {
                        publishedAt: new Date(),
                        approvedBy: editor._id,
                        versionNumber: 1
                    }
                ]
            },

            // 2. Draft Article
            {
                author: reporter._id,
                status: "draft",
                publishedVersion: null,
                workingVersion: {
                    title: "Global Markets Rally Despite Economic Uncertainty",
                    summary: "Stock markets around the world saw significant gains today as investors remain optimistic.",
                    content: "Major indices closed in the green today, surprising many financial analysts. The surge comes after the central bank hinted at stabilizing interest rates. Investors are now closely watching the upcoming quarterly reports from major retail sectors.",
                    category: "Economy",
                    mainImage: "market-rally.jpg"
                },
                editorNote: "Please add some quotes from the lead financial analyst in the second paragraph before submitting for review.",
                totalViews: 0
            },

            // 3. Pending Article
            {
                author: reporter._id,
                status: "pending",
                publishedVersion: null,
                workingVersion: {
                    title: "New Mars Rover Sends Stunning High-Resolution Images",
                    summary: "The latest exploration rover has transmitted breathtaking photos of the Martian landscape.",
                    content: "Space agency officials released a new batch of images from the red planet today. The rover's advanced camera system captured intricate details of a massive crater, providing unprecedented insights into the planet's geological history.",
                    category: "Science",
                    mainImage: "mars-rover.png"
                },
                editorNote: "",
                totalViews: 0
            }
        ];

        await Article.insertMany(articles);
        console.log("Successfully seeded dummy articles!");

        console.log("Created dummy users...");

    }catch (error){
        console.error("Error seeding database:", error);
        process.exit(1);
    }
}



seedDatabase().then(() => {
    console.log("Seeding process finished completely.");
    process.exit(0);
});
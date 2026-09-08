const mongoose = require("mongoose");

const viewStatisticSchema = new mongoose.Schema(
    {
        article: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Article",
            required: true
        },

        bucketStart: {
            type: Date,
            required: true
        },

        viewCount: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

viewStatisticSchema.index(
    {
        article: 1,
        bucketStart: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model(
    "ViewStatistic",
    viewStatisticSchema
);
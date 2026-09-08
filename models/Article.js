const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({

    title: { type: String, required: true },
  summary: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, required: true },
  mainImage: { type: String, required: true }, // a path or url for the image of the article

  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publishDate: { type: Date },

  status: {
    type: String,
    enum: ['draft', 'published', 'waitingApprove', 'requireFix'],
    default: 'Draft'
  },
  editorNote: { type: String, default: '' },

  draft: { // duplicate stat that save the edited page
    title: String,
    summary: String,
    content: String,
    category: String,
    mainImage: String, // a path or url for the image of the article
    isDirty: { type: Boolean, default: false } // marks if there is a draft open waiting for approval
  },

  updateHistory: [{
    updatedAt: { type: Date, default: Date.now } // array of objects, each one holds the time of the update of the article
  }]
}, {
  timestamps: true // adds automaticly a createa and udpate fields to the article itself
});

const Article = mongoose.model('Article', articleSchema); // Article is the name of the collection in the database

module.exports = Article; // share article.js file to other files in project
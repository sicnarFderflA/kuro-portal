// models/ExternalReviewer.js
const mongoose = require('mongoose');

const ExternalReviewerSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: { type: String },
    department: { type: String },
    expertise: [String],
    isActive: { type: Boolean, default: true },
    addedBy: { type: String },
    addedAt: { type: Date, default: Date.now },
    lastAssignedAt: { type: Date },
    totalAssignments: { type: Number, default: 0 }
});

module.exports = mongoose.model('ExternalReviewer', ExternalReviewerSchema);
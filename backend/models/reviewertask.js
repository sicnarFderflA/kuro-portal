const mongoose = require('mongoose');

const ReviewerTaskSchema = new mongoose.Schema({
    reviewerEmail: { type: String, required: true, index: true },
    applicationId: { type: String, required: true, index: true },
    grantTitle: String,
    proposalTitle: String,
    applicantEmail: String,
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    assignedDate: Date,
    dueDate: Date,
    submittedDate: Date,
    createdAt: { type: Date, default: Date.now },
});

ReviewerTaskSchema.index({ reviewerEmail: 1, status: 1 });

module.exports = mongoose.model('ReviewerTask', ReviewerTaskSchema);
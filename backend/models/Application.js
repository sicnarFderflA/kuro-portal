// models/Application.js
const mongoose = require('mongoose');

// Define schema FIRST
const applicationSchema = new mongoose.Schema({
    // Basic Info
    id: { type: String, required: true, unique: true },
    userEmail: { type: String, required: true, index: true },
    grantTitle: { type: String, required: true },
    proposalTitle: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['Awaiting Signatures', 'Pending Eligibility Check', 'Pending Secondary Check', 'Pending Final Check', 'Approved', 'Returned'],
        default: 'Awaiting Signatures' 
    },
    submittedDate: { type: String, required: true },
    
    // Principal Investigator
    piName: { type: String, required: true },
    piEmail: { type: String, required: true },
    dept: { type: String, required: true },
    school: { type: String, required: true },
    extension: { type: String },
    duration: { type: String, required: true },
    
    // Proposal Content
    rationale: { type: String, required: true },
    litReview: { type: String },
    objectives: { type: String, required: true },
    methodology: { type: String, required: true },
    outputs: { type: String, required: true },
    references: [{ type: String }],
    
    // Research Team
    teamMembers: [{
        name: { type: String },
        role: { type: String }
    }],
    
    // Activities
    activities: [{
        name: { type: String },
        description: { type: String },
        objective: { type: String },
        output: { type: String },
        startDate: { type: String },
        endDate: { type: String }
    }],
    
    // Budget Items
    budgetItems: [{
        category: { type: String },
        subcategory: { type: String },
        itemName: { type: String },
        specs: { type: String },
        unitCost: { type: Number },
        qty: { type: Number }
    }],
    
    // Form 2 - Endorsement
    endorsementDate: { type: String },
    endorseDept: { type: String },
    endorseSchool: { type: String },
    schoolYear: { type: String },
    
    // Signatures
    fromChair: { type: String, required: true },
    chairEmail: { type: String, required: true },
    deanName: { type: String, required: true },
    deanEmail: { type: String, required: true },
    signatures: {
        chair: { signed: { type: Boolean, default: false }, signedDate: Date },
        dean: { signed: { type: Boolean, default: false }, signedDate: Date }
    },
    signatureRequests: {
        chairToken: String,
        deanToken: String,
        sentAt: Date,
        emailsSent: { type: Boolean, default: false },
        resendCount: { type: Number, default: 0 }
    },
    
    // Review Feedback
    returnedFeedback: { type: String },
    check1Feedback: { type: String },
    check2Feedback: { type: String },
    check3Feedback: { type: String },
    check1CompletedAt: Date,
    check2CompletedAt: Date,
    check3CompletedAt: Date,
    approvedAt: Date,
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

    assignedReviewers: [{
        email: String,
        name: String,
        assignedAt: String,
        assignedBy: String,
        status: { type: String, default: 'pending' }
    }],

    // CV Uploads - Data fields
    piCVName: { type: String },
    piCVData: { type: String },
    teamCVs: [{
        name: { type: String },
        data: { type: String },
        status: { type: String, default: 'pending' }
    }],
    uploadFeedback: { type: String },

}, { strict: false });

// ========== PERFORMANCE INDEXES ==========
// These indexes dramatically speed up queries

// 1. Faculty dashboard - Get user's applications sorted by date
applicationSchema.index({ userEmail: 1, submittedDate: -1 });

// 2. Admin dashboard - Filter by status
applicationSchema.index({ status: 1, submittedDate: -1 });

// 3. Admin dashboard - Filter by grant
applicationSchema.index({ grantTitle: 1, submittedDate: -1 });

// 4. Faculty filtering by status
applicationSchema.index({ userEmail: 1, status: 1 });

// 5. Reviewer tasks - Find by assigned reviewer
applicationSchema.index({ 'assignedReviewers.email': 1 });

// 6. Signature links - Quick token lookup
applicationSchema.index({ 'signatureRequests.chairToken': 1 });
applicationSchema.index({ 'signatureRequests.deanToken': 1 });

// 7. Date-based reports
applicationSchema.index({ submittedDate: -1 });

// 8. CV status filtering (admin)
applicationSchema.index({ piCVStatus: 1 });
applicationSchema.index({ 'teamCVs.status': 1 });

// 9. Combined admin filters (status + grant)
applicationSchema.index({ status: 1, grantTitle: 1 });

// 10. Full-text search on proposal title (for search functionality)
applicationSchema.index({ proposalTitle: 'text' });

console.log('📊 Application indexes configured');

// Create or get existing model (SINGLE export)
const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema);

// Ensure indexes are created (MongoDB will create them automatically)
// This is just for logging
if (mongoose.connection.readyState === 1) {
    Application.syncIndexes().then(() => {
        console.log('✅ Application indexes synced');
    }).catch(err => {
        console.error('⚠️ Index sync warning:', err.message);
    });
    console.log('✅ Application model connected to:', mongoose.connection.host);
}

module.exports = Application;
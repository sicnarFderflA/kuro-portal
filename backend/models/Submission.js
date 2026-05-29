// models/Submission.js
const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    // Basic Info
    id: { type: String, required: true, unique: true },
    userEmail: { type: String, required: true, index: true },
    grantTitle: { type: String, required: true },
    proposalTitle: { type: String, required: true },
    status: { type: String, default: 'Awaiting Signatures' },
    submittedDate: { type: String, required: true },
    
    // Principal Investigator
    piName: { type: String, required: true },
    piEmail: { type: String, required: true },
    dept: { type: String, required: true },
    school: { type: String, required: true },
    extension: { type: String },  // ← ADD THIS
    duration: { type: String, required: true },  // ← ADD THIS
    
    // Proposal Content
    rationale: { type: String, required: true },
    litReview: { type: String },  // ← ADD THIS
    objectives: { type: String, required: true },
    methodology: { type: String, required: true },
    outputs: { type: String, required: true },
    references: [{ type: String }],
    
    // Research Team (FIX THIS - array of objects)
    teamMembers: [{
        name: { type: String },
        role: { type: String }
    }],
    
    // Activities (FIX THIS - array of objects)
    activities: [{
        name: { type: String },
        description: { type: String },
        objective: { type: String },
        output: { type: String },
        startDate: { type: String },
        endDate: { type: String }
    }],
    
    // Budget Items (FIX THIS - array of objects)
    budgetItems: [{
        category: { type: String },
        subcategory: { type: String },
        itemName: { type: String },
        specs: { type: String },
        unitCost: { type: Number },
        qty: { type: Number }
    }],
    
    // Form 2 - Endorsement Information (ADD THESE)
    endorsementDate: { type: String },
    endorseDept: { type: String },  // ← ADD THIS
    endorseSchool: { type: String },  // ← ADD THIS
    schoolYear: { type: String },  // ← ADD THIS
    
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
    
    // CV Uploads
    piCVName: { type: String },
    piCVStatus: { type: String, default: 'pending' },
    teamCVs: [{
        name: { type: String },
        status: { type: String, default: 'pending' }
    }],
    uploadFeedback: { type: String },
    
    // Review Feedback
    returnedFeedback: { type: String },
    check1Feedback: { type: String },
    check2Feedback: { type: String },
    check3Feedback: { type: String },
    check1CompletedAt: Date,
    check2CompletedAt: Date,
    check3CompletedAt: Date,
    approvedAt: Date,
    returnedAt: Date,
    returnedFromStage: String,
    
    // External Review
    externalReview: {
        assigned: { type: Boolean, default: false },
        assignedAt: Date,
        assignedBy: String,
        reviewers: [{
            email: String,
            name: String,
            status: { type: String, default: 'pending' },
            assignedAt: Date,
            completedAt: Date,
            evaluation: {
                scores: {
                    technicalMerit: Number,
                    innovation: Number,
                    feasibility: Number,
                    impact: Number
                },
                comments: String,
                recommendation: String
            }
        }]
    },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { 
    // IMPORTANT: Add strict: false to allow any fields not defined in schema
    strict: false 
});

module.exports = mongoose.models.Submission || mongoose.model('Submission', submissionSchema);
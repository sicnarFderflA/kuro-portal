const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    userEmail: { type: String, required: true }, 
    grantTitle: { type: String, required: true },
    proposalTitle: { type: String, required: true },
    status: { type: String, default: 'Awaiting Signatures' }, 
    submittedDate: { type: String, required: true },
    
    // Principal Investigator
    piName: { type: String, required: true },
    piEmail: { type: String, required: true },
    piCVName: { type: String },
    piCVStatus: { type: String, default: 'pending', enum: ['pending', 'eligible', 'ineligible', 'missing'] },
    
    // Organization
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
    
    // Team
    teamMembers: [{
        name: { type: String, required: true },
        role: { type: String }
    }],
    teamCVs: [{
        name: { type: String },
        status: { type: String, default: 'pending', enum: ['pending', 'eligible', 'ineligible', 'missing'] }
    }],
    
    // Activities
    activities: [{
        name: { type: String, required: true },
        description: { type: String },
        objective: { type: String },
        output: { type: String },
        startDate: { type: String },
        endDate: { type: String }
    }],
    
    // Budget
    budgetItems: [{
        category: { type: String, required: true },
        subcategory: { type: String },
        itemName: { type: String, required: true },
        specs: { type: String },
        unitCost: { type: Number, required: true, min: 0 },
        qty: { type: Number, required: true, min: 1 }
    }],
    
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
        emailsSent: { type: Boolean, default: false }
    },
    
    // Review
    statusHistory: [{
        status: String,
        updatedBy: String,
        updatedAt: { type: Date, default: Date.now },
        feedback: String
    }],
    returnedFeedback: String,
    uploadFeedback: String,
    
    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
submissionSchema.index({ userEmail: 1 });
submissionSchema.index({ status: 1 });
submissionSchema.index({ submittedDate: -1 });

module.exports = mongoose.models.Submission || mongoose.model('Submission', submissionSchema);
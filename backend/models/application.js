const mongoose = require('mongoose');

const SignatureSchema = new mongoose.Schema({
    signed: { type: Boolean, default: false },
    signedDate: Date,
    signerEmail: String,
    signerName: String,
});

const TeamMemberSchema = new mongoose.Schema({
    name: String,
    role: String,
});

const TeamCVSchema = new mongoose.Schema({
    name: String,
    status: { type: String, enum: ['pending', 'eligible', 'ineligible', 'missing'], default: 'pending' },
});

const BudgetItemSchema = new mongoose.Schema({
    category: String,
    subcategory: String,
    itemName: String,
    specs: String,
    unitCost: Number,
    qty: { type: Number, default: 1 },
});

const ActivitySchema = new mongoose.Schema({
    name: String,
    description: String,
    objective: String,
    output: String,
    startDate: String,
    endDate: String,
});

const ReviewerFeedbackSchema = new mongoose.Schema({
    reviewerEmail: String,
    reviewerName: String,
    score: Number,
    recommendation: String,
    strengths: String,
    weaknesses: String,
    comments: String,
    adminNotes: String,
    submittedDate: Date,
});

const FinalReportReviewSchema = new mongoose.Schema({
    evaluations: mongoose.Schema.Types.Mixed,
    recommendation: String,
    narrativeFeedback: String,
    revisionReasons: [String],
    submittedDate: Date,
    reviewerName: String,
    reviewerEmail: String,
});

const SignatureRequestSchema = new mongoose.Schema({
    sentAt: Date,
    chairToken: String,
    deanToken: String,
    chairResendCount: { type: Number, default: 0 },
    deanResendCount: { type: Number, default: 0 },
});

const ApplicationSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    applicantEmail: { type: String, required: true, index: true },
    grantTitle: { type: String, required: true },
    grantType: { type: String, default: 'Faculty Research Grant' },
    proposalTitle: { type: String, required: true },
    submittedDate: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['Awaiting Signatures', 'Pending Eligibility Check', 'Pending Secondary Check', 'Pending Final Check', 'Approved', 'Returned', 'Under Review', 'External Review'],
        default: 'Awaiting Signatures'
    },
    
    // Form 1: Project Profile
    piName: String,
    piEmail: String,
    dept: String,
    school: String,
    extension: String,
    duration: String,
    rationale: String,
    litReview: String,
    objectives: String,
    methodology: String,
    outputs: String,
    references: [String],
    teamMembers: [TeamMemberSchema],
    activities: [ActivitySchema],
    budgetItems: [BudgetItemSchema],
    
    // Form 2: Endorsement
    endorsementDate: String,
    fromChair: String,
    chairEmail: String,
    endorseDept: String,
    endorseSchool: String,
    schoolYear: String,
    deanName: String,
    deanEmail: String,
    
    // Signatures
    signatures: {
        chair: SignatureSchema,
        dean: SignatureSchema,
    },
    signatureRequests: SignatureRequestSchema,
    
    // CVs
    piCVName: String,
    piCVStatus: { type: String, enum: ['pending', 'eligible', 'ineligible', 'missing'], default: 'missing' },
    teamCVs: [TeamCVSchema],
    uploadFeedback: String,
    
    // Check Stages
    check1Feedback: String,
    check1CompletedAt: Date,
    check2Feedback: String,
    check2CompletedAt: Date,
    check3Feedback: String,
    check3CompletedAt: Date,
    approvedAt: Date,
    
    // Returned info
    returnedFeedback: String,
    returnedFromStage: String,
    returnedAt: Date,
    
    // External Reviewers
    assignedReviewers: [{
        email: String,
        name: String,
        assignedAt: Date,
    }],
    reviewerFeedbacks: [ReviewerFeedbackSchema],
    finalReportReview: {
        reviewerFeedbacks: mongoose.Schema.Types.Mixed,
    },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

ApplicationSchema.index({ applicantEmail: 1, status: 1 });
ApplicationSchema.index({ status: 1 });

module.exports = mongoose.model('Application', ApplicationSchema);
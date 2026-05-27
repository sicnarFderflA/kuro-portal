const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    applicantEmail: { type: String, required: true, index: true },
    grantTitle: { type: String, required: true },
    proposalTitle: { type: String, required: true },
    submittedDate: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['Awaiting Signatures', 'Pending Eligibility Check', 'Pending Secondary Check', 'Pending Final Check', 'Approved', 'Returned'],
        default: 'Awaiting Signatures'
    },
    piName: String,
    piEmail: String,
    dept: String,
    school: String,
    rationale: String,
    methodology: String,
    objectives: String,
    outputs: String,
    references: [String],
    teamMembers: [{ name: String, role: String }],
    budgetItems: [{ category: String, itemName: String, unitCost: Number, qty: Number }],
    fromChair: String,
    chairEmail: String,
    deanName: String,
    deanEmail: String,
    signatures: {
        chair: { signed: Boolean, signedDate: Date, signerEmail: String, signerName: String },
        dean: { signed: Boolean, signedDate: Date, signerEmail: String, signerName: String }
    },
    piCVName: String,
    piCVStatus: { type: String, enum: ['pending', 'eligible', 'ineligible', 'missing'], default: 'missing' },
    teamCVs: [{ name: String, status: { type: String, enum: ['pending', 'eligible', 'ineligible', 'missing'], default: 'pending' } }],
    check1Feedback: String,
    check1CompletedAt: Date,
    check2Feedback: String,
    check2CompletedAt: Date,
    check3Feedback: String,
    check3CompletedAt: Date,
    approvedAt: Date,
    returnedFeedback: String,
    assignedReviewers: [{ email: String, name: String, assignedAt: Date }]
}, { timestamps: true });

module.exports = mongoose.model('Application', ApplicationSchema);
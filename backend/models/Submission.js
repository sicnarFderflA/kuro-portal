// models/Submission.js (Enhanced from your existing file)
const submissionSchema = new mongoose.Schema({
    // ========== BASIC INFO ==========
    id: { type: String, required: true, unique: true },
    userEmail: { type: String, required: true, index: true },
    grantTitle: { type: String, required: true },
    grantType: { type: String, default: 'Faculty Research Grant' },
    proposalTitle: { type: String, required: true },
    status: { 
        type: String, 
        enum: [
            'Awaiting Signatures', 
            'Pending Eligibility Check', 
            'Pending Secondary Check', 
            'Pending Final Check', 
            'Approved', 
            'Returned'
        ],
        default: 'Awaiting Signatures' 
    },
    submittedDate: { type: String, required: true },
    
    // ========== FORM 1 - PROJECT PROFILE ==========
    piName: { type: String, required: true },
    piEmail: { type: String, required: true },
    dept: { type: String, required: true },
    school: { type: String, required: true },
    extension: { type: String },
    duration: { type: String, required: true },
    
    // ========== FORM 1 - PROPOSAL CONTENT ==========
    rationale: { type: String, required: true },
    litReview: { type: String },
    objectives: { type: String, required: true },
    methodology: { type: String, required: true },
    outputs: { type: String, required: true },
    references: [{ type: String }],
    
    // ========== RESEARCH TEAM MEMBERS ==========
    teamMembers: [{
        name: { type: String },
        role: { type: String }
    }],
    
    // ========== ACTIVITIES / WORKPLAN ==========
    activities: [{
        name: { type: String },
        description: { type: String },
        objective: { type: String },
        output: { type: String },
        startDate: { type: String },
        endDate: { type: String }
    }],
    
    // ========== BUDGET ITEMS ==========
    budgetItems: [{
        category: { type: String },
        subcategory: { type: String },
        itemName: { type: String },
        specs: { type: String },
        unitCost: { type: Number },
        qty: { type: Number }
    }],
    
    // ========== FORM 2 - ENDORSEMENT INFORMATION ==========
    endorsementDate: { type: String },
    endorseDept: { type: String },
    endorseSchool: { type: String },
    schoolYear: { type: String },
    
    // ========== FORM 2 - SIGNATURES ==========
    fromChair: { type: String, required: true },
    chairEmail: { type: String, required: true },
    deanName: { type: String, required: true },
    deanEmail: { type: String, required: true },
    
    // ========== SIGNATURE STATUS ==========
    signatures: {
        chair: { 
            signed: { type: Boolean, default: false }, 
            signedDate: Date,
            signerEmail: String,
            signerName: String
        },
        dean: { 
            signed: { type: Boolean, default: false }, 
            signedDate: Date,
            signerEmail: String,
            signerName: String
        }
    },
    signatureRequests: {
        chairToken: String,
        deanToken: String,
        sentAt: Date,
        emailsSent: { type: Boolean, default: false },
        resendCount: { type: Number, default: 0 }
    },
    
    // ========== CV UPLOADS ==========
    piCVName: { type: String },
    piCVStatus: { 
        type: String, 
        enum: ['pending', 'eligible', 'ineligible', 'missing'], 
        default: 'missing' 
    },
    teamCVs: [{
        name: { type: String },
        status: { 
            type: String, 
            enum: ['pending', 'eligible', 'ineligible', 'missing'], 
            default: 'pending' 
        }
    }],
    uploadFeedback: { type: String },
    
    // ========== REVIEW FEEDBACK (CHECK STAGES) ==========
    returnedFeedback: { type: String },
    returnedFromStage: { type: String },
    returnedAt: Date,
    
    check1Feedback: { type: String },
    check1CompletedAt: Date,
    
    check2Feedback: { type: String },
    check2CompletedAt: Date,
    
    check3Feedback: { type: String },
    check3CompletedAt: Date,
    
    approvedAt: Date,
    
    // ========== EXTERNAL REVIEWERS ==========
    externalReview: {
        assigned: { type: Boolean, default: false },
        assignedAt: Date,
        assignedBy: String,
        dueDate: Date,
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
    
    // ========== TIMESTAMPS ==========
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }

}, { strict: false });  // Allows flexibility for additional fields
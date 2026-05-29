// models/Draft.js
const mongoose = require('mongoose');

const draftSchema = new mongoose.Schema({
    draftId: { type: String, required: true, unique: true },
    userEmail: { type: String, required: true, index: true },
    grantTitle: { type: String, required: true },
    proposalTitle: String,
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
    teamMembers: [{
        name: String,
        role: String
    }],
    activities: [{
        name: String,
        description: String,
        objective: String,
        output: String,
        startDate: String,
        endDate: String
    }],
    budgetItems: [{
        category: String,
        subcategory: String,
        itemName: String,
        specs: String,
        unitCost: Number,
        qty: Number
    }],
    endorsementDate: String,
    endorseDept: String,
    endorseSchool: String,
    schoolYear: String,
    fromChair: String,
    chairEmail: String,
    deanName: String,
    deanEmail: String,
    piCVName: String,
    piCVStatus: { type: String, default: 'pending' },
    teamCVs: [{
        name: String,
        status: { type: String, default: 'pending' }
    }],
    lastSaved: String,
    lastSavedTime: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.models.Draft || mongoose.model('Draft', draftSchema);
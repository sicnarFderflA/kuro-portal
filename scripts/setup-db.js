// scripts/setup-db.js
// This script sets up the MongoDB database for KURO system

console.log('🚀 Starting KURO Database Setup...');

// Try to load dotenv, but don't crash if it's not there
try {
    require('dotenv').config();
    console.log('✅ dotenv loaded');
} catch (e) {
    console.log('⚠️ dotenv not found, using direct connection');
}

const mongoose = require('mongoose');

// Use your existing MongoDB connection string
const MONGODB_URI = 'mongodb+srv://200520181_db_user:200520181_db_password@kuro-database.neg1meg.mongodb.net/?appName=KURO-Database';

// Define schemas directly in the script (so we don't need model files)
const submissionSchema = new mongoose.Schema({
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
    teamMembers: [{ name: String, role: String }],
    activities: [{
        name: String, description: String, objective: String,
        output: String, startDate: String, endDate: String
    }],
    budgetItems: [{
        category: String, subcategory: String, itemName: String,
        specs: String, unitCost: Number, qty: Number
    }],
    endorsementDate: String,
    endorseDept: String,
    endorseSchool: String,
    schoolYear: String,
    fromChair: String,
    chairEmail: String,
    deanName: String,
    deanEmail: String,
    signatures: {
        chair: { signed: { type: Boolean, default: false }, signedDate: Date },
        dean: { signed: { type: Boolean, default: false }, signedDate: Date }
    },
    signatureRequests: {
        chairToken: String, deanToken: String, sentAt: Date,
        emailsSent: { type: Boolean, default: false }, resendCount: { type: Number, default: 0 }
    },
    piCVName: String,
    piCVStatus: { type: String, default: 'pending' },
    teamCVs: [{ name: String, status: { type: String, default: 'pending' } }],
    uploadFeedback: String,
    returnedFeedback: String,
    check1Feedback: String, check1CompletedAt: Date,
    check2Feedback: String, check2CompletedAt: Date,
    check3Feedback: String, check3CompletedAt: Date,
    approvedAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false });

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
    teamMembers: [{ name: String, role: String }],
    activities: [{
        name: String, description: String, objective: String,
        output: String, startDate: String, endDate: String
    }],
    budgetItems: [{
        category: String, subcategory: String, itemName: String,
        specs: String, unitCost: Number, qty: Number
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
    teamCVs: [{ name: String, status: { type: String, default: 'pending' } }],
    lastSaved: String,
    lastSavedTime: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false });

const notificationSchema = new mongoose.Schema({
    userEmail: { type: String, required: true, index: true },
    type: String,
    title: String,
    message: String,
    appId: String,
    tab: String,
    icon: String,
    color: String,
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const signatureRequestSchema = new mongoose.Schema({
    appId: { type: String, required: true, index: true },
    chairToken: { type: String, unique: true, sparse: true },
    deanToken: { type: String, unique: true, sparse: true },
    chairEmail: String,
    chairName: String,
    deanEmail: String,
    deanName: String,
    chairCompleted: { type: Boolean, default: false },
    deanCompleted: { type: Boolean, default: false },
    chairSignedAt: Date,
    deanSignedAt: Date,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    revoked: { type: Boolean, default: false }
});

const researchGrantSchema = new mongoose.Schema({
    grantCode: { type: String, required: true, unique: true },
    grantName: { type: String, required: true },
    amountRange: String,
    focus: String,
    eligibility: String,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

const checkerSettingSchema = new mongoose.Schema({
    role: { type: String, enum: ['check1', 'check2', 'check3'], unique: true },
    assignedEmail: String,
    assignedName: String,
    updatedBy: String,
    updatedAt: { type: Date, default: Date.now }
});

// Create models
const Submission = mongoose.model('Submission', submissionSchema);
const Draft = mongoose.model('Draft', draftSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const SignatureRequest = mongoose.model('SignatureRequest', signatureRequestSchema);
const ResearchGrant = mongoose.model('ResearchGrant', researchGrantSchema);
const CheckerSetting = mongoose.model('CheckerSetting', checkerSettingSchema);

async function setupDatabase() {
    try {
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Drop existing collections to start fresh (optional - remove if you want to keep data)
        // console.log('🗑️ Dropping existing collections...');
        // await mongoose.connection.db.dropDatabase();
        
        // Create indexes
        console.log('📇 Creating indexes...');
        
        await Submission.collection.createIndex({ id: 1 }, { unique: true });
        await Submission.collection.createIndex({ userEmail: 1 });
        await Submission.collection.createIndex({ status: 1 });
        await Submission.collection.createIndex({ userEmail: 1, status: 1 });
        await Submission.collection.createIndex({ submittedDate: -1 });
        console.log('  ✅ Submission indexes created');
        
        await Draft.collection.createIndex({ draftId: 1 }, { unique: true });
        await Draft.collection.createIndex({ userEmail: 1 });
        console.log('  ✅ Draft indexes created');
        
        await Notification.collection.createIndex({ userEmail: 1 });
        await Notification.collection.createIndex({ userEmail: 1, isRead: 1 });
        await Notification.collection.createIndex({ createdAt: -1 });
        console.log('  ✅ Notification indexes created');
        
        await SignatureRequest.collection.createIndex({ appId: 1 });
        await SignatureRequest.collection.createIndex({ chairToken: 1 }, { unique: true, sparse: true });
        await SignatureRequest.collection.createIndex({ deanToken: 1 }, { unique: true, sparse: true });
        console.log('  ✅ SignatureRequest indexes created');
        
        await ResearchGrant.collection.createIndex({ grantCode: 1 }, { unique: true });
        console.log('  ✅ ResearchGrant indexes created');
        
        await CheckerSetting.collection.createIndex({ role: 1 }, { unique: true });
        console.log('  ✅ CheckerSetting indexes created\n');
        
        // Seed research grants
        console.log('🌱 Seeding research grants...');
        
        const grants = [
            { grantCode: "IR", grantName: "Institutional Research (IR) Award", amountRange: "Php 20,000 - Php 75,000", isActive: true },
            { grantCode: "MBHR", grantName: "Miguel Bernad Humanities Research (MBHR) Award", amountRange: "up to Php 80,000", isActive: true },
            { grantCode: "MR", grantName: "Mindanao Research (MR) Award", amountRange: "Php 400,000 - Php 2,000,000", isActive: true },
            { grantCode: "MRR", grantName: "Matteo Ricci Research (MRR) Award", amountRange: "up to Php 200,000", isActive: true },
            { grantCode: "KSRA", grantName: "Kinaadman Student Research Award (KSRA)", amountRange: "up to Php 30,000", isActive: true }
        ];
        
        for (const grant of grants) {
            await ResearchGrant.updateOne(
                { grantCode: grant.grantCode },
                { $set: grant },
                { upsert: true }
            );
        }
        console.log('  ✅ Research grants seeded\n');
        
        // Seed checker settings
        console.log('👥 Seeding checker settings...');
        
        const checkerSettings = [
            { role: "check1", assignedEmail: "eligibility@xu.edu.ph", assignedName: "Eligibility Officer" },
            { role: "check2", assignedEmail: "secondary@xu.edu.ph", assignedName: "Secondary Checker" },
            { role: "check3", assignedEmail: "finalapprover@xu.edu.ph", assignedName: "Final Approver" }
        ];
        
        for (const setting of checkerSettings) {
            await CheckerSetting.updateOne(
                { role: setting.role },
                { $set: setting },
                { upsert: true }
            );
        }
        console.log('  ✅ Checker settings seeded\n');
        
        // Show results
        console.log('📊 Database Setup Complete!');
        console.log('=' .repeat(50));
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections created:');
        collections.forEach(col => console.log(`  - ${col.name}`));
        
        console.log('\n✅ Setup finished successfully!');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run the setup
setupDatabase();
// migrate.js
const mongoose = require('mongoose');
require('dotenv').config();

// Use your existing MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://200520181_db_user:200520181_db_password@kuro-database.neg1meg.mongodb.net/kuro_portal?retryWrites=true&w=majority&appName=KURO-Database';

// Define a simple schema for migration (no need to import from models)
const submissionSchema = new mongoose.Schema({
    any: mongoose.Schema.Types.Mixed
}, { strict: false });

const Submission = mongoose.model('Submission', submissionSchema, 'submissions');

async function migrate() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Find all submissions without userEmail but with applicantEmail
        const submissionsToMigrate = await Submission.find({
            userEmail: { $exists: false },
            applicantEmail: { $exists: true }
        });
        
        console.log(`📊 Found ${submissionsToMigrate.length} submissions to migrate\n`);
        
        let updatedCount = 0;
        
        for (const sub of submissionsToMigrate) {
            console.log(`🔄 Migrating: ${sub.id || sub._id}`);
            console.log(`   - applicantEmail: ${sub.applicantEmail}`);
            
            sub.userEmail = sub.applicantEmail;
            await sub.save();
            
            console.log(`   ✅ Added userEmail: ${sub.userEmail}\n`);
            updatedCount++;
        }
        
        // Also update any submissions that have userEmail but it's empty
        const emptyUserEmail = await Submission.find({
            userEmail: { $eq: "" },
            applicantEmail: { $exists: true }
        });
        
        for (const sub of emptyUserEmail) {
            console.log(`🔄 Fixing empty userEmail for: ${sub.id || sub._id}`);
            sub.userEmail = sub.applicantEmail;
            await sub.save();
            updatedCount++;
        }
        
        console.log('='.repeat(50));
        console.log(`✅ Migration complete! Updated ${updatedCount} submissions`);
        console.log('='.repeat(50));
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
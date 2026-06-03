// migrate.js
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://200520181_db_user:200520181_db_password@kuro-database.neg1meg.mongodb.net/kuro_portal?retryWrites=true&w=majority&appName=KURO-Database';

async function migrate() {
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('kuro_portal');
        
        // Get all data from kuro_portal.applications
        const allData = await db.collection('applications').find({}).toArray();
        console.log(`Found ${allData.length} documents in kuro_portal.applications`);
        
        if (allData.length > 0) {
            // Insert into kuro_portal.submissions
            const result = await db.collection('submissions').insertMany(allData);
            console.log(`✅ Inserted ${result.insertedCount} documents into kuro_portal.submissions`);
        }
        
        // Verify
        const count = await db.collection('submissions').countDocuments();
        console.log(`📊 Total documents in kuro_portal.submissions: ${count}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

migrate();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const emailjs = require('@emailjs/nodejs');
require('dotenv').config();


const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_CHAIR_TEMPLATE = process.env.EMAILJS_CHAIR_TEMPLATE;
const EMAILJS_DEAN_TEMPLATE = process.env.EMAILJS_DEAN_TEMPLATE;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

const app = express();

// CORS configuration
app.use(cors({
    origin: ['https://kuro-portal.vercel.app', 'http://localhost:5500', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://200520181_db_user:200520181_db_password@kuro-database.neg1meg.mongodb.net/kuro_portal?retryWrites=true&w=majority&appName=KURO-Database';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected successfully'))
    .catch(err => console.error('❌ MongoDB Connection error:', err));

// Google OAuth client
const googleClient = new OAuth2Client(
    '1074730624717-8u9auss3uqp5grgs7e4padhothotmfrf.apps.googleusercontent.com'
);

// User database (temporary - will move to MongoDB)
const usersDB = {
    '200520181@my.xu.edu.ph': {
        name: 'Super Admin',
        email: '200520181@my.xu.edu.ph',
        role: 'admin',
        isSuperAdmin: true
    },
    'alfredrabanes@gmail.com': {
        name: 'Alfred Rabanes',
        email: 'alfredrabanes@gmail.com',
        role: 'admin',
        checkerRole: 'check1'
    },
    'rabanes.francisalfred@gmail.com': {
        name: 'Francis Rabanes',
        email: 'rabanes.francisalfred@gmail.com',
        role: 'admin',
        checkerRole: 'check2'
    },
    'excitegaming04@gmail.com': {
        name: 'Excite Gaming',
        email: 'excitegaming04@gmail.com',
        role: 'admin',
        checkerRole: 'check3'
    }
};

// ========== GOOGLE AUTH ENDPOINT ==========
app.post('/api/auth/google', async (req, res) => {
    console.log('📥 Received auth request');
    
    try {
        const { credential, role } = req.body;
        
        if (!credential) {
            return res.status(400).json({ error: 'No credential provided' });
        }
        
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: '1074730624717-8u9auss3uqp5grgs7e4padhothotmfrf.apps.googleusercontent.com',
        });
        
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;
        const picture = payload.picture;
        
        console.log(`✅ User authenticated: ${email}`);
        
        // Get user from memory (will move to MongoDB)
        let user = usersDB[email];
        
        if (!user) {
            let userRole = email.endsWith('@xu.edu.ph') ? 'faculty' : 'student';
            user = {
                name: name,
                email: email,
                picture: picture,
                role: userRole,
                isSuperAdmin: false,
                checkerRole: null
            };
            usersDB[email] = user;
        }
        
        // Check role permission
        const isExempted = email === '200520181@my.xu.edu.ph';
        let allowed = false;
        
        if (role === 'student') allowed = (user.role === 'student' || isExempted);
        else if (role === 'faculty') allowed = (user.role === 'faculty' || isExempted);
        else if (role === 'admin') allowed = (user.isSuperAdmin || user.role === 'admin' || isExempted);
        
        if (!allowed) {
            return res.status(403).json({ error: `You cannot sign in as ${role}` });
        }
        
        res.json({
            success: true,
            token: 'jwt_token_' + Date.now(),
            user: {
                email: user.email,
                name: user.name,
                picture: user.picture || null,
                role: role,
                checkerRole: user.checkerRole,
                isSuperAdmin: user.isSuperAdmin || false
            }
        });
        
    } catch (error) {
        console.error('❌ Auth error:', error);
        res.status(500).json({ error: 'Authentication failed: ' + error.message });
    }
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ========== ROOT ENDPOINT ==========
app.get('/', (req, res) => {
    res.json({
        message: 'KURO API is running!',
        status: 'online',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        endpoints: {
            'POST /api/auth/google': 'Google OAuth login',
            'GET /health': 'Health check',
            'GET /api/faculty/applications': 'Get faculty applications',
            'GET /api/faculty/drafts': 'Get faculty drafts',
            'POST /api/faculty/drafts': 'Save faculty draft',
            'DELETE /api/faculty/drafts/:draftId': 'Delete faculty draft',
            'GET /api/my-submissions': 'Alias for faculty applications',
            'GET /api/applications/:id': 'Get single application',
            'POST /api/applications': 'Create application',
            'PUT /api/applications/:id': 'Update application',
            'DELETE /api/applications/:id': 'Delete application',
            'GET /api/admin/stats': 'Admin dashboard stats',
            'GET /api/admin/applications': 'Admin view all applications',
            'PUT /api/admin/applications/:id/status': 'Update application status',
            'GET /api/notifications': 'Get notifications'
        }
    });
});

// Import routes
const applicationsRoutes = require('./routes/applications');
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');
const Submission = require('./models/Submission');
const Draft = require('./models/Draft');

// Use routes
app.use('/api/applications', applicationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);

// ========== SINGLE APPLICATION ROUTES (Parameterized - MUST come AFTER specific routes) ==========
// But before faculty routes, these need to be in the right order

// Create new application (POST - no parameters, put this first)
app.post('/api/applications', async (req, res) => {
    try {
        const applicationData = req.body;
        
        // Validate required fields
        if (!applicationData.userEmail) {
            return res.status(400).json({ error: 'userEmail is required' });
        }
        
        // Create using the schema - this validates the data
        const submission = new Submission(applicationData);
        await submission.save();
        
        console.log('✅ Created application:', submission.id, 'for user:', submission.userEmail);
        res.json(submission);
        
    } catch (error) {
        console.error('Error creating application:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single application (GET with :id parameter)
app.get('/api/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🔍 GET single application:', id);
        
        const db = mongoose.connection.db;
        const application = await db.collection('submissions').findOne({ id: id });
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        res.json(application);
    } catch (error) {
        console.error('Error fetching application:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update application (PUT with :id parameter)
app.put('/api/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        updates.updatedAt = new Date();
        
        console.log('📝 PUT update application:', id);
        
        const db = mongoose.connection.db;
        
        // Check if application exists
        const existing = await db.collection('submissions').findOne({ id: id });
        if (!existing) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Update the application
        const result = await db.collection('submissions').updateOne(
            { id: id },
            { $set: updates }
        );
        
        console.log('✅ Updated:', id);
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error updating application:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete application (DELETE with :id parameter)
app.delete('/api/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ DELETE application:', id);
        
        const result = await Submission.findOneAndDelete({ id: id });
        
        if (!result) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        console.log('✅ Deleted application:', id);
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error deleting application:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== FACULTY ROUTES (Specific paths - NO parameters) ==========

// Get faculty applications
app.get('/api/faculty/applications', async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        console.log('📋 GET faculty applications for:', userEmail);
        
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        // Use the schema - this ensures consistent field names!
        const submissions = await Submission.find({ 
            userEmail: userEmail 
        }).sort({ submittedDate: -1 });
        
        console.log(`✅ Found ${submissions.length} submissions`);
        res.json(submissions);
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get faculty drafts
app.get('/api/faculty/drafts', async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        console.log('📋 GET faculty drafts for:', userEmail);
        
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        const drafts = await Draft.find({ userEmail: userEmail }).sort({ lastSaved: -1 });
        
        console.log(`✅ Found ${drafts.length} drafts`);
        res.json(drafts);
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save faculty draft
app.post('/api/faculty/drafts', async (req, res) => {
    try {
        const draftData = req.body;
        
        if (!draftData.userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        // Remove _id if it exists to avoid conflicts
        if (draftData._id) {
            delete draftData._id;
        }
        
        // Upsert using the schema
        const result = await Draft.findOneAndUpdate(
            { draftId: draftData.draftId, userEmail: draftData.userEmail },
            { $set: draftData },
            { upsert: true, new: true }
        );
        
        console.log('✅ Saved draft:', result.draftId);
        res.json({ success: true, draftId: result.draftId });
        
    } catch (error) {
        console.error('Error saving draft:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete faculty draft
app.delete('/api/faculty/drafts/:draftId', async (req, res) => {
    try {
        const { draftId } = req.params;
        const userEmail = req.query.userEmail;
        
        console.log('🗑️ DELETE draft:', draftId, 'for user:', userEmail);
        
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        const result = await Draft.findOneAndDelete({ 
            draftId: draftId, 
            userEmail: userEmail 
        });
        
        if (!result) {
            return res.status(404).json({ error: 'Draft not found' });
        }
        
        console.log('✅ Deleted draft:', draftId);
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error deleting draft:', error);
        res.status(500).json({ error: error.message });
    }
});

// Alias for faculty applications (my-submissions)
app.get('/api/my-submissions', async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        console.log('📋 My submissions requested for:', userEmail);
        
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        const db = mongoose.connection.db;
        
        // Get all submissions
        const allSubmissions = await db.collection('submissions').find({}).toArray();
        
        // Filter for this user
        const userSubmissions = allSubmissions.filter(sub => 
            sub.userEmail === userEmail
        );
        
        console.log(`✅ Found ${userSubmissions.length} submissions for ${userEmail}`);
        res.json(userSubmissions);
        
    } catch (error) {
        console.error('❌ Error fetching my submissions:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== REVIEWER ROUTES ==========
// Get reviewer tasks
app.get('/api/reviewer/tasks', async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        const db = mongoose.connection.db;
        
        // Find applications assigned to this reviewer based on their checker role
        // You'll need to define which applications go to which reviewer
        let assignedTasks = [];
        
        // Check if user has a checker role
        const user = usersDB[userEmail];
        if (user && user.checkerRole) {
            // For now, return empty array - implement based on your business logic
            assignedTasks = await db.collection('submissions').find({
                status: 'Pending Eligibility Check', // or whatever status
                // Add logic to filter by checker role
            }).toArray();
        }
        
        res.json({ 
            assignedTasks: assignedTasks,
            checkerRole: user?.checkerRole || null
        });
        
    } catch (error) {
        console.error('Error fetching reviewer tasks:', error);
        res.json({ assignedTasks: [] });
    }
});

// Update reviewer name (sync from Google)
app.put('/api/users/reviewer-name', async (req, res) => {
    try {
        const { email, name } = req.body;
        
        if (usersDB[email]) {
            usersDB[email].name = name;
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating reviewer name:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== SIGNATURE ROUTES ==========

// Generate signature links for an application
app.post('/api/applications/:appId/generate-signatures', async (req, res) => {
    try {
        const { appId } = req.params;
        const { chairEmail, chairName, deanEmail, deanName, proposalTitle, piName } = req.body;
        
        // Generate unique tokens for chair and dean
        const chairToken = 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '_chair';
        const deanToken = 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '_dean';
        
        // Store signature requests in database
        const db = mongoose.connection.db;
        
        const signatureRequest = {
            appId: appId,
            chairToken: chairToken,
            deanToken: deanToken,
            chairEmail: chairEmail,
            chairName: chairName,
            deanEmail: deanEmail,
            deanName: deanName,
            chairCompleted: false,
            deanCompleted: false,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days expiry
        };
        
        await db.collection('signature_requests').updateOne(
            { appId: appId },
            { $set: signatureRequest },
            { upsert: true }
        );
        
        // Update application with signature request info
        await db.collection('submissions').updateOne(
            { id: appId },
            { 
                $set: { 
                    signatureRequests: {
                        chairToken: chairToken,
                        deanToken: deanToken,
                        sentAt: new Date().toISOString()
                    }
                }
            }
        );
        
        // Generate signature links
        const baseUrl = 'https://kuro-portal.vercel.app'; // Your frontend URL
        const chairLink = `${baseUrl}/signature-confirm.html?token=${chairToken}&role=chair&id=${appId}`;
        const deanLink = `${baseUrl}/signature-confirm.html?token=${deanToken}&role=dean&id=${appId}`;
        
        res.json({ 
            success: true, 
            chairLink: chairLink, 
            deanLink: deanLink,
            chairToken: chairToken,
            deanToken: deanToken
        });
        
    } catch (error) {
        console.error('Error generating signature links:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send signature emails
app.post('/api/applications/:appId/send-signature-emails', async (req, res) => {
    try {
        const { appId } = req.params;
        const { chairLink, deanLink, chairEmail, deanEmail, chairName, deanName, expiryDays } = req.body;
        
        console.log(`📧 Sending signature emails for application: ${appId}`);
        console.log(`   Chair: ${chairEmail} (${chairName})`);
        console.log(`   Dean: ${deanEmail} (${deanName})`);
        
        let chairSuccess = false;
        let deanSuccess = false;
        
        // Send to Chair
        try {
            const chairParams = {
                to_email: chairEmail,
                to_name: chairName,
                chair_name: chairName,
                signature_link: chairLink,
                expiry_days: expiryDays || 7
            };
            
            const chairResponse = await emailjs.send(
                EMAILJS_SERVICE_ID, 
                EMAILJS_CHAIR_TEMPLATE, 
                chairParams,
                {
                    publicKey: EMAILJS_PUBLIC_KEY,
                    privateKey: EMAILJS_PRIVATE_KEY
                }
            );
            
            console.log('Chair email sent:', chairResponse.status);
            chairSuccess = true;
        } catch (error) {
            console.error('Chair email failed:', error);
        }
        
        // Send to Dean
        try {
            const deanParams = {
                to_email: deanEmail,
                to_name: deanName,
                dean_name: deanName,
                signature_link: deanLink,
                expiry_days: expiryDays || 7
            };
            
            const deanResponse = await emailjs.send(
                EMAILJS_SERVICE_ID, 
                EMAILJS_DEAN_TEMPLATE, 
                deanParams,
                {
                    publicKey: EMAILJS_PUBLIC_KEY,
                    privateKey: EMAILJS_PRIVATE_KEY
                }
            );
            
            console.log('Dean email sent:', deanResponse.status);
            deanSuccess = true;
        } catch (error) {
            console.error('Dean email failed:', error);
        }
        
        // Update application with email sent status
        const db = mongoose.connection.db;
        await db.collection('submissions').updateOne(
            { id: appId },
            { 
                $set: { 
                    'signatureRequests.emailsSent': true,
                    'signatureRequests.emailsSentAt': new Date().toISOString()
                }
            }
        );
        
        res.json({ 
            success: chairSuccess && deanSuccess,
            chairSent: chairSuccess,
            deanSent: deanSuccess
        });
        
    } catch (error) {
        console.error('Error sending signature emails:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== RESEND SIGNATURE REQUESTS ==========
app.post('/api/applications/:appId/resend-signatures', async (req, res) => {
    try {
        const { appId } = req.params;
        const { chairEmail, chairName, deanEmail, deanName, proposalTitle, piName } = req.body;
        
        console.log(`📧 Resending signature requests for application: ${appId}`);
        
        const db = mongoose.connection.db;
        
        // Generate new unique tokens
        const chairToken = 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '_chair';
        const deanToken = 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '_dean';
        
        // Update signature requests in database
        const signatureRequest = {
            appId: appId,
            chairToken: chairToken,
            deanToken: deanToken,
            chairEmail: chairEmail,
            chairName: chairName,
            deanEmail: deanEmail,
            deanName: deanName,
            chairCompleted: false,
            deanCompleted: false,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };
        
        await db.collection('signature_requests').updateOne(
            { appId: appId },
            { $set: signatureRequest },
            { upsert: true }
        );
        
        // Update application with new signature tokens
        await db.collection('submissions').updateOne(
            { id: appId },
            { 
                $set: { 
                    'signatureRequests.chairToken': chairToken,
                    'signatureRequests.deanToken': deanToken,
                    'signatureRequests.sentAt': new Date().toISOString(),
                    'signatureRequests.resendCount': { $inc: 1 }
                }
            }
        );
        
        // Generate signature links
        const baseUrl = 'https://kuro-portal.vercel.app';
        const chairLink = `${baseUrl}/signature-confirm.html?token=${chairToken}&role=chair&id=${appId}`;
        const deanLink = `${baseUrl}/signature-confirm.html?token=${deanToken}&role=dean&id=${appId}`;
        const SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_ocv82fn';
        const CHAIR_TEMPLATE = process.env.EMAILJS_CHAIR_TEMPLATE || 'template_0ll7awk';
        const DEAN_TEMPLATE = process.env.EMAILJS_DEAN_TEMPLATE || 'template_3lsq7ug';
        
        let chairSent = false;
        let deanSent = false;
        
        // Send to Chair
        try {
            const chairParams = {
                to_email: chairEmail,
                to_name: chairName,
                chair_name: chairName,
                pi_name: piName || 'N/A',
                department: application.dept || 'N/A',
                proposal_title: proposalTitle || 'N/A',
                grant_title: application.grantTitle || 'N/A',
                duration: application.duration || 'N/A',
                signature_link: chairLink,
                expiry_days: 7
            };
            
            await emailjs.send(SERVICE_ID, CHAIR_TEMPLATE, chairParams, {
                publicKey: process.env.EMAILJS_PUBLIC_KEY,
                privateKey: process.env.EMAILJS_PRIVATE_KEY
            });
            chairSent = true;
            console.log('Chair resend email sent');
        } catch (error) {
            console.error('Chair resend failed:', error);
        }
        
        // Send to Dean
        try {
            const deanParams = {
                to_email: deanEmail,
                to_name: deanName,
                dean_name: deanName,
                pi_name: piName || 'N/A',
                department: application.dept || 'N/A',
                proposal_title: proposalTitle || 'N/A',
                grant_title: application.grantTitle || 'N/A',
                duration: application.duration || 'N/A',
                signature_link: deanLink,
                expiry_days: 7
            };
            
            await emailjs.send(SERVICE_ID, DEAN_TEMPLATE, deanParams, {
                publicKey: process.env.EMAILJS_PUBLIC_KEY,
                privateKey: process.env.EMAILJS_PRIVATE_KEY
            });
            deanSent = true;
            console.log('Dean resend email sent');
        } catch (error) {
            console.error('Dean resend failed:', error);
        }
        
        res.json({ 
            success: chairSent && deanSent,
            chairSent: chairSent,
            deanSent: deanSent,
            chairLink: chairLink,
            deanLink: deanLink
        });
        
    } catch (error) {
        console.error('Error resending signatures:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check signature status
app.get('/api/applications/:appId/signature-status', async (req, res) => {
    try {
        const { appId } = req.params;
        
        const db = mongoose.connection.db;
        const signatureRequest = await db.collection('signature_requests').findOne({ appId: appId });
        
        if (!signatureRequest) {
            return res.json({ chairCompleted: false, deanCompleted: false });
        }
        
        res.json({ 
            chairCompleted: signatureRequest.chairCompleted || false,
            deanCompleted: signatureRequest.deanCompleted || false,
            chairSignedAt: signatureRequest.chairSignedAt,
            deanSignedAt: signatureRequest.deanSignedAt
        });
        
    } catch (error) {
        console.error('Error checking signature status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Complete signature (when signatory clicks the link)
app.put('/api/signatures/:token/complete', async (req, res) => {
    try {
        const { token } = req.params;
        const { name, email } = req.body;
        
        const db = mongoose.connection.db;
        
        // Determine if it's chair or dean token
        const isChair = token.includes('_chair');
        const isDean = token.includes('_dean');
        
        let updateField = {};
        if (isChair) {
            updateField = { chairCompleted: true, chairSignedAt: new Date(), chairSignerName: name, chairSignerEmail: email };
        } else if (isDean) {
            updateField = { deanCompleted: true, deanSignedAt: new Date(), deanSignerName: name, deanSignerEmail: email };
        } else {
            return res.status(400).json({ error: 'Invalid token' });
        }
        
        const result = await db.collection('signature_requests').updateOne(
            { $or: [{ chairToken: token }, { deanToken: token }] },
            { $set: updateField }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Signature request not found' });
        }
        
        // Update the application status if both signatures are complete
        const signatureRequest = await db.collection('signature_requests').findOne({
            $or: [{ chairToken: token }, { deanToken: token }]
        });
        
        if (signatureRequest && signatureRequest.chairCompleted && signatureRequest.deanCompleted) {
            await db.collection('submissions').updateOne(
                { id: signatureRequest.appId },
                { $set: { status: 'Pending Eligibility Check' } }
            );
        }
        
        res.json({ success: true, message: 'Signature completed' });
        
    } catch (error) {
        console.error('Error completing signature:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get signature request by token
app.get('/api/signatures/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const db = mongoose.connection.db;
        
        // Find the signature request by token (check both chair and dean tokens)
        const signatureRequest = await db.collection('signature_requests').findOne({
            $or: [
                { chairToken: token },
                { deanToken: token }
            ]
        });
        
        if (!signatureRequest) {
            return res.status(404).json({ error: 'Signature request not found' });
        }
        
        // Get the associated application
        const application = await db.collection('submissions').findOne({ id: signatureRequest.appId });
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Determine role based on which token matched
        const isChair = signatureRequest.chairToken === token;
        const isDean = signatureRequest.deanToken === token;
        
        let role = null;
        let signerEmail = null;
        let signerName = null;
        
        if (isChair) {
            role = 'chair';
            signerEmail = signatureRequest.chairEmail;
            signerName = signatureRequest.chairName;
        } else if (isDean) {
            role = 'dean';
            signerEmail = signatureRequest.deanEmail;
            signerName = signatureRequest.deanName;
        }
        
        res.json({
            appId: signatureRequest.appId,
            role: role,
            signerEmail: signerEmail,
            signerName: signerName,
            completed: isChair ? signatureRequest.chairCompleted : signatureRequest.deanCompleted,
            revoked: false, // You can add a revoked flag if needed
            expiresAt: signatureRequest.expiresAt,
            application: {
                proposalTitle: application.proposalTitle,
                piName: application.piName,
                grantTitle: application.grantTitle,
                userEmail: application.userEmail
            }
        });
        
    } catch (error) {
        console.error('Error fetching signature:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== 404 HANDLER ==========
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.url });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/health\n`);
});
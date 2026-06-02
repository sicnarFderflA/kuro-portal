const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const emailjs = require('@emailjs/nodejs');
const TestEmail = require('./models/TestEmail');
const User = require('./models/User');
const Settings = require('./models/Settings'); 
const SignatureRequest = require('./models/SignatureRequest');
const Application = require('./models/Application');

require('dotenv').config();

const Submission = mongoose.model('Submission', new mongoose.Schema({}, { strict: false }), 'submissions');

emailjs.init({
    publicKey: process.env.EMAILJS_PUBLIC_KEY,
    privateKey: process.env.EMAILJS_PRIVATE_KEY
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const EMAILJS_SERVICE_ID = 'service_gh6jwhb';
const EMAILJS_CHAIR_TEMPLATE = 'template_yurehtl';
const EMAILJS_DEAN_TEMPLATE = 'template_7l5r5eq';
const EMAILJS_PUBLIC_KEY = '1qXRfGkNZuqEY_BUI';
const EMAILJS_PRIVATE_KEY = 'uDrt2ggg3t8A334NwutB2';

// Initialize EmailJS
emailjs.init({
    publicKey: EMAILJS_PUBLIC_KEY,
    privateKey: EMAILJS_PRIVATE_KEY
});

// Increase payload limit - add these BEFORE your routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// If using body-parser directly
const bodyParser = require('body-parser');
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

console.log('📧 EmailJS initialized with new keys');

// CORS configuration
app.use(cors({
    origin: [
        'https://kuro-portal.vercel.app',
        'https://kuro-portal-bolh5jg78-sicnar-fdefl-a-s-projects.vercel.app',
        'http://localhost:5500',
        'http://localhost:3000'
    ],
    credentials: true
}));
app.use(express.json());

// MongoDB Connection settings (will be handled by connectWithRetry)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://200520181_db_user:200520181_db_password@kuro-database.neg1meg.mongodb.net/kuro_portal?retryWrites=true&w=majority&appName=KURO-Database';

// Add connection event handlers BEFORE connectWithRetry
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected! Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
});

// Keep database connection alive
setInterval(async () => {
    if (mongoose.connection.readyState === 1) {
        try {
            await mongoose.connection.db.admin().ping();
            console.log('💓 Database ping successful');
        } catch (err) {
            console.error('Database ping failed:', err.message);
        }
    }
}, 30000);

// Connection retry logic (this does the actual connection)
const connectWithRetry = async (retries = 5, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await mongoose.connect(MONGODB_URI, {
                maxPoolSize: 10,
                minPoolSize: 2,
                socketTimeoutMS: 30000,
                connectTimeoutMS: 15000,
                serverSelectionTimeoutMS: 15000,
                heartbeatFrequencyMS: 10000,
            });
            console.log('✅ MongoDB Connected successfully');
            return;
        } catch (err) {
            console.error(`Connection attempt ${i + 1} failed:`, err.message);
            if (i < retries - 1) {
                console.log(`Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('All connection attempts failed');
                // Don't exit - let the server try to recover
                // process.exit(1);
            }
        }
    }
};

// Call this to start the connection
connectWithRetry();

// Google OAuth client
const googleClient = new OAuth2Client(
    '1074730624717-8u9auss3uqp5grgs7e4padhothotmfrf.apps.googleusercontent.com'
);

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
        
        const testEmail = await TestEmail.findOne({ email, isActive: true });
        let user = await User.findOne({ email });
        
        if (testEmail) {
            console.log(`📧 Test account login: ${email}, role from test email: ${testEmail.role}`);
            
            if (!user) {
                user = new User({
                    email,
                    name: testEmail.name || name,
                    picture,
                    role: testEmail.role,
                    isSuperAdmin: false,
                    checkerRole: testEmail.role === 'check1' ? 'check1' : 
                               (testEmail.role === 'check2' ? 'check2' : 
                               (testEmail.role === 'check3' ? 'check3' : null)),
                    isTestAccount: true
                });
                await user.save();
                console.log(`✅ Created test user: ${email} with role ${testEmail.role}`);
            } else {
                user.role = testEmail.role;
                user.isTestAccount = true;
                if (testEmail.role === 'check1') user.checkerRole = 'check1';
                else if (testEmail.role === 'check2') user.checkerRole = 'check2';
                else if (testEmail.role === 'check3') user.checkerRole = 'check3';
                await user.save();
                console.log(`✅ Updated test user: ${email} to role ${testEmail.role}`);
            }
            
            let allowedRoles = ['student', 'faculty', 'admin', 'check1', 'check2', 'check3'];
            let requestedRoleMatches = (role === testEmail.role) || 
                                       (role === 'admin' && testEmail.role === 'admin');
            
            if (!requestedRoleMatches && allowedRoles.includes(role)) {
                return res.status(403).json({ 
                    error: `This test account is configured as ${testEmail.role}. Please sign in as ${testEmail.role}.` 
                });
            }
            
        } else {
            if (!user) {
                let userRole = email.endsWith('@xu.edu.ph') ? 'faculty' : 'student';
                const superAdminsSetting = await Settings.findOne({ key: 'super_admins' });
                const superAdmins = superAdminsSetting?.value || ['200520181@my.xu.edu.ph'];
                const isSuperAdmin = superAdmins.includes(email);
                
                user = new User({
                    email,
                    name,
                    picture,
                    role: userRole,
                    isSuperAdmin: isSuperAdmin,
                    checkerRole: null,
                    isTestAccount: false
                });
                await user.save();
                console.log(`✅ Created new user: ${email} with role ${userRole}`);
            }
            
            const superAdminsSetting = await Settings.findOne({ key: 'super_admins' });
            const superAdmins = superAdminsSetting?.value || ['200520181@my.xu.edu.ph'];
            const isSuperAdminUser = superAdmins.includes(email);
            
            let allowed = false;
            if (role === 'student') allowed = (user.role === 'student' || isSuperAdminUser);
            else if (role === 'faculty') allowed = (user.role === 'faculty' || isSuperAdminUser);
            else if (role === 'admin') allowed = (isSuperAdminUser || user.role === 'admin');
            
            if (!allowed) {
                return res.status(403).json({ error: `You cannot sign in as ${role}` });
            }
        }
        
        const superAdminsSetting = await Settings.findOne({ key: 'super_admins' });
        const superAdmins = superAdminsSetting?.value || ['200520181@my.xu.edu.ph'];
        const isSuperAdminUser = superAdmins.includes(email);
        
        res.json({
            success: true,
            token: 'jwt_token_' + Date.now(),
            user: {
                email: user.email,
                name: user.name,
                picture: user.picture || null,
                role: testEmail ? testEmail.role : role,
                checkerRole: user.checkerRole,
                isSuperAdmin: isSuperAdminUser
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
const Draft = require('./models/Draft');

// Use routes
app.use('/api/applications', applicationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);

// ========== SINGLE APPLICATION ROUTES ==========

app.get('/api/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🔍 GET single application by ID:', id);
        
        const application = await Submission.findOne({ id: id });
        
        if (!application) {
            console.log('❌ Application not found:', id);
            return res.status(404).json({ error: 'Application not found' });
        }
        
        console.log('✅ Found application:', application.id);
        res.json(application);
        
    } catch (error) {
        console.error('Error fetching application:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        updates.updatedAt = new Date();
        
        console.log('📝 PUT update application:', id);
        
        const result = await Submission.findOneAndUpdate(
            { id: id },
            { $set: updates },
            { returnDocument: 'after' }
        );
        
        if (!result) {
            console.log('❌ Application not found for update:', id);
            return res.status(404).json({ error: 'Application not found' });
        }
        
        console.log('✅ Updated application:', id);
        res.json({ success: true, data: result });
        
    } catch (error) {
        console.error('Error updating application:', error);
        res.status(500).json({ error: error.message });
    }
});

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

// ========== FACULTY ROUTES ==========

app.get('/api/faculty/applications', async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        const ApplicationModel = mongoose.model('Application');
        const applications = await ApplicationModel.find({ 
            userEmail: userEmail 
        }).sort({ submittedDate: -1 });
        
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// FIXED: Debug endpoint - no more db.collection
app.get('/api/debug/applications', async (req, res) => {
    try {
        const allSubmissions = await Submission.find({});
        
        const userEmails = [...new Set(allSubmissions.map(s => s.userEmail))];
        
        res.json({
            totalSubmissions: allSubmissions.length,
            userEmails: userEmails,
            submissions: allSubmissions.map(s => ({
                id: s.id,
                userEmail: s.userEmail,
                proposalTitle: s.proposalTitle,
                status: s.status
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

app.post('/api/faculty/drafts', async (req, res) => {
    try {
        const draftData = req.body;
        
        if (!draftData.userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        if (draftData._id) {
            delete draftData._id;
        }
        
        const result = await Draft.findOneAndUpdate(
            { draftId: draftData.draftId, userEmail: draftData.userEmail },
            { $set: draftData },
            { upsert: true, returnDocument: 'after' }
        );
        
        console.log('✅ Saved draft:', result.draftId);
        res.json({ success: true, draftId: result.draftId });
        
    } catch (error) {
        console.error('Error saving draft:', error);
        res.status(500).json({ error: error.message });
    }
});

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
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error deleting draft:', error);
        res.status(500).json({ error: error.message });
    }
});

// FIXED: my-submissions endpoint - using Submission model
app.get('/api/my-submissions', async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        console.log('📋 My submissions requested for:', userEmail);
        
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        const userSubmissions = await Submission.find({ userEmail: userEmail });
        
        console.log(`✅ Found ${userSubmissions.length} submissions for ${userEmail}`);
        res.json(userSubmissions);
        
    } catch (error) {
        console.error('❌ Error fetching my submissions:', error);
        res.status(500).json({ error: error.message });
    }
});

// FIXED: reviewer tasks - using Mongoose models
app.get('/api/reviewer/tasks', async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        console.log('🔍 Fetching reviewer tasks for:', userEmail);
        
        // Try to find in submissions collection first
        let submissions = await Submission.find({
            'assignedReviewers.email': userEmail
        });
        
        // If not found, try applications collection
        if (submissions.length === 0) {
            console.log('No results in submissions, checking applications collection...');
            const ApplicationModel = mongoose.model('Application');
            submissions = await ApplicationModel.find({
                'assignedReviewers.email': userEmail
            });
        }
        
        console.log(`✅ Found ${submissions.length} assigned applications for ${userEmail}`);
        
        const assignedTasks = submissions.map(sub => {
            let myReview = sub.assignedReviewers?.find(r => r.email === userEmail);
            
            return {
                id: sub.id,
                grantTitle: sub.grantTitle,
                proposalTitle: sub.proposalTitle,
                userEmail: sub.userEmail,
                status: myReview?.status || 'pending',
                assignedAt: myReview?.assignedAt || sub.assignedAt
            };
        });
        
        res.json({ 
            assignedTasks: assignedTasks,
            checkerRole: null
        });
        
    } catch (error) {
        console.error('Error fetching reviewer tasks:', error);
        res.json({ assignedTasks: [] });
    }
});

app.put('/api/users/reviewer-name', async (req, res) => {
    try {
        const { email, name } = req.body;
        
        await User.findOneAndUpdate(
            { email },
            { name, updatedAt: new Date() }
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating reviewer name:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== SIGNATURE ROUTES (FIXED) ==========

// Generate signature links
app.post('/api/applications/:appId/generate-signatures', async (req, res) => {
    try {
        const { appId } = req.params;
        const { chairEmail, chairName, deanEmail, deanName } = req.body;
        
        const chairToken = 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '_chair';
        const deanToken = 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '_dean';
        
        const signatureRequest = new SignatureRequest({
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
        });
        
        await SignatureRequest.findOneAndUpdate(
            { appId: appId },
            signatureRequest,
            { upsert: true }
        );
        
        await Application.findOneAndUpdate(
            { id: appId },
            { $set: { 
                signatureRequests: {
                    chairToken: chairToken,
                    deanToken: deanToken,
                    sentAt: new Date().toISOString(),
                    emailsSent: false,
                    resendCount: 0
                }
            } }
        );
        
        const baseUrl = 'https://kuro-portal.vercel.app';
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

// Send signature emails (unchanged - this one was fine)
app.post('/api/applications/:appId/send-signature-emails', async (req, res) => {
    try {
        const { appId } = req.params;
        const { chairLink, deanLink, chairEmail, deanEmail, chairName, deanName, expiryDays } = req.body;
        
        console.log(`📧 Attempting to send emails for: ${appId}`);
        
        let chairSuccess = false;
        let deanSuccess = false;
        let chairError = null;
        let deanError = null;
        
        if (EMAILJS_SERVICE_ID && EMAILJS_CHAIR_TEMPLATE) {
            try {
                const chairParams = {
                    to_email: chairEmail,
                    to_name: chairName,
                    chair_name: chairName,
                    signature_link: chairLink,
                    expiry_days: expiryDays || 7
                };
                
                await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_CHAIR_TEMPLATE, chairParams, {
                    publicKey: EMAILJS_PUBLIC_KEY,
                    privateKey: EMAILJS_PRIVATE_KEY
                });
                chairSuccess = true;
            } catch (error) {
                console.error('Chair email failed:', error.message);
                chairError = error.message;
            }
        }
        
        if (EMAILJS_SERVICE_ID && EMAILJS_DEAN_TEMPLATE) {
            try {
                const deanParams = {
                    to_email: deanEmail,
                    to_name: deanName,
                    dean_name: deanName,
                    signature_link: deanLink,
                    expiry_days: expiryDays || 7
                };
                
                await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_DEAN_TEMPLATE, deanParams, {
                    publicKey: EMAILJS_PUBLIC_KEY,
                    privateKey: EMAILJS_PRIVATE_KEY
                });
                deanSuccess = true;
            } catch (error) {
                console.error('Dean email failed:', error.message);
                deanError = error.message;
            }
        }
        
        res.json({ 
            success: chairSuccess || deanSuccess,
            chairSent: chairSuccess,
            deanSent: deanSuccess,
            chairError: chairError,
            deanError: deanError,
            message: chairSuccess && deanSuccess ? 'Both emails sent' : 'Some emails failed'
        });
        
    } catch (error) {
        console.error('Error in send-signature-emails:', error);
        res.status(500).json({ error: error.message });
    }
});

// FIXED: Resend signature requests
app.post('/api/applications/:appId/resend-signatures', async (req, res) => {
    try {
        const { appId } = req.params;
        const { chairEmail, chairName, deanEmail, deanName, proposalTitle, piName } = req.body;
        
        console.log(`📧 Resending signature requests for application: ${appId}`);
        
        const appData = await Application.findOne({ id: appId });
        
        if (!appData) {
            console.error(`❌ Application not found: ${appId}`);
            return res.status(404).json({ error: 'Application not found' });
        }
        
        const chairToken = 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '_chair';
        const deanToken = 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '_dean';
        
        await SignatureRequest.findOneAndUpdate(
            { appId: appId },
            {
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
            },
            { upsert: true }
        );
        
        await Application.findOneAndUpdate(
            { id: appId },
            { 
                $set: { 
                    'signatureRequests.chairToken': chairToken,
                    'signatureRequests.deanToken': deanToken,
                    'signatureRequests.sentAt': new Date().toISOString()
                },
                $inc: { 'signatureRequests.resendCount': 1 }
            }
        );
        
        const baseUrl = 'https://kuro-portal.vercel.app';
        const chairLink = `${baseUrl}/signature-confirm.html?token=${chairToken}&role=chair&id=${appId}`;
        const deanLink = `${baseUrl}/signature-confirm.html?token=${deanToken}&role=dean&id=${appId}`;
        
        let chairSent = false;
        let deanSent = false;
        
        try {
            const chairParams = {
                to_email: chairEmail,
                to_name: chairName,
                chair_name: chairName,
                pi_name: piName || 'N/A',
                department: appData.dept || 'N/A',
                proposal_title: proposalTitle || 'N/A',
                grant_title: appData.grantTitle || 'N/A',
                duration: appData.duration || 'N/A',
                signature_link: chairLink,
                expiry_days: 7
            };
            
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_CHAIR_TEMPLATE, chairParams, {
                publicKey: process.env.EMAILJS_PUBLIC_KEY,
                privateKey: process.env.EMAILJS_PRIVATE_KEY
            });
            chairSent = true;
        } catch (error) {
            console.error('Chair resend failed:', error);
        }
        
        try {
            const deanParams = {
                to_email: deanEmail,
                to_name: deanName,
                dean_name: deanName,
                pi_name: piName || 'N/A',
                department: appData.dept || 'N/A',
                proposal_title: proposalTitle || 'N/A',
                grant_title: appData.grantTitle || 'N/A',
                duration: appData.duration || 'N/A',
                signature_link: deanLink,
                expiry_days: 7
            };
            
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_DEAN_TEMPLATE, deanParams, {
                publicKey: process.env.EMAILJS_PUBLIC_KEY,
                privateKey: process.env.EMAILJS_PRIVATE_KEY
            });
            deanSent = true;
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

// Check signature status (this one was good!)
app.get('/api/applications/:appId/signature-status', async (req, res) => {
    try {
        const { appId } = req.params;
        
        const signatureRequest = await SignatureRequest.findOne({ appId: appId });
        const application = await Application.findOne({ id: appId });
        
        if (signatureRequest?.chairCompleted && signatureRequest?.deanCompleted) {
            if (application?.status === 'Awaiting Signatures') {
                await Application.updateOne(
                    { id: appId },
                    { $set: { status: 'Pending Eligibility Check' } }
                );
                console.log('✅ Status synchronized');
            }
        }
        
        res.json({ 
            chairCompleted: signatureRequest?.chairCompleted || false,
            deanCompleted: signatureRequest?.deanCompleted || false,
            chairSignedAt: signatureRequest?.chairSignedAt,
            deanSignedAt: signatureRequest?.deanSignedAt
        });
    } catch (error) {
        console.error('Error checking signature status:', error);
        res.status(500).json({ error: error.message });
    }
});

// FIXED: Complete signature
app.put('/api/signatures/:token/complete', async (req, res) => {
    try {
        const { token } = req.params;
        const { name, email } = req.body;
        
        const isChair = token.includes('_chair');
        const isDean = token.includes('_dean');
        
        let updateField = {};
        if (isChair) {
            updateField = { 
                chairCompleted: true, 
                chairSignedAt: new Date(), 
                chairSignerName: name, 
                chairSignerEmail: email 
            };
        } else if (isDean) {
            updateField = { 
                deanCompleted: true, 
                deanSignedAt: new Date(), 
                deanSignerName: name, 
                deanSignerEmail: email 
            };
        } else {
            return res.status(400).json({ error: 'Invalid token' });
        }
        
        const result = await SignatureRequest.updateOne(
            { $or: [{ chairToken: token }, { deanToken: token }] },
            { $set: updateField }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Signature request not found' });
        }
        
        const signatureRequest = await SignatureRequest.findOne({
            $or: [{ chairToken: token }, { deanToken: token }]
        });
        
        if (signatureRequest && signatureRequest.chairCompleted && signatureRequest.deanCompleted) {
            await Submission.updateOne(
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

// Get signature by token (this one was good!)
app.get('/api/signatures/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const application = await Application.findOne({
            $or: [
                { 'signatureRequests.chairToken': token },
                { 'signatureRequests.deanToken': token }
            ]
        });
        
        if (!application) {
            return res.status(404).json({ error: 'Signature request not found' });
        }
        
        const isChair = application.signatureRequests?.chairToken === token;
        const role = isChair ? 'chair' : 'dean';
        const signerEmail = isChair ? application.chairEmail : application.deanEmail;
        const signerName = isChair ? application.fromChair : application.deanName;
        
        res.json({
            appId: application.id,
            role: role,
            signerEmail: signerEmail,
            signerName: signerName,
            completed: false,
            expiresAt: application.signatureRequests?.expiresAt || null,
            application: {
                proposalTitle: application.proposalTitle,
                piName: application.piName,
                grantTitle: application.grantTitle,
                userEmail: application.userEmail
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint (unchanged)
app.get('/api/debug/emailjs-detailed', async (req, res) => {
    try {
        const results = {
            config: {
                serviceId: process.env.EMAILJS_SERVICE_ID || 'missing',
                chairTemplate: process.env.EMAILJS_CHAIR_TEMPLATE || 'missing',
                deanTemplate: process.env.EMAILJS_DEAN_TEMPLATE || 'missing',
                publicKey: process.env.EMAILJS_PUBLIC_KEY ? 'present' : 'missing',
                privateKey: process.env.EMAILJS_PRIVATE_KEY ? 'present' : 'missing',
            },
            testResults: {}
        };
        
        try {
            const chairParams = {
                to_email: "200520181@my.xu.edu.ph",
                to_name: "Test User",
                chair_name: "Test Chair",
                signature_link: "https://test.com",
                expiry_days: 7
            };
            
            const chairResponse = await emailjs.send(
                process.env.EMAILJS_SERVICE_ID,
                process.env.EMAILJS_CHAIR_TEMPLATE,
                chairParams,
                {
                    publicKey: process.env.EMAILJS_PUBLIC_KEY,
                    privateKey: process.env.EMAILJS_PRIVATE_KEY
                }
            );
            results.testResults.chair = { success: true, status: chairResponse.status };
        } catch (error) {
            results.testResults.chair = { success: false, error: error.message };
        }
        
        try {
            const deanParams = {
                to_email: "200520181@my.xu.edu.ph",
                to_name: "Test User",
                dean_name: "Test Dean",
                signature_link: "https://test.com",
                expiry_days: 7
            };
            
            const deanResponse = await emailjs.send(
                process.env.EMAILJS_SERVICE_ID,
                process.env.EMAILJS_DEAN_TEMPLATE,
                deanParams,
                {
                    publicKey: process.env.EMAILJS_PUBLIC_KEY,
                    privateKey: process.env.EMAILJS_PRIVATE_KEY
                }
            );
            results.testResults.dean = { success: true, status: deanResponse.status };
        } catch (error) {
            results.testResults.dean = { success: false, error: error.message };
        }
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Keep database connection alive
setInterval(async () => {
    if (mongoose.connection.readyState === 1) {
        try {
            await mongoose.connection.db.admin().ping();
            console.log('💓 Database ping successful');
        } catch (err) {
            console.error('Database ping failed:', err.message);
        }
    } else {
        console.log(`Database state: ${mongoose.connection.readyState} - not connected`);
    }
}, 30000); // Every 30 seconds

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
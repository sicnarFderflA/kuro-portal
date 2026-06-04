// server.js - COMPLETELY UPDATED VERSION
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const emailjs = require('@emailjs/nodejs');

require('dotenv/config');

// ========== MIDDLEWARE SETUP ==========
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const bodyParser = require('body-parser');
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// ========== CORS CONFIGURATION ==========
app.use(cors({
    origin: [
        'https://kuro-portal.vercel.app',
        'https://kuro-portal-bolh5jg78-sicnar-fdefl-a-s-projects.vercel.app',
        'http://localhost:5500',
        'http://localhost:3000',
        'https://kuro-portal.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
}));

app.options('*', cors());
app.use(express.json());

app.use((req, res, next) => {
    // Allow all origins for testing (you can restrict later)
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// ========== EMAILJS CONFIGURATION ==========
const EMAILJS_SERVICE_ID = 'service_gh6jwhb';
const EMAILJS_CHAIR_TEMPLATE = 'template_yurehtl';
const EMAILJS_DEAN_TEMPLATE = 'template_7l5r5eq';
const EMAILJS_PUBLIC_KEY = '1qXRfGkNZuqEY_BUI';
const EMAILJS_PRIVATE_KEY = 'uDrt2ggg3t8A334NwutB2';

// ========== MONGODB CONNECTION ==========
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ CRITICAL: MONGODB_URI environment variable is not set!');
    process.exit(1);
}

console.log('📡 Connecting to MongoDB Atlas...');

// Connection retry logic
const connectWithRetry = async (retries = 5, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await mongoose.connect(MONGODB_URI, {
                maxPoolSize: 5,
                minPoolSize: 0,
                socketTimeoutMS: 60000,
                connectTimeoutMS: 60000,
                serverSelectionTimeoutMS: 60000,
                heartbeatFrequencyMS: 10000,
            });
            console.log('✅ MongoDB Connected successfully to:', mongoose.connection.host);
            console.log('📊 Database:', mongoose.connection.name);
            return true;
        } catch (err) {
            console.error(`Connection attempt ${i + 1} failed:`, err.message);
            if (i < retries - 1) {
                console.log(`Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('All connection attempts failed');
                return false;
            }
        }
    }
    return false;
};

// Add connection event handlers
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
let pingInterval;
const startPingInterval = () => {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(async () => {
        if (mongoose.connection.readyState === 1) {
            try {
                await mongoose.connection.db.admin().ping();
                console.log('💓 Database ping successful');
            } catch (err) {
                console.error('Database ping failed:', err.message);
            }
        }
    }, 30000);
};

// ========== START SERVER ONLY AFTER DATABASE CONNECTION ==========
const startServer = async () => {
    const connected = await connectWithRetry();
    
    if (!connected) {
        console.error('❌ Failed to connect to database. Exiting...');
        process.exit(1);
    }
    
    startPingInterval();
    
    // 🔥 FORCE clear any cached models that might have been created with wrong connection
    console.log('🔄 Clearing mongoose model cache...');
    const modelNames = Object.keys(mongoose.models);
    for (const name of modelNames) {
        delete mongoose.models[name];
        console.log(`   Cleared model: ${name}`);
    }
    if (mongoose.modelSchemas) {
        for (const name in mongoose.modelSchemas) {
            delete mongoose.modelSchemas[name];
        }
    }
    console.log('✅ Model cache cleared');
    
    // ========== LOAD ALL MODELS (AFTER CONNECTION) ==========
    console.log('📦 Loading models...');
    const TestEmail = require('./models/TestEmail');
    const Application = require('./models/Application');
    const User = require('./models/User');
    const Settings = require('./models/Settings');
    const SignatureRequest = require('./models/SignatureRequest');
    const Draft = require('./models/Draft');
    const Notification = require('./models/Notification');
    console.log('✅ Models loaded successfully');
    
    // ========== INITIALIZE EMAILJS ==========
    emailjs.init({
        publicKey: EMAILJS_PUBLIC_KEY,
        privateKey: EMAILJS_PRIVATE_KEY
    });
    console.log('📧 EmailJS initialized');
    
    // ========== GOOGLE OAUTH ==========
    const googleClient = new OAuth2Client(
        '1074730624717-8u9auss3uqp5grgs7e4padhothotmfrf.apps.googleusercontent.com'
    );
    
    // ========== HELPER FUNCTIONS ==========
    function getCurrentUserEmail(req) {
        return req.query.userEmail || req.body.userEmail || req.headers['x-user-email'];
    }
    
    // GET /api/notifications - Get notifications for a user
    app.get('/api/notifications', async (req, res) => {
        try {
            const { userEmail } = req.query;
            
            if (!userEmail) {
                return res.status(400).json({ error: 'userEmail required' });
            }
            
            const notifications = await Notification.find({ userEmail: userEmail })
                .sort({ createdAt: -1 })
                .limit(50);
            
            res.json(notifications);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // POST /api/notifications - Create a notification
    app.post('/api/notifications', async (req, res) => {
        try {
            const notification = new Notification(req.body);
            await notification.save();
            res.json(notification);
        } catch (error) {
            console.error('Error creating notification:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // PUT /api/notifications/:id/read - Mark a notification as read
    app.put('/api/notifications/:id/read', async (req, res) => {
        try {
            const { id } = req.params;
            await Notification.findByIdAndUpdate(id, { isRead: true, readAt: new Date() });
            res.json({ success: true });
        } catch (error) {
            console.error('Error marking notification read:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // PUT /api/notifications/mark-all-read - Mark all notifications as read
    app.put('/api/notifications/mark-all-read', async (req, res) => {
        try {
            const { userEmail } = req.body;
            
            if (!userEmail) {
                return res.status(400).json({ error: 'userEmail required' });
            }
            
            await Notification.updateMany(
                { userEmail: userEmail, isRead: false },
                { isRead: true, readAt: new Date() }
            );
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error marking all read:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // DELETE /api/notifications/:id - Delete a notification
    app.delete('/api/notifications/:id', async (req, res) => {
        try {
            const { id } = req.params;
            await Notification.findByIdAndDelete(id);
            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting notification:', error);
            res.status(500).json({ error: error.message });
        }
    });

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
    
    // ========== IMPORT ROUTES ==========
    const applicationsRoutes = require('./routes/applications');
    const adminRoutes = require('./routes/admin');
    
    // Use routes
    app.use('/api/applications', applicationsRoutes);
    app.use('/api/admin', adminRoutes);

    // Get user by email
    app.get('/api/users/by-email', async (req, res) => {
        try {
            const { email } = req.query;
            if (!email) {
                return res.status(400).json({ error: 'Email required' });
            }
            
            const user = await User.findOne({ email });
            if (user && user.name) {
                res.json({ name: user.name, email: user.email });
            } else {
                const fallbackName = email.split('@')[0].replace(/[._]/g, ' ');
                res.json({ name: fallbackName, email: email });
            }
        } catch (error) {
            console.error('Error fetching user:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    // Lazy load CV data endpoint
    app.get('/api/applications/:id/cv', async (req, res) => {
        try {
            const { id } = req.params;
            const { type, index } = req.query;
            
            const application = await Application.findOne({ id: id });
            if (!application) {
                return res.status(404).json({ error: 'Application not found' });
            }
            
            let cvData = null;
            let cvName = null;
            
            if (type === 'pi') {
                cvData = application.piCVData;
                cvName = application.piCVName;
            } else if (type === 'team' && index !== undefined) {
                const idx = parseInt(index);
                cvData = application.teamCVs?.[idx]?.data;
                cvName = application.teamCVs?.[idx]?.name;
            }
            
            if (!cvData) {
                return res.status(404).json({ error: 'CV not found' });
            }
            
            res.json({ cvData, cvName });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.put('/api/applications/:id/cv/pi/status', async (req, res) => {
        try {
            const { id } = req.params;
            const { status, userEmail } = req.body;
            
            // Verify admin/checker permissions
            const user = await User.findOne({ email: userEmail });
            const isAdmin = user?.role === 'admin';
            const isSuperAdmin = userEmail === '200520181@my.xu.edu.ph';
            const isChecker = user?.checkerRole === 'check1' || user?.checkerRole === 'check2' || user?.checkerRole === 'check3';
            
            if (!isAdmin && !isSuperAdmin && !isChecker) {
                return res.status(403).json({ error: 'Permission denied' });
            }
            
            const application = await Application.findOne({ id: id });
            if (!application) {
                return res.status(404).json({ error: 'Application not found' });
            }
            
            // Update PI CV status
            application.piCVStatus = status;
            application.updatedAt = new Date();
            await application.save();
            
            // Create notification for faculty
            const statusText = status === 'eligible' ? '✅ Eligible' : (status === 'ineligible' ? '❌ Ineligible' : '⏳ Pending');
            
            await Notification.create({
                userEmail: application.userEmail,
                type: 'cv_status_update',
                title: '📄 CV Status Updated',
                message: `Your CV has been marked as ${statusText} for "${application.proposalTitle?.substring(0, 50)}".`,
                appId: id,
                icon: status === 'eligible' ? '✅' : (status === 'ineligible' ? '❌' : '⏳'),
                color: status === 'eligible' ? '#2ecc71' : (status === 'ineligible' ? '#e74c3c' : '#f39c12'),
                isRead: false,
                createdAt: new Date()
            });
            
            console.log(`✅ Updated PI CV status for ${id} to ${status}`);
            res.json({ success: true, status: status });
            
        } catch (error) {
            console.error('Error updating PI CV status:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Update Team CV Status
    app.put('/api/applications/:id/cv/team/:index/status', async (req, res) => {
        try {
            const { id, index } = req.params;
            const { status, userEmail } = req.body;
            const teamIndex = parseInt(index);
            
            // Verify admin/checker permissions
            const user = await User.findOne({ email: userEmail });
            const isAdmin = user?.role === 'admin';
            const isSuperAdmin = userEmail === '200520181@my.xu.edu.ph';
            const isChecker = user?.checkerRole === 'check1' || user?.checkerRole === 'check2' || user?.checkerRole === 'check3';
            
            if (!isAdmin && !isSuperAdmin && !isChecker) {
                return res.status(403).json({ error: 'Permission denied' });
            }
            
            const application = await Application.findOne({ id: id });
            if (!application) {
                return res.status(404).json({ error: 'Application not found' });
            }
            
            // Ensure teamCVs array exists
            if (!application.teamCVs) {
                application.teamCVs = [];
            }
            
            // Ensure the specific team CV exists
            if (!application.teamCVs[teamIndex]) {
                application.teamCVs[teamIndex] = { name: null, status: 'pending' };
            }
            
            // Update team CV status
            application.teamCVs[teamIndex].status = status;
            application.updatedAt = new Date();
            await application.save();
            
            // Get team member name for notification
            const memberName = application.teamMembers?.[teamIndex]?.name || `Team Member ${teamIndex + 1}`;
            const statusText = status === 'eligible' ? '✅ Eligible' : (status === 'ineligible' ? '❌ Ineligible' : '⏳ Pending');
            
            // Create notification for faculty
            await Notification.create({
                userEmail: application.userEmail,
                type: 'cv_status_update',
                title: '📄 Team CV Status Updated',
                message: `${memberName}'s CV has been marked as ${statusText} for "${application.proposalTitle?.substring(0, 50)}".`,
                appId: id,
                icon: status === 'eligible' ? '✅' : (status === 'ineligible' ? '❌' : '⏳'),
                color: status === 'eligible' ? '#2ecc71' : (status === 'ineligible' ? '#e74c3c' : '#f39c12'),
                isRead: false,
                createdAt: new Date()
            });
            
            console.log(`✅ Updated team CV status for ${id}, member ${teamIndex} to ${status}`);
            res.json({ success: true, status: status });
            
        } catch (error) {
            console.error('Error updating team CV status:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Save CV Feedback
    app.put('/api/applications/:id/cv/feedback', async (req, res) => {
        try {
            const { id } = req.params;
            const { feedback, userEmail } = req.body;
            
            // Verify admin/checker permissions
            const user = await User.findOne({ email: userEmail });
            const isAdmin = user?.role === 'admin';
            const isSuperAdmin = userEmail === '200520181@my.xu.edu.ph';
            const isChecker = user?.checkerRole === 'check1' || user?.checkerRole === 'check2' || user?.checkerRole === 'check3';
            
            if (!isAdmin && !isSuperAdmin && !isChecker) {
                return res.status(403).json({ error: 'Permission denied' });
            }
            
            const application = await Application.findOne({ id: id });
            if (!application) {
                return res.status(404).json({ error: 'Application not found' });
            }
            
            application.uploadFeedback = feedback;
            application.updatedAt = new Date();
            await application.save();
            
            console.log(`✅ Saved CV feedback for ${id}`);
            res.json({ success: true, feedback: feedback });
            
        } catch (error) {
            console.error('Error saving CV feedback:', error);
            res.status(500).json({ error: error.message });
        }
    });

     app.get('/api/applications/:id/full', async (req, res) => {
        try {
            const { id } = req.params;
            const { userEmail } = req.query;
            
            console.log(`🔍 Fetching FULL application: ${id}`);
            
            const application = await Application.findOne({ id: id });
            if (!application) {
                return res.status(404).json({ error: 'Application not found' });
            }
            
            // Check permissions
            const user = await User.findOne({ email: userEmail });
            const isAdmin = user?.role === 'admin';
            const isSuperAdmin = userEmail === '200520181@my.xu.edu.ph';
            const isOwner = application.userEmail === userEmail;
            const isReviewer = user?.role === 'reviewer';
            const isChecker = user?.checkerRole === 'check1' || user?.checkerRole === 'check2' || user?.checkerRole === 'check3';
            
            if (!isAdmin && !isSuperAdmin && !isOwner && !isReviewer && !isChecker) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            res.json(application);
            
        } catch (error) {
            console.error('Error in GET /applications/:id/full:', error);
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
    
    app.get('/api/my-submissions', async (req, res) => {
        try {
            const userEmail = req.query.userEmail;
            console.log('📋 My submissions requested for:', userEmail);
            
            if (!userEmail) {
                return res.status(400).json({ error: 'userEmail required' });
            }
            
            const userSubmissions = await Application.find({ userEmail: userEmail })
                .select('id grantTitle proposalTitle status submittedDate piName userEmail');
            
            console.log(`✅ Found ${userSubmissions.length} submissions for ${userEmail}`);
            res.json(userSubmissions);
        } catch (error) {
            console.error('❌ Error fetching my submissions:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/applications/:id/edit', async (req, res) => {
        try {
            const { id } = req.params;
            const application = await Application.findOne({ id: id });
            if (!application) {
                return res.status(404).json({ error: 'Application not found' });
            }
            res.json(application);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    
    // ========== REVIEWER TASKS ==========
    app.get('/api/reviewer/tasks', async (req, res) => {
        try {
            const userEmail = req.query.userEmail;
            if (!userEmail) {
                return res.status(400).json({ error: 'userEmail required' });
            }
            
            console.log('🔍 Fetching reviewer tasks for:', userEmail);
            
            const submissions = await Application.find({
                'assignedReviewers.email': userEmail
            });
            
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
    
    // ========== SIGNATURE ROUTES ==========
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
    
    app.post('/api/applications/:appId/resend-signatures', async (req, res) => {
        try {
            const { appId } = req.params;
            const { chairEmail, chairName, deanEmail, deanName, proposalTitle, piName } = req.body;
            
            console.log(`📧 Resending signature requests for application: ${appId}`);
            console.log('📧 Chair email:', chairEmail);
            console.log('📧 Dean email:', deanEmail);
            
            // ✅ Validate emails
            if (!chairEmail || !deanEmail) {
                console.error('❌ Missing email addresses');
                return res.status(400).json({ 
                    error: 'Missing email addresses',
                    message: 'Chair and Dean email addresses are required. Please update them in Form 2.'
                });
            }
            
            const appData = await Application.findOne({ id: appId });
            
            if (!appData) {
                console.error(`❌ Application not found: ${appId}`);
                return res.status(404).json({ error: 'Application not found' });
            }
            
            // Check if signatures are already complete
            const chairSigned = appData.signatures?.chair?.signed || false;
            const deanSigned = appData.signatures?.dean?.signed || false;
            const bothSigned = chairSigned && deanSigned;
            
            if (bothSigned) {
                return res.status(400).json({ 
                    error: 'Signatures already completed',
                    message: 'Both signatures have already been completed. No need to resend.'
                });
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
            
            // Get ALL data from appData
            const proposalTitleText = appData.proposalTitle || proposalTitle || 'N/A';
            const grantTitleText = appData.grantTitle || 'N/A';
            const durationText = appData.duration || 'N/A';
            const departmentText = appData.dept || appData.endorseDept || 'N/A';
            const piNameText = appData.piName || piName || 'N/A';
            
            console.log('📧 Email data:', {
                proposalTitle: proposalTitleText,
                grantTitle: grantTitleText,
                duration: durationText,
                department: departmentText,
                piName: piNameText
            });
            
            // Only send to chair if not already signed
            if (!chairSigned) {
                try {
                    const chairParams = {
                        to_email: chairEmail,
                        to_name: chairName,
                        chair_name: chairName,
                        pi_name: piNameText,
                        department: departmentText,
                        proposal_title: proposalTitleText,
                        grant_title: grantTitleText,
                        duration: durationText,
                        signature_link: chairLink,
                        expiry_days: 7
                    };
                    
                    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_CHAIR_TEMPLATE, chairParams, {
                        publicKey: EMAILJS_PUBLIC_KEY,
                        privateKey: EMAILJS_PRIVATE_KEY
                    });
                    chairSent = true;
                    console.log('✅ Chair email sent successfully');
                } catch (error) {
                    console.error('Chair resend failed:', error);
                }
            } else {
                console.log('⚠️ Chair already signed, skipping email');
            }
            
            // Only send to dean if not already signed
            if (!deanSigned) {
                try {
                    const deanParams = {
                        to_email: deanEmail,
                        to_name: deanName,
                        dean_name: deanName,
                        pi_name: piNameText,
                        department: departmentText,
                        proposal_title: proposalTitleText,
                        grant_title: grantTitleText,
                        duration: durationText,
                        signature_link: deanLink,
                        expiry_days: 7
                    };
                    
                    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_DEAN_TEMPLATE, deanParams, {
                        publicKey: EMAILJS_PUBLIC_KEY,
                        privateKey: EMAILJS_PRIVATE_KEY
                    });
                    deanSent = true;
                    console.log('✅ Dean email sent successfully');
                } catch (error) {
                    console.error('Dean resend failed:', error);
                }
            } else {
                console.log('⚠️ Dean already signed, skipping email');
            }
            
            res.json({ 
                success: chairSent || deanSent,
                chairSent: chairSent,
                deanSent: deanSent,
                chairLink: chairLink,
                deanLink: deanLink,
                message: `${chairSent ? 'Chair email sent. ' : ''}${deanSent ? 'Dean email sent.' : ''}`
            });
            
        } catch (error) {
            console.error('Error resending signatures:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
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
                await Application.updateOne(
                    { id: signatureRequest.appId },
                    { 
                        $set: { 
                            status: 'Pending Eligibility Check',
                            submittedDate: new Date().toISOString().slice(0, 10)
                        } 
                    }
                );
                console.log('✅ Application submitted for review');
            }
            
            res.json({ success: true, message: 'Signature completed' });
            
        } catch (error) {
            console.error('Error completing signature:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
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
    
    // ========== DEBUG ENDPOINTS ==========
    app.get('/api/debug/connection-info', (req, res) => {
        const state = mongoose.connection.readyState;
        const stateText = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        
        res.json({
            connectionState: stateText[state] || 'unknown',
            connectionStateCode: state,
            host: mongoose.connection.host,
            databaseName: mongoose.connection.name,
            modelsLoaded: mongoose.modelNames()
        });
    });
    
    app.get('/api/debug/emailjs-detailed', async (req, res) => {
        try {
            const results = {
                config: {
                    serviceId: EMAILJS_SERVICE_ID || 'missing',
                    chairTemplate: EMAILJS_CHAIR_TEMPLATE || 'missing',
                    deanTemplate: EMAILJS_DEAN_TEMPLATE || 'missing',
                    publicKey: EMAILJS_PUBLIC_KEY ? 'present' : 'missing',
                    privateKey: EMAILJS_PRIVATE_KEY ? 'present' : 'missing',
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
                    EMAILJS_SERVICE_ID,
                    EMAILJS_CHAIR_TEMPLATE,
                    chairParams,
                    {
                        publicKey: EMAILJS_PUBLIC_KEY,
                        privateKey: EMAILJS_PRIVATE_KEY
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
                    EMAILJS_SERVICE_ID,
                    EMAILJS_DEAN_TEMPLATE,
                    deanParams,
                    {
                        publicKey: EMAILJS_PUBLIC_KEY,
                        privateKey: EMAILJS_PRIVATE_KEY
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
    
    // ========== 404 HANDLER ==========
    app.use((req, res) => {
        res.status(404).json({ error: 'Route not found', path: req.url });
    });
    
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on port ${PORT}`);
        console.log(`📍 API URL: https://kuro-api-m4mb.onrender.com`);
        console.log(`✅ Health check: https://kuro-api-m4mb.onrender.com/health\n`);
    });
};

// Start the server
startServer().catch(err => {
    console.error('Fatal error starting server:', err);
    process.exit(1);
});
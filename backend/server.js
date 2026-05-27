const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
    origin: ['https://kuro-portal.vercel.app', 'http://localhost:5500', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://200520181_db_user:200520181_db_password@kuro-database.neg1meg.mongodb.net/?appName=KURO-Database';

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
            'GET /api/applications': 'Get all applications',
            'POST /api/applications': 'Create application',
            'GET /api/admin/stats': 'Admin dashboard stats',
            'GET /api/admin/applications': 'Admin view all applications',
            'PUT /api/admin/applications/:id/status': 'Update application status'
        }
    });
});

// Import routes
const applicationsRoutes = require('./routes/applications');
const adminRoutes = require('./routes/admin');

// Use routes
app.use('/api/applications', applicationsRoutes);
app.use('/api/admin', adminRoutes);

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
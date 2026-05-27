const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const app = express();

// CORS configuration - allow your frontend
app.use(cors({
    origin: ['https://kuro-portal.vercel.app', 'http://localhost:5500', 'http://localhost:3000', 'http://127.0.0.1:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Google OAuth client
const googleClient = new OAuth2Client(
    '1074730624717-8u9auss3uqp5grgs7e4padhothotmfrf.apps.googleusercontent.com'
);

// User database (temporary - replace with MongoDB later)
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
            console.error('No credential provided');
            return res.status(400).json({ error: 'No credential provided' });
        }
        
        console.log('🔐 Verifying Google token...');
        
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: '1074730624717-8u9auss3uqp5grgs7e4padhothotmfrf.apps.googleusercontent.com',
        });
        
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;
        const picture = payload.picture;
        
        console.log(`✅ User authenticated: ${email} (${name})`);
        console.log(`📋 Requested role: ${role}`);
        
        // Get user from database or create
        let user = usersDB[email];
        
        if (!user) {
            // Auto-create user based on email domain
            let userRole = 'student';
            if (email.endsWith('@xu.edu.ph')) {
                userRole = 'faculty';
            }
            
            user = {
                name: name,
                email: email,
                picture: picture,
                role: userRole,
                isSuperAdmin: false,
                checkerRole: null
            };
            usersDB[email] = user;
            console.log(`🆕 Created new user: ${email} as ${userRole}`);
        }
        
        // Check role permission
        const isExempted = email === '200520181@my.xu.edu.ph';
        let allowed = false;
        
        if (role === 'student') allowed = (user.role === 'student' || isExempted);
        else if (role === 'faculty') allowed = (user.role === 'faculty' || isExempted);
        else if (role === 'admin') allowed = (user.isSuperAdmin || user.role === 'admin' || isExempted);
        
        if (!allowed) {
            console.error(`❌ Access denied: ${email} cannot sign in as ${role}`);
            return res.status(403).json({ error: `You cannot sign in as ${role}` });
        }
        
        console.log(`✅ Access granted for ${email} as ${role}`);
        
        // Return success
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
        endpoints: {
            'POST /api/auth/google': 'Google OAuth login',
            'GET /health': 'Health check'
        }
    });
});

// ========== 404 HANDLER ==========
app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Route not found', path: req.url });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/health\n`);
});
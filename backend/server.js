const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '1074730624717-8u9auss3uqp5grgs7e4padhothotmfrf.apps.googleusercontent.com');

// In-memory storage (will add MongoDB later)
let submissionsDB = {};
let usersDB = {
    'faculty@xu.edu.ph': {
        name: 'Faculty User',
        email: 'faculty@xu.edu.ph',
        password: bcrypt.hashSync('password123', 10),
        role: 'faculty'
    },
    'admin@xu.edu.ph': {
        name: 'Admin User',
        email: 'admin@xu.edu.ph',
        password: bcrypt.hashSync('admin123', 10),
        role: 'admin'
    },
    'student@my.xu.edu.ph': {
        name: 'Student User',
        email: 'student@my.xu.edu.ph',
        password: bcrypt.hashSync('student123', 10),
        role: 'student'
    },
    '200520181@my.xu.edu.ph': {
        name: 'Super Admin',
        email: '200520181@my.xu.edu.ph',
        password: bcrypt.hashSync('admin123', 10),
        role: 'admin',
        isSuperAdmin: true
    },
    'alfredrabanes@gmail.com': {
        name: 'Alfred Rabanes',
        email: 'alfredrabanes@gmail.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'admin',
        checkerRole: 'check1'
    },
    'rabanes.francisalfred@gmail.com': {
        name: 'Francis Rabanes',
        email: 'rabanes.francisalfred@gmail.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'admin',
        checkerRole: 'check2'
    },
    'excitegaming04@gmail.com': {
        name: 'Excite Gaming',
        email: 'excitegaming04@gmail.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'admin',
        checkerRole: 'check3'
    }
};

// ========== GOOGLE OAUTH ENDPOINT (For Login.html) ==========
app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential, role } = req.body;
        
        console.log('Google sign-in request for role:', role);
        
        // Verify Google token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID || '1074730624717-8u9auss3uqp5grgs7e4padhothotmfrf.apps.googleusercontent.com',
        });
        
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;
        const picture = payload.picture;
        
        console.log('Authenticated user:', email, name);
        
        // Check if user exists, if not create one
        let user = usersDB[email];
        
        if (!user) {
            // Auto-create user based on email domain
            let userRole = 'student';
            if (email.endsWith('@xu.edu.ph')) {
                userRole = 'faculty';
            } else if (email === '200520181@my.xu.edu.ph') {
                userRole = 'admin';
            }
            
            user = {
                name: name,
                email: email,
                picture: picture,
                role: userRole,
                isSuperAdmin: email === '200520181@my.xu.edu.ph',
                checkerRole: null
            };
            usersDB[email] = user;
        }
        
        // Check if user can access the selected role
        let allowedRole = false;
        const isExempted = email === '200520181@my.xu.edu.ph';
        
        if (role === 'student' && (user.role === 'student' || isExempted)) allowedRole = true;
        if (role === 'faculty' && (user.role === 'faculty' || isExempted)) allowedRole = true;
        if (role === 'admin' && (user.isSuperAdmin || user.role === 'admin' || isExempted)) allowedRole = true;
        
        if (!allowedRole) {
            return res.status(403).json({ error: `You cannot sign in as ${role}` });
        }
        
        // Return user data
        res.json({
            token: 'dummy_token_' + Date.now(),
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
        console.error('Google auth error:', error);
        res.status(500).json({ error: 'Authentication failed: ' + error.message });
    }
});

// ========== TRADITIONAL LOGIN ENDPOINT ==========
app.post('/api/auth/login', async (req, res) => {
    const { email, password, selectedRole } = req.body;
    const user = usersDB[email];
    
    if (!user) return res.status(401).json({ error: 'Account not found' });
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid password' });
    
    res.json({ success: true, user: { name: user.name, email: user.email, role: user.role } });
});

// ========== ROOT ENDPOINT ==========
app.get('/', (req, res) => {
    res.json({ 
        message: 'KURO API is running!',
        endpoints: {
            'POST /api/auth/google': 'Google OAuth login',
            'POST /api/auth/login': 'Traditional login',
            'GET /health': 'Health check'
        }
    });
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// ========== 404 HANDLER ==========
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Test: http://localhost:${PORT}`);
    console.log(`Google Auth endpoint: http://localhost:${PORT}/api/auth/google`);
});
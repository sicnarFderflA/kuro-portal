const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google Sign-In
router.post('/google', async (req, res) => {
    try {
        const { credential, role } = req.body;
        
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;
        const picture = payload.picture;
        
        // Check allowed domains
        const allowedDomains = ['xu.edu.ph', 'my.xu.edu.ph'];
        const domain = email.split('@')[1];
        
        // Exempted email for testing
        const EXEMPTED_EMAIL = '200520181@my.xu.edu.ph';
        const isExempted = email === EXEMPTED_EMAIL;
        
        if (!isExempted && !allowedDomains.includes(domain)) {
            return res.status(403).json({ error: 'Domain not allowed' });
        }
        
        // Find or create user
        let user = await User.findOne({ email });
        
        if (!user) {
            // Determine role based on domain
            let userRole = 'student';
            if (isExempted || email.endsWith('@xu.edu.ph')) {
                userRole = 'faculty';
            }
            
            user = new User({
                email,
                name,
                picture,
                role: userRole,
                isSuperAdmin: email === EXEMPTED_EMAIL,
            });
            
            await user.save();
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // Check if user has permission for selected role
        let allowedRole = false;
        
        if (role === 'student' && (user.role === 'student' || isExempted)) allowedRole = true;
        if (role === 'faculty' && (user.role === 'faculty' || isExempted)) allowedRole = true;
        if (role === 'admin' && (user.isSuperAdmin || user.role === 'admin')) allowedRole = true;
        
        if (!allowedRole) {
            return res.status(403).json({ error: `You cannot sign in as ${role}` });
        }
        
        // Generate JWT
        const token = jwt.sign(
            { email: user.email, role: role, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            token,
            user: {
                email: user.email,
                name: user.name,
                picture: user.picture,
                role: role,
                checkerRole: user.checkerRole,
                isSuperAdmin: user.isSuperAdmin,
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Verify token
router.get('/verify', authMiddleware, async (req, res) => {
    res.json({
        user: {
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            checkerRole: req.user.checkerRole,
            isSuperAdmin: req.user.isSuperAdmin,
        }
    });
});

module.exports = router;
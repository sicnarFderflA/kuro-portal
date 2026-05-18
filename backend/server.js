const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

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
        name: 'Admin User',
        email: '200520181@my.xu.edu.ph',
        password: bcrypt.hashSync('admin123', 10),
        role: 'admin'
    }
};

app.post('/api/auth/login', async (req, res) => {
    const { email, password, selectedRole } = req.body;
    const user = usersDB[email];
    
    if (!user) return res.status(401).json({ error: 'Account not found' });
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid password' });
    
    res.json({ success: true, user: { name: user.name, email: user.email, role: user.role } });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
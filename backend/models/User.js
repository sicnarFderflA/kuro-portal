const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    picture: { type: String, default: '' },
    isTestAccount: { type: Boolean, default: false },
    role: { type: String, enum: ['student', 'faculty', 'admin'], default: 'student' },
    checkerRole: { type: String, enum: ['check1', 'check2', 'check3', null], default: null },
    isSuperAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
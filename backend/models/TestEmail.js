const mongoose = require('mongoose');

const TestEmailSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    role: { 
        type: String, 
        enum: ['student', 'faculty', 'admin', 'check1', 'check2', 'check3'],
        required: true 
    },
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedBy: { type: String },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TestEmail', TestEmailSchema);
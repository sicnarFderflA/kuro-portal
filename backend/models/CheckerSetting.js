// models/CheckerSetting.js
const mongoose = require('mongoose');

const checkerSettingSchema = new mongoose.Schema({
    role: { type: String, enum: ['check1', 'check2', 'check3'], unique: true },
    assignedEmail: String,
    assignedName: String,
    updatedBy: String,
    updatedAt: { type: Date, default: Date.now }
});

// Create or get existing model
const CheckerSetting = mongoose.models.CheckerSetting || mongoose.model('CheckerSetting', checkerSettingSchema);

// Default settings (export as data, not as model)
const defaultCheckerSettings = [
    { role: 'check1', assignedEmail: 'eligibility@xu.edu.ph', assignedName: 'Eligibility Officer' },
    { role: 'check2', assignedEmail: 'secondary@xu.edu.ph', assignedName: 'Secondary Checker' },
    { role: 'check3', assignedEmail: 'finalapprover@xu.edu.ph', assignedName: 'Final Approver' }
];

module.exports = { CheckerSetting, defaultCheckerSettings };
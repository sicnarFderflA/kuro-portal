// models/Settings.js (Update existing or create new)
const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String }
});

module.exports = mongoose.model('Settings', SettingsSchema);
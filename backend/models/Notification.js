const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    userEmail: { type: String, required: true, index: true },
    type: String,
    title: String,
    message: String,
    appId: String,
    tab: String,
    icon: String,
    color: String,
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);
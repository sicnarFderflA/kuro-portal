const express = require('express');
const authMiddleware = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();

// Get user's notifications
router.get('/', authMiddleware, async (req, res) => {
    try {
        const notifications = await Notification.find({ userEmail: req.user.email })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(notifications);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
    try {
        const notification = await Notification.findOne({ 
            _id: req.params.id, 
            userEmail: req.user.email 
        });
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        notification.isRead = true;
        await notification.save();
        
        res.json({ message: 'Marked as read' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// Mark all as read
router.put('/mark-all-read', authMiddleware, async (req, res) => {
    try {
        await Notification.updateMany(
            { userEmail: req.user.email, isRead: false },
            { isRead: true }
        );
        res.json({ message: 'All notifications marked as read' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
});

// Delete notification
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await Notification.findOneAndDelete({ 
            _id: req.params.id, 
            userEmail: req.user.email 
        });
        res.json({ message: 'Notification deleted' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

module.exports = router;
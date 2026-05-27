const express = require('express');
const authMiddleware = require('../middleware/auth');
const Application = require('../models/Application');
const Notification = require('../models/Notification');

const router = express.Router();

// Get all applications (with filters based on role)
router.get('/', authMiddleware, async (req, res) => {
    try {
        let query = {};
        
        // Filter based on user role
        if (req.user.role === 'faculty') {
            query.applicantEmail = req.user.email;
        } else if (req.user.checkerRole === 'check1') {
            query.status = 'Pending Eligibility Check';
        } else if (req.user.checkerRole === 'check2') {
            query.status = 'Pending Secondary Check';
        } else if (req.user.checkerRole === 'check3') {
            query.status = 'Pending Final Check';
        }
        // Admin and SuperAdmin see all
        
        const applications = await Application.find(query).sort({ submittedDate: -1 });
        res.json(applications);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

// Get single application
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const application = await Application.findOne({ id: req.params.id });
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Check permission
        if (req.user.role === 'faculty' && application.applicantEmail !== req.user.email) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json(application);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch application' });
    }
});

// Create new application
router.post('/', authMiddleware, async (req, res) => {
    try {
        const application = new Application({
            ...req.body,
            id: 'APP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8),
            applicantEmail: req.user.email,
            submittedDate: new Date().toISOString().slice(0, 10),
        });
        
        await application.save();
        
        // Create notifications for signatories
        if (application.chairEmail) {
            await Notification.create({
                userEmail: application.chairEmail,
                type: 'signature_request',
                title: '✍️ Signature Request',
                message: `Please sign the endorsement letter for "${application.proposalTitle}"`,
                appId: application.id,
                icon: '✍️',
                color: '#D4AF37',
            });
        }
        
        if (application.deanEmail) {
            await Notification.create({
                userEmail: application.deanEmail,
                type: 'signature_request',
                title: '✍️ Signature Request',
                message: `Please sign the endorsement letter for "${application.proposalTitle}"`,
                appId: application.id,
                icon: '✍️',
                color: '#D4AF37',
            });
        }
        
        res.json(application);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create application' });
    }
});

// Update application
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const application = await Application.findOne({ id: req.params.id });
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Check permission
        if (req.user.role === 'faculty' && application.applicantEmail !== req.user.email) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        Object.assign(application, req.body);
        application.updatedAt = new Date();
        await application.save();
        
        res.json(application);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update application' });
    }
});

// Delete application
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const application = await Application.findOne({ id: req.params.id });
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Only faculty or admin can delete
        if (req.user.role !== 'admin' && application.applicantEmail !== req.user.email) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await application.deleteOne();
        res.json({ message: 'Application deleted' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete application' });
    }
});

module.exports = router;
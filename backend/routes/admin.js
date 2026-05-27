const express = require('express');
const authMiddleware = require('../middleware/auth');
const Application = require('../models/Application');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');

const router = express.Router();

// Check if user is admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && !req.user.isSuperAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Get dashboard stats
router.get('/stats', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const total = await Application.countDocuments();
        const pending = await Application.countDocuments({
            status: { $in: ['Pending Eligibility Check', 'Pending Secondary Check', 'Pending Final Check'] }
        });
        const approved = await Application.countDocuments({ status: 'Approved' });
        const returned = await Application.countDocuments({ status: 'Returned' });
        const reviewers = await User.countDocuments({ role: 'reviewer' });
        
        res.json({ total, pending, approved, returned, reviewers });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get all applications (admin view)
router.get('/applications', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { status, grant, search } = req.query;
        let query = {};
        
        if (status && status !== 'all') query.status = status;
        if (grant && grant !== 'all') query.grantTitle = grant;
        if (search) {
            query.$or = [
                { proposalTitle: { $regex: search, $options: 'i' } },
                { applicantEmail: { $regex: search, $options: 'i' } },
                { piName: { $regex: search, $options: 'i' } },
            ];
        }
        
        const applications = await Application.find(query).sort({ submittedDate: -1 });
        res.json(applications);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

// Update application status (admin)
router.put('/applications/:id/status', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { status, feedback } = req.body;
        const application = await Application.findOne({ id: req.params.id });
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        const oldStatus = application.status;
        application.status = status;
        
        if (feedback) {
            if (status === 'Returned') {
                application.returnedFeedback = feedback;
                application.returnedAt = new Date();
            } else if (status === 'Pending Secondary Check') {
                application.check1Feedback = feedback;
                application.check1CompletedAt = new Date();
            } else if (status === 'Pending Final Check') {
                application.check2Feedback = feedback;
                application.check2CompletedAt = new Date();
            } else if (status === 'Approved') {
                application.check3Feedback = feedback;
                application.check3CompletedAt = new Date();
                application.approvedAt = new Date();
            }
        }
        
        await application.save();
        
        // Notify faculty
        await Notification.create({
            userEmail: application.applicantEmail,
            type: 'status_change',
            title: '📋 Application Status Updated',
            message: `Your application status changed from "${oldStatus}" to "${status}"`,
            appId: application.id,
            icon: status === 'Approved' ? '🎉' : '📋',
            color: status === 'Approved' ? '#2ecc71' : '#3498db',
        });
        
        res.json(application);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Update CV status
router.put('/applications/:id/cv', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { type, index, status } = req.body;
        const application = await Application.findOne({ id: req.params.id });
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        if (type === 'pi') {
            application.piCVStatus = status;
        } else if (type === 'team' && index !== undefined) {
            if (!application.teamCVs[index]) application.teamCVs[index] = {};
            application.teamCVs[index].status = status;
        }
        
        await application.save();
        
        await Notification.create({
            userEmail: application.applicantEmail,
            type: 'cv_status',
            title: '📄 CV Status Updated',
            message: `Your ${type === 'pi' ? 'Principal Investigator' : 'Team Member'} CV has been marked as ${status}`,
            appId: application.id,
            icon: status === 'eligible' ? '✅' : (status === 'ineligible' ? '❌' : '⏳'),
            color: status === 'eligible' ? '#2ecc71' : (status === 'ineligible' ? '#e74c3c' : '#f39c12'),
        });
        
        res.json(application);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update CV status' });
    }
});

// Get checker settings
router.get('/settings/checkers', authMiddleware, requireAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne({ key: 'checker_emails' });
        if (!settings) {
            settings = { value: { check1: '', check2: '', check3: '' } };
        }
        res.json(settings.value);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update checker settings
router.put('/settings/checkers', authMiddleware, requireAdmin, async (req, res) => {
    try {
        await Settings.findOneAndUpdate(
            { key: 'checker_emails' },
            { key: 'checker_emails', value: req.body, updatedAt: new Date() },
            { upsert: true }
        );
        res.json({ message: 'Settings updated' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Update user checker roles
router.put('/users/:email/checker-role', authMiddleware, async (req, res) => {
    try {
        if (!req.user.isSuperAdmin) {
            return res.status(403).json({ error: 'Super Admin access required' });
        }
        
        const { role } = req.body; // 'check1', 'check2', 'check3', or null
        const user = await User.findOne({ email: req.params.email });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        user.checkerRole = role;
        await user.save();
        
        res.json({ message: 'Checker role updated', user });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// Assign external reviewer
router.post('/applications/:id/assign-reviewer', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { email, name } = req.body;
        const application = await Application.findOne({ id: req.params.id });
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        if (!application.assignedReviewers) application.assignedReviewers = [];
        
        application.assignedReviewers.push({
            email,
            name: name || email.split('@')[0],
            assignedAt: new Date(),
        });
        
        await application.save();
        
        // Create notification for reviewer
        await Notification.create({
            userEmail: email,
            type: 'review_assignment',
            title: '📋 New Review Assignment',
            message: `You have been assigned to review "${application.proposalTitle}"`,
            appId: application.id,
            icon: '📋',
            color: '#3498db',
        });
        
        res.json(application);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to assign reviewer' });
    }
});

module.exports = router;
const express = require('express');
const mongoose = require('mongoose');
const Application = require('../models/Application');
const User = require('../models/User');
const Notification = require('../models/Notification');
const router = express.Router();

router.get('/:id/full', async (req, res) => {
    try {
        const { id } = req.params;
        const { userEmail } = req.query;
        
        console.log(`🔍 Fetching FULL application: ${id} for user: ${userEmail}`);
        
        const application = await Application.findOne({ id: id });
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Check permissions
        const user = await User.findOne({ email: userEmail });
        const isAdmin = user?.role === 'admin';
        const isSuperAdmin = userEmail === '200520181@my.xu.edu.ph';
        const isOwner = application.userEmail === userEmail;
        const isReviewer = user?.role === 'reviewer';
        
        if (!isAdmin && !isSuperAdmin && !isOwner && !isReviewer) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Return FULL application data (including CVs)
        res.json(application);
        
    } catch (error) {
        console.error('Error in GET /applications/:id/full:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/applications/metadata - Lightweight metadata for admin dashboard
router.get('/admin/applications/metadata', async (req, res) => {
    try {
        const { userEmail } = req.query;
        
        console.log(`📊 Fetching admin applications metadata for: ${userEmail}`);
        
        // Verify admin status
        const user = await User.findOne({ email: userEmail });
        const isAdmin = user?.role === 'admin';
        const isSuperAdmin = userEmail === '200520181@my.xu.edu.ph';
        
        if (!isAdmin && !isSuperAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        // Get all applications
        const applications = await Application.find({}).sort({ submittedDate: -1 });
        
        // Return ONLY metadata (exclude heavy fields)
        const metadata = applications.map(app => ({
            id: app.id,
            grantTitle: app.grantTitle,
            proposalTitle: app.proposalTitle,
            userEmail: app.userEmail,
            piName: app.piName,
            submittedDate: app.submittedDate,
            status: app.status,
            returnedFeedback: app.returnedFeedback,
            
            // CV summary (counts only, no actual data)
            piCVStatus: app.piCVStatus,
            piCVName: app.piCVName ? true : false,  // Just boolean if exists
            teamCVsCount: app.teamCVs?.length || 0,
            teamCVsUploaded: app.teamCVs?.filter(cv => cv && cv.name).length || 0,
            
            // Signature summary
            signatures: {
                chair: app.signatures?.chair?.signed || false,
                dean: app.signatures?.dean?.signed || false
            },
            
            // Dates
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
            check1CompletedAt: app.check1CompletedAt,
            check2CompletedAt: app.check2CompletedAt,
            check3CompletedAt: app.check3CompletedAt
        }));
        
        console.log(`✅ Returning ${metadata.length} applications (metadata only)`);
        res.json(metadata);
        
    } catch (error) {
        console.error('Error in GET /admin/applications/metadata:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/faculty/applications/metadata - Lightweight metadata for faculty dashboard
router.get('/faculty/applications/metadata', async (req, res) => {
    try {
        const { userEmail } = req.query;
        
        console.log(`📊 Fetching faculty applications metadata for: ${userEmail}`);
        
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        // Get only this faculty's applications
        const applications = await Application.find({ userEmail: userEmail }).sort({ submittedDate: -1 });
        
        // Return ONLY metadata
        const metadata = applications.map(app => ({
            id: app.id,
            grantTitle: app.grantTitle,
            proposalTitle: app.proposalTitle,
            piName: app.piName,
            submittedDate: app.submittedDate,
            status: app.status,
            returnedFeedback: app.returnedFeedback,
            
            // CV summary
            piCVStatus: app.piCVStatus,
            piCVName: app.piCVName ? true : false,
            teamCVsCount: app.teamCVs?.length || 0,
            teamCVsUploaded: app.teamCVs?.filter(cv => cv && cv.name).length || 0,
            
            // Signature summary
            signatures: {
                chair: app.signatures?.chair?.signed || false,
                dean: app.signatures?.dean?.signed || false
            },
            
            signatureRequests: {
                sentAt: app.signatureRequests?.sentAt
            }
        }));
        
        console.log(`✅ Returning ${metadata.length} applications for faculty`);
        res.json(metadata);
        
    } catch (error) {
        console.error('Error in GET /faculty/applications/metadata:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/faculty/applications - Simple email-based auth for faculty
router.get('/faculty/applications', async (req, res) => {
    try {
        const { userEmail } = req.query;
        
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required' });
        }
        
        const applications = await Application.find({ userEmail: userEmail })
            .select('id grantTitle proposalTitle status submittedDate piName piEmail signatures signatureRequests piCVName piCVStatus teamCVs teamMembers returnedFeedback uploadFeedback userEmail fromChair chairEmail deanName deanEmail')
            .sort({ submittedDate: -1 });
        
        res.json(applications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all applications (filtered by role)
router.get('/', async (req, res) => {
    try {
        const { email, role } = req.user || {};
        let query = {};
        
        if (role === 'faculty') query.userEmail = email;
        else if (role === 'student') query.userEmail = email;
        
        const apps = await Application.find(query).sort({ submittedDate: -1 });
        res.json(apps);
    } catch (error) {
        console.error('Error in GET /applications:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single application
router.get('/:id', async (req, res) => {
    try {
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        res.json(app);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create application
router.post('/', async (req, res) => {
    try {
        const newApp = new Application({
            ...req.body,
            id: 'APP_' + Date.now(),
            submittedDate: new Date().toISOString().slice(0, 10)
        });
        await newApp.save();
        res.json(newApp);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update application
router.put('/:id', async (req, res) => {
    try {
        const app = await Application.findOneAndUpdate(
            { id: req.params.id },
            { $set: { ...req.body, updatedAt: new Date() } },
            { returnDocument: 'after' }
        );
        if (!app) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.json(app);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete application
router.delete('/:id', async (req, res) => {
    try {
        await Application.findOneAndDelete({ id: req.params.id });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== RESUBMIT RETURNED APPLICATION ==========
router.post('/:id/resubmit', async (req, res) => {
    try {
        const { id } = req.params;
        const { returnedFeedback, submittedDate } = req.body;  // Remove 'status' parameter
        
        console.log(`📤 Resubmitting application: ${id}`);
        
        let application = await Application.findOne({ id: id });
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Preserve existing signatures
        const existingSignatures = application.signatures || { chair: { signed: false }, dean: { signed: false } };
        
        let nextStatus;
        
        // ✅ CORRECT LOGIC
        const bothSigned = existingSignatures.chair?.signed && existingSignatures.dean?.signed;
        const atLeastOneSigned = existingSignatures.chair?.signed || existingSignatures.dean?.signed;
        
        if (bothSigned) {
            // Both signatures complete → ready for eligibility review
            nextStatus = 'Pending Eligibility Check';
            console.log('Both signatures complete, moving to Eligibility Check');
        } else if (atLeastOneSigned) {
            // Only one signature → wait for the other
            nextStatus = 'Awaiting Signatures';
            console.log('Partial signatures, staying in Awaiting Signatures');
        } else {
            // No signatures → wait for both
            nextStatus = 'Awaiting Signatures';
            console.log('No signatures, staying in Awaiting Signatures');
        }
        
        // Update application
        application.status = nextStatus;
        application.returnedFeedback = null;
        application.submittedDate = submittedDate || new Date().toISOString().slice(0, 10);
        application.updatedAt = new Date();
        
        await application.save();
        
        // Get admin users for notifications
        const adminUsers = await User.find({ role: 'admin' });
        
        for (const admin of adminUsers) {
            await Notification.create({
                userEmail: admin.email,
                type: 'resubmission',
                title: '📤 Application Resubmitted',
                message: `${application.piName || 'Faculty'} has resubmitted "${application.proposalTitle?.substring(0, 50)}" for review.`,
                appId: id,
                icon: '📤',
                color: '#2ecc71',
                isRead: false,
                createdAt: new Date()
            });
        }
        
        console.log(`✅ Application ${id} resubmitted with status: ${nextStatus}`);
        res.json({ success: true, application: application });
        
    } catch (error) {
        console.error('Resubmit failed:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
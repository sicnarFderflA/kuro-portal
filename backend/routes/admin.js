const express = require('express');
const Application = require('../models/Application');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const ExternalReviewer = require('../models/ExternalReviewer');
const TestEmail = require('../models/TestEmail');
const mongoose = require('mongoose');
const router = express.Router();

// ============ MIDDLEWARE ============
const isSuperAdmin = async (req, res, next) => {
    try {
        const userEmail = req.query.userEmail || req.body.userEmail;
        
        if (!userEmail) {
            return res.status(401).json({ error: 'User email required' });
        }
        
        const settings = await Settings.findOne({ key: 'super_admins' });
        const superAdmins = settings?.value || ['200520181@my.xu.edu.ph'];
        
        if (!superAdmins.includes(userEmail)) {
            return res.status(403).json({ error: 'Access denied. Super admin only.' });
        }
        next();
    } catch (error) {
        console.error('Super admin check error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ============ APPLICATION MANAGEMENT ============

// Get all applications (admin view)
router.get('/applications', async (req, res) => {
    // Use a flag to prevent multiple responses
    let isResponded = false;
    
    const safeRespond = (statusCode, data) => {
        if (!isResponded && !res.headersSent) {
            isResponded = true;
            return res.status(statusCode).json(data);
        }
        return null;
    };
    
    try {
        console.log('📊 GET /admin/applications - START');
        
        // Set a timeout for the entire request
        const timeoutId = setTimeout(() => {
            if (!isResponded && !res.headersSent) {
                console.error('Request timeout - sending empty array');
                isResponded = true;
                res.status(200).json([]);
            }
        }, 15000);
        
        const Application = require('../models/Application');
        
        // Check if database is connected
        if (mongoose.connection.readyState !== 1) {
            console.error('Database not connected');
            clearTimeout(timeoutId);
            return safeRespond(200, []);
        }
        
        // Try to get count first
        let count = 0;
        try {
            count = await Application.countDocuments({});
            console.log(`Total applications in DB: ${count}`);
        } catch (countErr) {
            console.error('Count failed:', countErr.message);
            clearTimeout(timeoutId);
            return safeRespond(200, []);
        }
        
        // Get applications with limit
        let apps = [];
        try {
            apps = await Application.find({})
                .select('-piCVData -teamCVData')
                .sort({ submittedDate: -1 })
                .limit(100)
                .lean()
                .maxTimeMS(10000); // Add query timeout
                
            console.log(`✅ Returning ${apps.length} applications`);
        } catch (queryErr) {
            console.error('Query failed:', queryErr.message);
            clearTimeout(timeoutId);
            return safeRespond(200, []);
        }
        
        clearTimeout(timeoutId);
        return safeRespond(200, apps);
        
    } catch (error) {
        console.error('❌ Error in /admin/applications:', error);
        if (!isResponded && !res.headersSent) {
            return res.status(200).json([]);
        }
    }
});

// Get single application
router.get('/applications/:id', async (req, res) => {
    try {
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        res.json(app);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete application
router.delete('/applications/:id', async (req, res) => {
    try {
        await Application.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ CHECK STAGE MANAGEMENT ============

// Approve Check 1
router.post('/applications/:id/check1/approve', async (req, res) => {
    try {
        const { feedback, updatedBy } = req.body;
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        app.status = 'Pending Secondary Check';
        app.check1Feedback = feedback;
        app.check1CompletedAt = new Date().toISOString();
        app.check1CompletedBy = updatedBy;
        await app.save();
        
        // Get checker settings
        const settings = await Settings.findOne({ key: 'checker_roles' });
        const checkerRoles = settings?.value || { check1: '', check2: '', check3: '' };
        
        // Notify Check 2
        if (checkerRoles.check2) {
            await Notification.create({
                userEmail: checkerRoles.check2,
                type: 'review_request',
                title: '📋 New Application for Review',
                message: `Application "${app.proposalTitle}" is ready for Secondary Review.`,
                appId: app.id,
                icon: '📋',
                color: '#3498db',
                tab: 'checks'
            });
        }
        
        // Notify faculty
        await Notification.create({
            userEmail: app.userEmail,
            type: 'check_completed',
            title: '✅ Check 1 Completed',
            message: `Your application "${app.proposalTitle}" has passed Eligibility Review.`,
            appId: app.id,
            icon: '✅',
            color: '#2ecc71'
        });
        
        res.json({ success: true, app });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Return Check 1
router.post('/applications/:id/check1/return', async (req, res) => {
    try {
        const { feedback, updatedBy } = req.body;
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        app.status = 'Returned';
        app.returnedFeedback = feedback;
        app.returnedFromStage = 'check1';
        app.returnedAt = new Date().toISOString();
        app.returnedBy = updatedBy;
        await app.save();
        
        await Notification.create({
            userEmail: app.userEmail,
            type: 'application_returned',
            title: '↩️ Application Returned',
            message: `Your application requires revision: ${feedback.substring(0, 100)}...`,
            appId: app.id,
            icon: '↩️',
            color: '#e74c3c'
        });
        
        res.json({ success: true, app });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Approve Check 2
router.post('/applications/:id/check2/approve', async (req, res) => {
    try {
        const { feedback, updatedBy } = req.body;
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        app.status = 'Pending Final Check';
        app.check2Feedback = feedback;
        app.check2CompletedAt = new Date().toISOString();
        app.check2CompletedBy = updatedBy;
        await app.save();
        
        const settings = await Settings.findOne({ key: 'checker_roles' });
        const checkerRoles = settings?.value || { check1: '', check2: '', check3: '' };
        
        if (checkerRoles.check3) {
            await Notification.create({
                userEmail: checkerRoles.check3,
                type: 'review_request',
                title: '📋 Final Review Required',
                message: `Application "${app.proposalTitle}" is ready for Final Review.`,
                appId: app.id,
                icon: '📋',
                color: '#9b59b6',
                tab: 'checks'
            });
        }
        
        await Notification.create({
            userEmail: app.userEmail,
            type: 'check_completed',
            title: '✅ Check 2 Completed',
            message: `Your application "${app.proposalTitle}" has passed Secondary Review.`,
            appId: app.id,
            icon: '✅',
            color: '#2ecc71'
        });
        
        res.json({ success: true, app });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Return Check 2
router.post('/applications/:id/check2/return', async (req, res) => {
    try {
        const { feedback, updatedBy } = req.body;
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        app.status = 'Returned';
        app.returnedFeedback = feedback;
        app.returnedFromStage = 'check2';
        app.returnedAt = new Date().toISOString();
        app.returnedBy = updatedBy;
        await app.save();
        
        await Notification.create({
            userEmail: app.userEmail,
            type: 'application_returned',
            title: '↩️ Application Returned',
            message: `Your application requires revision: ${feedback.substring(0, 100)}...`,
            appId: app.id,
            icon: '↩️',
            color: '#e74c3c'
        });
        
        res.json({ success: true, app });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Approve Check 3
router.post('/applications/:id/check3/approve', async (req, res) => {
    try {
        const { feedback, updatedBy } = req.body;
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        app.status = 'Approved';
        app.check3Feedback = feedback;
        app.check3CompletedAt = new Date().toISOString();
        app.check3CompletedBy = updatedBy;
        app.approvedAt = new Date().toISOString();
        await app.save();
        
        await Notification.create({
            userEmail: app.userEmail,
            type: 'application_approved',
            title: '🎉 Application Approved!',
            message: `Your application "${app.proposalTitle}" has been approved!`,
            appId: app.id,
            icon: '🎉',
            color: '#2ecc71'
        });
        
        res.json({ success: true, app });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Return Check 3
router.post('/applications/:id/check3/return', async (req, res) => {
    try {
        const { feedback, updatedBy } = req.body;
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        app.status = 'Returned';
        app.returnedFeedback = feedback;
        app.returnedFromStage = 'check3';
        app.returnedAt = new Date().toISOString();
        app.returnedBy = updatedBy;
        await app.save();
        
        await Notification.create({
            userEmail: app.userEmail,
            type: 'application_returned',
            title: '↩️ Application Returned',
            message: `Your application requires revision: ${feedback.substring(0, 100)}...`,
            appId: app.id,
            icon: '↩️',
            color: '#e74c3c'
        });
        
        res.json({ success: true, app });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ CV REVIEW MANAGEMENT ============

// Update PI CV status
router.put('/applications/:id/cv/pi', async (req, res) => {
    try {
        const { status, updatedBy } = req.body;
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        app.piCVStatus = status;
        await app.save();
        
        await Notification.create({
            userEmail: app.userEmail,
            type: 'cv_status',
            title: '📄 CV Status Updated',
            message: `Your Principal Investigator CV has been marked as ${status}.`,
            appId: app.id,
            icon: status === 'eligible' ? '✅' : (status === 'ineligible' ? '❌' : '⏳'),
            color: status === 'eligible' ? '#2ecc71' : (status === 'ineligible' ? '#e74c3c' : '#f39c12'),
            tab: 'cv'
        });
        
        res.json({ success: true, app });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Team CV status
router.put('/applications/:id/cv/team/:index', async (req, res) => {
    try {
        const { status, updatedBy } = req.body;
        const index = parseInt(req.params.index);
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        if (!app.teamCVs) app.teamCVs = [];
        if (!app.teamCVs[index]) app.teamCVs[index] = {};
        app.teamCVs[index].status = status;
        await app.save();
        
        const memberName = app.teamMembers?.[index]?.name || `Team Member ${index + 1}`;
        
        await Notification.create({
            userEmail: app.userEmail,
            type: 'cv_status',
            title: '📄 CV Status Updated',
            message: `${memberName}'s CV has been marked as ${status}.`,
            appId: app.id,
            icon: status === 'eligible' ? '✅' : (status === 'ineligible' ? '❌' : '⏳'),
            color: status === 'eligible' ? '#2ecc71' : (status === 'ineligible' ? '#e74c3c' : '#f39c12'),
            tab: 'cv'
        });
        
        res.json({ success: true, app });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Save CV feedback
router.post('/applications/:id/cv/feedback', async (req, res) => {
    try {
        const { feedback, updatedBy } = req.body;
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        app.uploadFeedback = feedback;
        await app.save();
        
        await Notification.create({
            userEmail: app.userEmail,
            type: 'feedback',
            title: '💬 New Feedback',
            message: `The research office has left feedback on your CV submissions.`,
            appId: app.id,
            icon: '💬',
            color: '#3498db',
            tab: 'cv'
        });
        
        res.json({ success: true, app });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ EXTERNAL REVIEWER MANAGEMENT ============

// Get external reviewers for an application
router.get('/applications/:id/reviewers', async (req, res) => {
    try {
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        res.json(app.assignedReviewers || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Assign external reviewer
router.post('/applications/:id/reviewers', async (req, res) => {
    try {
        const { reviewerEmail, reviewerName, assignedBy } = req.body;
        console.log('📝 POST /applications/:id/reviewers');
        console.log('   App ID:', req.params.id);
        console.log('   Reviewer:', reviewerEmail);
        
        // Find by id (string field) NOT _id (MongoDB ObjectId)
        const app = await Application.findOne({ id: req.params.id });
        
        if (!app) {
            console.log('❌ Application not found with id:', req.params.id);
            return res.status(404).json({ error: 'Application not found' });
        }
        
        console.log('✅ Found application:', app.id);
        console.log('Current assignedReviewers:', app.assignedReviewers);
        
        if (!app.assignedReviewers) {
            app.assignedReviewers = [];
        }
        
        // Check if already assigned
        if (app.assignedReviewers.some(r => r.email === reviewerEmail)) {
            console.log('⚠️ Reviewer already assigned');
            return res.status(400).json({ error: 'Reviewer already assigned' });
        }
        
        // Add new reviewer
        const newReviewer = {
            email: reviewerEmail,
            name: reviewerName || reviewerEmail.split('@')[0],
            assignedAt: new Date().toISOString(),
            assignedBy: assignedBy,
            status: 'pending'
        };
        
        app.assignedReviewers.push(newReviewer);
        
        // Save and verify
        const savedApp = await app.save();
        console.log('💾 Saved application. assignedReviewers now:', savedApp.assignedReviewers);
        
        // Double-check with a fresh find
        const freshApp = await Application.findOne({ id: req.params.id });
        console.log('🔍 Fresh fetch assignedReviewers:', freshApp.assignedReviewers);
        
        res.json({ 
            success: true, 
            reviewer: newReviewer,
            reviewers: savedApp.assignedReviewers 
        });
        
    } catch (error) {
        console.error('❌ Error assigning reviewer:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// Remove external reviewer
router.delete('/applications/:id/reviewers/:email', async (req, res) => {
    try {
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        app.assignedReviewers = (app.assignedReviewers || []).filter(r => r.email !== req.params.email);
        await app.save();
        
        res.json({ success: true, reviewers: app.assignedReviewers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ SUPER ADMIN SETTINGS MANAGEMENT ============

// Get all super admins
router.get('/super-admins', async (req, res) => {
    try {
        let setting = await Settings.findOne({ key: 'super_admins' });
        if (!setting) {
            // Initialize with default super admin
            setting = await Settings.create({
                key: 'super_admins',
                value: ['200520181@my.xu.edu.ph'],
                description: 'List of super admin emails with full system access'
            });
        }
        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add super admin
router.post('/super-admins', async (req, res) => {
    try {
        const { email, addedBy } = req.body;
        let setting = await Settings.findOne({ key: 'super_admins' });
        let list = setting?.value || ['200520181@my.xu.edu.ph'];
        
        if (!list.includes(email)) {
            list.push(email);
            await Settings.findOneAndUpdate(
                { key: 'super_admins' },
                { value: list, updatedAt: new Date(), updatedBy: addedBy },
                { upsert: true }
            );
            
            await AuditLog.create({
                action: 'ADD_SUPER_ADMIN',
                changes: { email },
                performedBy: addedBy,
                timestamp: new Date()
            });
        }
        res.json({ success: true, superAdmins: list });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove super admin
router.delete('/super-admins/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { removedBy } = req.body;
        let setting = await Settings.findOne({ key: 'super_admins' });
        let list = setting?.value || ['200520181@my.xu.edu.ph'];
        
        list = list.filter(e => e !== email);
        await Settings.findOneAndUpdate(
            { key: 'super_admins' },
            { value: list, updatedAt: new Date(), updatedBy: removedBy },
            { upsert: true }
        );
        
        await AuditLog.create({
            action: 'REMOVE_SUPER_ADMIN',
            changes: { email },
            performedBy: removedBy,
            timestamp: new Date()
        });
        
        res.json({ success: true, superAdmins: list });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all admins
router.get('/admins', async (req, res) => {
    try {
        let setting = await Settings.findOne({ key: 'admin_emails' });
        if (!setting) {
            setting = await Settings.create({
                key: 'admin_emails',
                value: ['200520181@my.xu.edu.ph'],
                description: 'List of admin emails with dashboard access'
            });
        }
        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add admin
router.post('/admins', async (req, res) => {
    try {
        const { email, addedBy } = req.body;
        let setting = await Settings.findOne({ key: 'admin_emails' });
        let list = setting?.value || ['200520181@my.xu.edu.ph'];
        
        if (!list.includes(email)) {
            list.push(email);
            await Settings.findOneAndUpdate(
                { key: 'admin_emails' },
                { value: list, updatedAt: new Date(), updatedBy: addedBy },
                { upsert: true }
            );
            
            await AuditLog.create({
                action: 'ADD_ADMIN',
                changes: { email },
                performedBy: addedBy,
                timestamp: new Date()
            });
        }
        res.json({ success: true, admins: list });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove admin
router.delete('/admins/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { removedBy } = req.body;
        let setting = await Settings.findOne({ key: 'admin_emails' });
        let list = setting?.value || ['200520181@my.xu.edu.ph'];
        
        list = list.filter(e => e !== email);
        await Settings.findOneAndUpdate(
            { key: 'admin_emails' },
            { value: list, updatedAt: new Date(), updatedBy: removedBy },
            { upsert: true }
        );
        
        await AuditLog.create({
            action: 'REMOVE_ADMIN',
            changes: { email },
            performedBy: removedBy,
            timestamp: new Date()
        });
        
        res.json({ success: true, admins: list });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get checker roles
router.get('/checker-roles', async (req, res) => {
    try {
        let setting = await Settings.findOne({ key: 'checker_roles' });
        if (!setting) {
            setting = await Settings.create({
                key: 'checker_roles',
                value: { check1: '', check2: '', check3: '' },
                description: 'Assignment of check stage reviewers'
            });
        }
        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update checker roles
router.put('/checker-roles', async (req, res) => {
    try {
        const roles = req.body;
        const { updatedBy } = req.body;
        
        // Remove updatedBy from roles object
        delete roles.updatedBy;
        
        await Settings.findOneAndUpdate(
            { key: 'checker_roles' },
            { value: roles, updatedAt: new Date(), updatedBy: updatedBy },
            { upsert: true }
        );
        
        await AuditLog.create({
            action: 'UPDATE_CHECKER_ROLES',
            changes: roles,
            performedBy: updatedBy,
            timestamp: new Date()
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get external reviewers pool
router.get('/external-reviewers', async (req, res) => {
    try {
        const reviewers = await ExternalReviewer.find({ isActive: true }).sort({ name: 1 });
        res.json(reviewers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add external reviewer to pool
router.post('/external-reviewers', async (req, res) => {
    try {
        const { email, name, addedBy } = req.body;
        
        let reviewer = await ExternalReviewer.findOne({ email });
        if (reviewer) {
            reviewer.isActive = true;
            reviewer.name = name || reviewer.name;
            await reviewer.save();
        } else {
            reviewer = new ExternalReviewer({
                email,
                name: name || email.split('@')[0],
                addedBy
            });
            await reviewer.save();
        }
        
        await AuditLog.create({
            action: 'ADD_EXTERNAL_REVIEWER',
            changes: { email, name },
            performedBy: addedBy,
            timestamp: new Date()
        });
        
        res.json({ success: true, reviewer });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove external reviewer from pool
router.delete('/external-reviewers/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { removedBy } = req.body;
        
        await ExternalReviewer.findOneAndUpdate(
            { email },
            { isActive: false, updatedAt: new Date() }
        );
        
        await AuditLog.create({
            action: 'REMOVE_EXTERNAL_REVIEWER',
            changes: { email },
            performedBy: removedBy,
            timestamp: new Date()
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get audit log
router.get('/audit-log', async (req, res) => {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ TEST EMAILS MANAGEMENT ============

// Get all test emails (PUBLIC - for login validation)
router.get('/public/test-emails', async (req, res) => {
    try {
        const testEmails = await TestEmail.find({ isActive: true }).sort({ role: 1, email: 1 });
        res.json(testEmails);
    } catch (error) {
        console.error('Error fetching test emails:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all super admins (PUBLIC - for login validation)
router.get('/public/super-admins', async (req, res) => {
    try {
        let setting = await Settings.findOne({ key: 'super_admins' });
        if (!setting) {
            setting = await Settings.create({
                key: 'super_admins',
                value: ['200520181@my.xu.edu.ph'],
                description: 'List of super admin emails with full system access'
            });
        }
        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all admins (PUBLIC - for login validation)
router.get('/public/admins', async (req, res) => {
    try {
        let setting = await Settings.findOne({ key: 'admin_emails' });
        if (!setting) {
            setting = await Settings.create({
                key: 'admin_emails',
                value: ['200520181@my.xu.edu.ph'],
                description: 'List of admin emails with dashboard access'
            });
        }
        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all test emails (protected)
router.get('/test-emails', isSuperAdmin, async (req, res) => {
    try {
        const testEmails = await TestEmail.find({ isActive: true }).sort({ role: 1, email: 1 });
        res.json(testEmails);
    } catch (error) {
        console.error('Error fetching test emails:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add test email (protected)
router.post('/test-emails', isSuperAdmin, async (req, res) => {
    try {
        const { email, role, name, description, addedBy, userEmail } = req.body;
        
        // Use addedBy from request body, or fallback to the authenticated user's email
        const createdBy = addedBy || userEmail;
        
        // Check if email already exists
        const existing = await TestEmail.findOne({ email });
        if (existing) {
            // Reactivate if exists but inactive
            if (!existing.isActive) {
                existing.isActive = true;
                existing.role = role;
                existing.name = name || existing.name;
                existing.description = description || existing.description;
                existing.updatedBy = createdBy;
                existing.updatedAt = new Date();
                await existing.save();
                
                await AuditLog.create({
                    action: 'REACTIVATE_TEST_EMAIL',
                    changes: { email, role },
                    performedBy: createdBy,
                    timestamp: new Date()
                });
                
                return res.json({ success: true, testEmail: existing });
            }
            return res.status(400).json({ error: 'Email already exists in test emails' });
        }
        
        const testEmail = new TestEmail({
            email,
            role,
            name: name || email.split('@')[0],
            description: description || `Test ${role} account`,
            createdBy: createdBy
        });
        
        await testEmail.save();
        
        await AuditLog.create({
            action: 'ADD_TEST_EMAIL',
            changes: { email, role, name },
            performedBy: createdBy,
            timestamp: new Date()
        });
        
        res.status(201).json({ success: true, testEmail });
    } catch (error) {
        console.error('Error adding test email:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete test email (protected)
router.delete('/test-emails/:id', isSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { removedBy, userEmail } = req.body;
        
        const deletedBy = removedBy || userEmail;
        
        const testEmail = await TestEmail.findById(id);
        if (!testEmail) {
            return res.status(404).json({ error: 'Test email not found' });
        }
        
        testEmail.isActive = false;
        testEmail.updatedBy = deletedBy;
        testEmail.updatedAt = new Date();
        await testEmail.save();
        
        await AuditLog.create({
            action: 'DELETE_TEST_EMAIL',
            changes: { email: testEmail.email, role: testEmail.role },
            performedBy: deletedBy,
            timestamp: new Date()
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting test email:', error);
        res.status(500).json({ error: error.message });
    }
});


// ========== RESET CHECK STAGE ==========
router.post('/applications/:id/reset-stage', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, check1CompletedAt, check1Feedback, check2CompletedAt, check2Feedback, check3CompletedAt, check3Feedback, assignedReviewers, updatedBy } = req.body;
        
        console.log(`🔄 Resetting stage for application: ${id} to status: ${status}`);
        
        // Find the application using the Application model (more consistent)
        let application = await Application.findOne({ id: id });
        
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Build update object
        const updateData = {
            status: status,
            updatedAt: new Date(),
            lastModifiedBy: updatedBy || 'admin'
        };
        
        // Add reset fields if provided
        if (check1CompletedAt !== undefined) updateData.check1CompletedAt = check1CompletedAt;
        if (check1Feedback !== undefined) updateData.check1Feedback = check1Feedback;
        if (check2CompletedAt !== undefined) updateData.check2CompletedAt = check2CompletedAt;
        if (check2Feedback !== undefined) updateData.check2Feedback = check2Feedback;
        if (check3CompletedAt !== undefined) updateData.check3CompletedAt = check3CompletedAt;
        if (check3Feedback !== undefined) updateData.check3Feedback = check3Feedback;
        if (assignedReviewers !== undefined) updateData.assignedReviewers = assignedReviewers;
        
        // Update using the model
        const updatedApp = await Application.findOneAndUpdate(
            { id: id },
            { $set: updateData },
            { new: true }
        );
        
        // Add notification for faculty
        await Notification.create({
            userEmail: application.userEmail,
            type: 'stage_reset',
            title: '🔄 Review Stage Reset',
            message: `Your application "${application.proposalTitle?.substring(0, 50)}" has been sent back for ${status === 'Pending Eligibility Check' ? 'Eligibility Review' : (status === 'Pending Secondary Check' ? 'Secondary Review' : 'Final Review')}.`,
            appId: id,
            icon: '🔄',
            color: '#f39c12',
            isRead: false,
            createdAt: new Date()
        });
        
        console.log(`✅ Stage reset for application ${id}`);
        res.json({ success: true, application: updatedApp });
        
    } catch (error) {
        console.error('Reset stage failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Dashboard stats endpoint
router.get('/stats', async (req, res) => {
    try {
        const Application = require('../models/Application');
        
        const [total, pending, approved, returned] = await Promise.all([
            Application.countDocuments({}),
            Application.countDocuments({ status: 'Pending Eligibility Check' }),
            Application.countDocuments({ status: 'Approved' }),
            Application.countDocuments({ status: 'Returned' })
        ]);
        
        res.json({
            total,
            pending,
            approved,
            returned,
            check1: await Application.countDocuments({ status: 'Pending Eligibility Check' }),
            check2: await Application.countDocuments({ status: 'Pending Secondary Check' }),
            check3: await Application.countDocuments({ status: 'Pending Final Check' })
        });
    } catch (error) {
        console.error('Stats error:', error);
        // Return default stats instead of failing
        res.json({
            total: 0,
            pending: 0,
            approved: 0,
            returned: 0,
            check1: 0,
            check2: 0,
            check3: 0
        });
    }
});

module.exports = router;
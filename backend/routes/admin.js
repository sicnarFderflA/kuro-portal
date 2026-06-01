const express = require('express');
const Application = require('../models/Application');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const ExternalReviewer = require('../models/ExternalReviewer');
const TestEmail = require('../models/TestEmail');
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
    try {
        const { status, grant, search } = req.query;
        let query = {};
        if (status && status !== 'all') query.status = status;
        if (grant && grant !== 'all') query.grantTitle = grant;
        if (search) {
            query.$or = [
                { proposalTitle: { $regex: search, $options: 'i' } },
                { userEmail: { $regex: search, $options: 'i' } },
                { piName: { $regex: search, $options: 'i' } }
            ];
        }
        const apps = await Application.find(query).sort({ submittedDate: -1 });
        res.json(apps);
    } catch (error) {
        res.status(500).json({ error: error.message });
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
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        if (!app.assignedReviewers) app.assignedReviewers = [];
        
        if (app.assignedReviewers.some(r => r.email === reviewerEmail)) {
            return res.status(400).json({ error: 'Reviewer already assigned' });
        }
        
        app.assignedReviewers.push({
            email: reviewerEmail,
            name: reviewerName || reviewerEmail.split('@')[0],
            assignedAt: new Date().toISOString(),
            assignedBy: assignedBy,
            status: 'pending'  // ← IMPORTANT: Set initial status
        });
        
        await app.save();
        
        // Also create a notification for the reviewer
        await Notification.create({
            userEmail: reviewerEmail,
            type: 'reviewer_assigned',
            title: '📋 New Review Assignment',
            message: `You have been assigned to review "${app.proposalTitle}". Please log in to submit your evaluation.`,
            appId: app.id,
            icon: '📋',
            color: '#3498db',
            tab: 'reviews'
        });
        
        res.json({ success: true, reviewers: app.assignedReviewers });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

module.exports = router;
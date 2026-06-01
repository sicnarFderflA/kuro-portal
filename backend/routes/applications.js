const express = require('express');
const mongoose = require('mongoose');
const Application = require('../models/Application');
const router = express.Router();

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
            { ...req.body, updatedAt: new Date() },
            { returnDocument: 'after' }
        );
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
// FIXED: Changed 'app' to 'router' and added mongoose import
router.post('/:id/resubmit', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, returnedFeedback, submittedDate } = req.body;
        
        console.log(`📤 Resubmitting application: ${id}`);
        
        const db = mongoose.connection.db;
        
        // Get the existing application - check both collections
        let application = await db.collection('submissions').findOne({ id: id });
        if (!application) {
            application = await db.collection('applications').findOne({ id: id });
        }
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        // Preserve existing signatures - DO NOT reset them
        const existingSignatures = application.signatures || { chair: { signed: false }, dean: { signed: false } };
        
        // Determine next status based on signature status
        let nextStatus = status || 'Awaiting Signatures';
        
        // If both signatures are already signed, go to Check 1 directly
        if (existingSignatures.chair?.signed && existingSignatures.dean?.signed) {
            nextStatus = 'Pending Eligibility Check';
            console.log('Both signatures already signed, moving to Eligibility Check');
        } else if (existingSignatures.chair?.signed || existingSignatures.dean?.signed) {
            nextStatus = 'Awaiting Signatures';
            console.log('Partial signatures, staying in Awaiting Signatures');
        }
        
        // Update application - KEEP signatures
        const updatedApplication = {
            ...application,
            status: nextStatus,
            returnedFeedback: null,  // Clear the feedback
            submittedDate: submittedDate || new Date().toISOString().slice(0, 10),
            updatedAt: new Date().toISOString()
        };
        
        // Update in both possible collections
        await db.collection('submissions').updateOne(
            { id: id },
            { $set: updatedApplication }
        );
        await db.collection('applications').updateOne(
            { id: id },
            { $set: updatedApplication },
            { upsert: true }
        );
        
        // Add notification for admins
        const adminEmails = await db.collection('users').find({ role: 'admin' }).toArray();
        for (const admin of adminEmails) {
            await db.collection('notifications').insertOne({
                userEmail: admin.email,
                type: 'resubmission',
                title: '📤 Application Resubmitted',
                message: `${application.piName || 'Faculty'} has resubmitted "${application.proposalTitle?.substring(0, 50)}" for review.`,
                appId: id,
                icon: '📤',
                color: '#2ecc71',
                isRead: false,
                createdAt: new Date().toISOString()
            });
        }
        
        console.log(`✅ Application ${id} resubmitted with status: ${nextStatus}`);
        res.json({ success: true, application: updatedApplication });
        
    } catch (error) {
        console.error('Resubmit failed:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
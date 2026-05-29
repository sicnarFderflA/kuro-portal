const express = require('express');
const Application = require('../models/Application');
const router = express.Router();

// Dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const total = await Application.countDocuments();
        const pending = await Application.countDocuments({
            status: { $in: ['Pending Eligibility Check', 'Pending Secondary Check', 'Pending Final Check'] }
        });
        const approved = await Application.countDocuments({ status: 'Approved' });
        const returned = await Application.countDocuments({ status: 'Returned' });
        res.json({ total, pending, approved, returned });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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
                { userEmail: { $regex: search, $options: 'i' } }
            ];
        }
        const apps = await Application.find(query).sort({ submittedDate: -1 });
        res.json(apps);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update application status (approve/reject checks)
router.put('/applications/:id/status', async (req, res) => {
    try {
        const { status, feedback } = req.body;
        const app = await Application.findOne({ id: req.params.id });
        if (!app) return res.status(404).json({ error: 'Not found' });
        
        app.status = status;
        if (feedback) {
            if (status === 'Pending Secondary Check') app.check1Feedback = feedback;
            else if (status === 'Pending Final Check') app.check2Feedback = feedback;
            else if (status === 'Approved') app.check3Feedback = feedback;
            else if (status === 'Returned') app.returnedFeedback = feedback;
        }
        
        await app.save();
        res.json(app);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
const express = require('express');
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
            { new: true }
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

module.exports = router;
// api.js - KURO API Client
const API_BASE_URL = 'https://kuro-api-m4mb.onrender.com/api';

// Helper function for API requests with authentication
async function apiRequest(endpoint, options = {}) {
    const token = sessionStorage.getItem('kuro_token');
    const user = JSON.parse(sessionStorage.getItem('kuro_user') || '{}');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    let url = `${API_BASE_URL}${endpoint}`;
    if (user.email && options.method !== 'POST' && options.method !== 'PUT' && !url.includes('userEmail')) {
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}userEmail=${encodeURIComponent(user.email)}`;
    }
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    if (response.status === 204) {
        return null;
    }
    
    return response.json();
}

// ==================== AUTH API ====================
async function googleSignIn(credential, role) {
    const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, role }),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Authentication failed');
    }
    
    const data = await response.json();
    
    if (data.token) {
        sessionStorage.setItem('kuro_token', data.token);
    }
    sessionStorage.setItem('kuro_user', JSON.stringify(data.user));
    
    return data;
}

// ==================== NOTIFICATIONS API ====================
async function getNotifications(userEmail) {
    return apiRequest(`/notifications?userEmail=${encodeURIComponent(userEmail)}`);
}

async function createNotification(notification) {
    return apiRequest('/notifications', {
        method: 'POST',
        body: JSON.stringify(notification)
    });
}

async function markNotificationRead(id) {
    return apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
}

async function markAllNotificationsRead(userEmail) {
    return apiRequest('/notifications/mark-all-read', {
        method: 'PUT',
        body: JSON.stringify({ userEmail })
    });
}

// ==================== APPLICATIONS API ====================
async function getApplication(appId) {
    return apiRequest(`/applications/${appId}`);
}

async function getFacultyApplications() {
    return apiRequest('/faculty/applications');
}

async function createApplication(application) {
    return apiRequest('/applications', {
        method: 'POST',
        body: JSON.stringify(application)
    });
}

async function updateApplication(appId, application) {
    return apiRequest(`/applications/${appId}`, {
        method: 'PUT',
        body: JSON.stringify(application)
    });
}

async function deleteApplication(appId) {
    return apiRequest(`/applications/${appId}`, { method: 'DELETE' });
}

async function resubmitApplication(appId, data) {
    return apiRequest(`/applications/${appId}/resubmit`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

// ==================== SIGNATURE API ====================
async function generateSignatureLinks(appId, data) {
    return apiRequest(`/applications/${appId}/generate-signatures`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function sendSignatureEmails(appId, data) {
    return apiRequest(`/applications/${appId}/send-signature-emails`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function getSignatureStatus(appId) {
    return apiRequest(`/applications/${appId}/signature-status`);
}

// ==================== DRAFTS API ====================
async function saveFacultyDraft(draftData) {
    return apiRequest('/faculty/drafts', {
        method: 'POST',
        body: JSON.stringify(draftData)
    });
}

async function getFacultyDrafts() {
    return apiRequest('/faculty/drafts');
}

async function deleteFacultyDraft(draftId) {
    return apiRequest(`/faculty/drafts/${draftId}`, { method: 'DELETE' });
}

// ==================== REVIEWER API ====================
async function getReviewerTasks() {
    return apiRequest('/reviewer/tasks');
}

async function updateReviewerName(email, name) {
    return apiRequest('/users/reviewer-name', {
        method: 'PUT',
        body: JSON.stringify({ email, name })
    });
}

// ==================== EXPORT ====================
window.KURO_API = {
    // Auth
    googleSignIn,
    
    // Notifications
    getNotifications,
    createNotification,
    markNotificationRead,
    markAllNotificationsRead,
    
    // Applications
    getApplication,
    getFacultyApplications,
    createApplication,
    updateApplication,
    deleteApplication,
    resubmitApplication,
    
    // Signatures
    generateSignatureLinks,
    sendSignatureEmails,
    getSignatureStatus,
    
    // Drafts
    saveFacultyDraft,
    getFacultyDrafts,
    deleteFacultyDraft,
    
    // Reviewer
    getReviewerTasks,
    updateReviewerName
};

console.log('KURO_API loaded successfully');
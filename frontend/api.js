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
    
    // Only add userEmail to GET requests that don't already have an ID in the path
    // and only for specific endpoints that need it
    const needsUserEmail = options.method !== 'POST' && 
                          options.method !== 'PUT' && 
                          options.method !== 'DELETE' &&
                          !endpoint.match(/\/api\/applications\/[^\/]+$/) && // Skip if it's /api/applications/XXX
                          !url.includes('userEmail');
    
    if (user.email && needsUserEmail) {
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}userEmail=${encodeURIComponent(user.email)}`;
    }
    
    console.log('API Request:', url);
    
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

// IMPORTANT: Use the correct endpoint from server.js
async function getFacultyApplications() {
    return apiRequest('/faculty/applications');  // ✅ This matches the new route
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


async function resendSignatureRequests(appId, data) {
    return apiRequest(`/applications/${appId}/resend-signatures`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function getSignatureStatus(appId) {
    // Don't use the main apiRequest that adds userEmail
    const token = sessionStorage.getItem('kuro_token');
    
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const url = `${API_BASE_URL}/api/applications/${appId}/signature-status`;
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
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
    getFacultyApplications,  // Now uses /my-submissions
    createApplication,
    updateApplication,
    deleteApplication,
    resubmitApplication,
    
    // Signatures
    generateSignatureLinks,
    sendSignatureEmails,
    getSignatureStatus,
    resendSignatureRequests,
    
    // Drafts
    saveFacultyDraft,
    getFacultyDrafts,
    deleteFacultyDraft,
    
    // Reviewer
    getReviewerTasks,
    updateReviewerName
};

console.log('KURO_API loaded successfully');
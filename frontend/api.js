// api.js - Add to your frontend files
const API_BASE_URL = 'https://kuro-api-m4mb.onrender.com';

let authToken = null;

// Set token from sessionStorage
function setAuthToken(token) {
    authToken = token;
    if (token) {
        sessionStorage.setItem('kuro_token', token);
    } else {
        sessionStorage.removeItem('kuro_token');
    }
}

// Get token
function getAuthToken() {
    if (!authToken) {
        authToken = sessionStorage.getItem('kuro_token');
    }
    return authToken;
}

// API request helper
async function apiRequest(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
    }
    
    return response.json();
}

// Auth API
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
    setAuthToken(data.token);
    sessionStorage.setItem('kuro_user', JSON.stringify(data.user));
    return data;
}

// Applications API
async function getApplications() {
    return apiRequest('/applications');
}

async function getApplication(id) {
    return apiRequest(`/applications/${id}`);
}

async function createApplication(data) {
    return apiRequest('/applications', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

async function updateApplication(id, data) {
    return apiRequest(`/applications/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

async function deleteApplication(id) {
    return apiRequest(`/applications/${id}`, {
        method: 'DELETE',
    });
}

// Admin API
async function getAdminStats() {
    return apiRequest('/admin/stats');
}

async function getAdminApplications(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return apiRequest(`/admin/applications${params ? `?${params}` : ''}`);
}

async function updateApplicationStatus(id, status, feedback = '') {
    return apiRequest(`/admin/applications/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, feedback }),
    });
}

async function updateCVStatus(id, type, index, status) {
    return apiRequest(`/admin/applications/${id}/cv`, {
        method: 'PUT',
        body: JSON.stringify({ type, index, status }),
    });
}

async function getCheckerSettings() {
    return apiRequest('/admin/settings/checkers');
}

async function updateCheckerSettings(settings) {
    return apiRequest('/admin/settings/checkers', {
        method: 'PUT',
        body: JSON.stringify(settings),
    });
}

async function updateUserCheckerRole(email, role) {
    return apiRequest(`/admin/users/${email}/checker-role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
    });
}

async function assignExternalReviewer(appId, email, name) {
    return apiRequest(`/admin/applications/${appId}/assign-reviewer`, {
        method: 'POST',
        body: JSON.stringify({ email, name }),
    });
}

// Notifications API
async function getNotifications() {
    return apiRequest('/notifications');
}

async function markNotificationRead(id) {
    return apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
}

async function markAllNotificationsRead() {
    return apiRequest('/notifications/mark-all-read', { method: 'PUT' });
}

// Export all functions
window.KURO_API = {
    googleSignIn,
    getApplications,
    getApplication,
    createApplication,
    updateApplication,
    deleteApplication,
    getAdminStats,
    getAdminApplications,
    updateApplicationStatus,
    updateCVStatus,
    getCheckerSettings,
    updateCheckerSettings,
    updateUserCheckerRole,
    assignExternalReviewer,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
};
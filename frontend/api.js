// api.js - KURO API Client
const API_BASE_URL = 'https://kuro-api-m4mb.onrender.com/api';

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
    
    // Store token and user data
    if (data.token) {
        sessionStorage.setItem('kuro_token', data.token);
    }
    sessionStorage.setItem('kuro_user', JSON.stringify(data.user));
    
    return data;
}

// Make available globally
window.KURO_API = {
    googleSignIn
};

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

async function deleteNotification(id) {
    return apiRequest(`/notifications/${id}`, { method: 'DELETE' });
}

// Add to window.KURO_API
window.KURO_API = {
    // ... existing functions ...
    getNotifications,
    createNotification,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
};
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
    let body = options.body;
    
    // For GET requests, add userEmail to URL
    const isGetRequest = !options.method || options.method === 'GET';
    
    if (isGetRequest && user.email && !url.includes('userEmail')) {
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}userEmail=${encodeURIComponent(user.email)}`;
    }
    
    // For POST/PUT/DELETE requests, add userEmail to body if not already present
    if (!isGetRequest && user.email && body) {
        const bodyObj = JSON.parse(body);
        if (!bodyObj.userEmail && !bodyObj.addedBy && !bodyObj.removedBy) {
            bodyObj.userEmail = user.email;
            body = JSON.stringify(bodyObj);
        }
    }
    
    console.log('API Request:', url);
    
    const response = await fetch(url, {
        ...options,
        headers,
        body: body
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

// Helper to get current user email
function getCurrentUserEmail() {
    const user = JSON.parse(sessionStorage.getItem('kuro_user') || '{}');
    return user.email || '';
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

async function getAdminApplications() {
    return apiRequest('/admin/applications');
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

// ==================== CHECK STAGE API (ADMIN) ====================

// Check 1 (Eligibility Review)
async function approveCheck1(appId, feedback) {
    return apiRequest(`/admin/applications/${appId}/check1/approve`, {
        method: 'POST',
        body: JSON.stringify({ feedback, updatedBy: getCurrentUserEmail() })
    });
}

async function returnCheck1(appId, feedback) {
    return apiRequest(`/admin/applications/${appId}/check1/return`, {
        method: 'POST',
        body: JSON.stringify({ feedback, updatedBy: getCurrentUserEmail() })
    });
}

// Check 2 (Secondary Review)
async function approveCheck2(appId, feedback) {
    return apiRequest(`/admin/applications/${appId}/check2/approve`, {
        method: 'POST',
        body: JSON.stringify({ feedback, updatedBy: getCurrentUserEmail() })
    });
}

async function returnCheck2(appId, feedback) {
    return apiRequest(`/admin/applications/${appId}/check2/return`, {
        method: 'POST',
        body: JSON.stringify({ feedback, updatedBy: getCurrentUserEmail() })
    });
}

// Check 3 (Final Review)
async function approveCheck3(appId, feedback) {
    return apiRequest(`/admin/applications/${appId}/check3/approve`, {
        method: 'POST',
        body: JSON.stringify({ feedback, updatedBy: getCurrentUserEmail() })
    });
}

async function returnCheck3(appId, feedback) {
    return apiRequest(`/admin/applications/${appId}/check3/return`, {
        method: 'POST',
        body: JSON.stringify({ feedback, updatedBy: getCurrentUserEmail() })
    });
}

// ==================== CV REVIEW API (ADMIN) ====================

async function updatePICVStatus(appId, status) {
    return apiRequest(`/admin/applications/${appId}/cv/pi`, {
        method: 'PUT',
        body: JSON.stringify({ status, updatedBy: getCurrentUserEmail() })
    });
}

async function updateTeamCVStatus(appId, index, status) {
    return apiRequest(`/admin/applications/${appId}/cv/team/${index}`, {
        method: 'PUT',
        body: JSON.stringify({ status, updatedBy: getCurrentUserEmail() })
    });
}

async function saveCVFeedback(appId, feedback) {
    return apiRequest(`/admin/applications/${appId}/cv/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback, updatedBy: getCurrentUserEmail() })
    });
}

// ==================== EXTERNAL REVIEWER API (ADMIN) ====================

async function getExternalReviewers(appId) {
    return apiRequest(`/admin/applications/${appId}/reviewers`);
}

async function assignExternalReviewer(appId, reviewerEmail, reviewerName) {
    return apiRequest(`/admin/applications/${appId}/reviewers`, {
        method: 'POST',
        body: JSON.stringify({ 
            reviewerEmail, 
            reviewerName: reviewerName || reviewerEmail.split('@')[0],
            assignedBy: getCurrentUserEmail() 
        })
    });
}

async function removeExternalReviewer(appId, reviewerEmail) {
    return apiRequest(`/admin/applications/${appId}/reviewers/${encodeURIComponent(reviewerEmail)}`, {
        method: 'DELETE'
    });
}

// ==================== CHECKER ROLES API (SUPER ADMIN) ====================

async function getCheckerRoles() {
    return apiRequest('/admin/checker-roles');
}

async function updateCheckerRoles(roles) {
    return apiRequest('/admin/checker-roles', {
        method: 'PUT',
        body: JSON.stringify({ ...roles, updatedBy: getCurrentUserEmail() })
    });
}

async function getAuditLog() {
    return apiRequest('/admin/audit-log');
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
    const token = sessionStorage.getItem('kuro_token');
    
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const url = `${API_BASE_URL}/applications/${appId}/signature-status`;
    
    console.log('Getting signature status:', url);
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

async function markSignatureComplete(token, data) {
    return apiRequest(`/signatures/${token}/complete`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
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
    const user = JSON.parse(sessionStorage.getItem('kuro_user') || '{}');
    return apiRequest(`/faculty/drafts/${draftId}?userEmail=${encodeURIComponent(user.email)}`, { 
        method: 'DELETE' 
    });
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

// ============ SUPER ADMIN MANAGEMENT ============

async function getSuperAdmins() {
    return apiRequest('/admin/super-admins');
}

async function addSuperAdmin(email) {
    return apiRequest('/admin/super-admins', {
        method: 'POST',
        body: JSON.stringify({ email, addedBy: getCurrentUserEmail() })
    });
}

async function removeSuperAdmin(email) {
    return apiRequest(`/admin/super-admins/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        body: JSON.stringify({ removedBy: getCurrentUserEmail() })
    });
}

async function getAdmins() {
    return apiRequest('/admin/admins');
}

async function addAdmin(email) {
    return apiRequest('/admin/admins', {
        method: 'POST',
        body: JSON.stringify({ email, addedBy: getCurrentUserEmail() })
    });
}

async function removeAdmin(email) {
    return apiRequest(`/admin/admins/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        body: JSON.stringify({ removedBy: getCurrentUserEmail() })
    });
}

async function getExternalReviewers() {
    return apiRequest('/admin/external-reviewers');
}

async function addExternalReviewerToPool(email, name) {
    return apiRequest('/admin/external-reviewers', {
        method: 'POST',
        body: JSON.stringify({ email, name, addedBy: getCurrentUserEmail() })
    });
}

async function removeExternalReviewerFromPool(email) {
    return apiRequest(`/admin/external-reviewers/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        body: JSON.stringify({ removedBy: getCurrentUserEmail() })
    });
}

// ============ TEST EMAIL API ============

async function getTestEmails() {
    // GET requests need userEmail in query params
    const user = JSON.parse(sessionStorage.getItem('kuro_user') || '{}');
    return apiRequest(`/admin/test-emails?userEmail=${encodeURIComponent(user.email)}`);
}

async function addTestEmail(email, role, name, description) {
    const user = JSON.parse(sessionStorage.getItem('kuro_user') || '{}');
    return apiRequest('/admin/test-emails', {
        method: 'POST',
        body: JSON.stringify({ 
            userEmail: user.email,  // ← ADD THIS
            email, 
            role, 
            name, 
            description, 
            addedBy: user.email 
        })
    });
}

async function deleteTestEmail(id) {
    const user = JSON.parse(sessionStorage.getItem('kuro_user') || '{}');
    return apiRequest(`/admin/test-emails/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ 
            userEmail: user.email,  // ← ADD THIS
            removedBy: user.email 
        })
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
    getAdminApplications,
    createApplication,
    updateApplication,
    deleteApplication,
    resubmitApplication,
    
    // Check Stages (Admin)
    approveCheck1,
    returnCheck1,
    approveCheck2,
    returnCheck2,
    approveCheck3,
    returnCheck3,
    
    // CV Review (Admin)
    updatePICVStatus,
    updateTeamCVStatus,
    saveCVFeedback,
    
    // External Reviewers (Admin)
    getExternalReviewers,
    assignExternalReviewer,
    removeExternalReviewer,
    
    // Checker Roles (Super Admin)
    getCheckerRoles,
    updateCheckerRoles,
    getAuditLog,
    
    // Signatures
    generateSignatureLinks,
    sendSignatureEmails,
    getSignatureStatus,
    resendSignatureRequests,
    markSignatureComplete,
    
    // Drafts
    saveFacultyDraft,
    getFacultyDrafts,
    deleteFacultyDraft,
    
    // Reviewer
    getReviewerTasks,
    updateReviewerName,

    // Admin Management
    getSuperAdmins, addSuperAdmin, removeSuperAdmin,
    getAdmins, addAdmin, removeAdmin,
    getExternalReviewers, addExternalReviewerToPool, removeExternalReviewerFromPool,
    getTestEmails, addTestEmail, deleteTestEmail
};

console.log('KURO_API loaded successfully with admin methods');
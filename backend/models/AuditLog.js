// models/AuditLog.js
const auditLogSchema = new mongoose.Schema({
    userEmail: String,
    action: { type: String, enum: ['create', 'update', 'delete', 'status_change', 'signature'] },
    entityType: { type: String, enum: ['application', 'draft', 'user', 'notification'] },
    entityId: String,
    oldData: mongoose.Schema.Types.Mixed,
    newData: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    createdAt: { type: Date, default: Date.now }
});
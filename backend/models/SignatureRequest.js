const mongoose = require('mongoose');

const signatureRequestSchema = new mongoose.Schema({
    appId: { type: String, required: true, index: true },
    chairToken: { type: String, unique: true, sparse: true },
    deanToken: { type: String, unique: true, sparse: true },
    chairEmail: String,
    chairName: String,
    deanEmail: String,
    deanName: String,
    chairCompleted: { type: Boolean, default: false },
    deanCompleted: { type: Boolean, default: false },
    chairSignedAt: Date,
    deanSignedAt: Date,
    chairSignerName: String,
    deanSignerName: String,
    chairSignerEmail: String,
    deanSignerEmail: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    revoked: { type: Boolean, default: false }
});

module.exports = mongoose.model('SignatureRequest', signatureRequestSchema);
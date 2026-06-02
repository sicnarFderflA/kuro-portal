const mongoose = require('mongoose');

const cvUploadSchema = new mongoose.Schema({
    applicationId: { type: String, required: true, index: true },
    type: { type: String, enum: ['pi', 'team'], required: true },
    teamIndex: { type: Number, default: 0 },
    fileName: String,
    fileData: { type: String, required: true }, // Base64
    uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CVUpload', cvUploadSchema);
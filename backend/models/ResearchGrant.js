// models/ResearchGrant.js
const researchGrantSchema = new mongoose.Schema({
    grantCode: { type: String, required: true, unique: true },
    grantName: { type: String, required: true },
    amountRange: String,
    focus: String,
    eligibility: String,
    isActive: { type: Boolean, default: true }
});

// Seed data (run once)
const grants = [
    { grantCode: 'IR', grantName: 'Institutional Research (IR) Award', amountRange: 'Php 20,000 - Php 75,000', focus: 'Research projects relevant to improve University\'s policies...', eligibility: 'Full-time regular higher education faculty member...' },
    { grantCode: 'MBHR', grantName: 'Miguel Bernad Humanities Research (MBHR) Award', amountRange: 'up to Php 80,000', focus: 'Research in humanities focusing on Miguel A Bernad...', eligibility: 'Full-time regular higher education faculty member...' },
    { grantCode: 'MR', grantName: 'Mindanao Research (MR) Award', amountRange: 'Php 400,000 - Php 2,000,000', focus: 'Addresses issues in Mindanao...', eligibility: 'Research team of full-time regular faculty members...' },
    { grantCode: 'MRR', grantName: 'Matteo Ricci Research (MRR) Award', amountRange: 'up to Php 200,000', focus: 'Research projects aligned to Xavier Ateneo Research Agenda...', eligibility: 'Full-time regular higher education faculty member...' },
    { grantCode: 'KSRA', grantName: 'Kinaadman Student Research Award (KSRA)', amountRange: 'up to Php 30,000', focus: 'Student research projects', eligibility: 'Currently enrolled undergraduate or graduate student...' }
];
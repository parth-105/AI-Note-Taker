const mongoose = require('mongoose');

const lectureSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, default: '' },
    topic: { type: String, default: '' },
    description: { type: String, default: '' },
    facultyId: { type: mongoose.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionCode: { type: String, required: true, unique: true, uppercase: true },
    startTime: Date,
    endTime: Date,
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'ENDED', 'ARCHIVED'], default: 'DRAFT' },
    studentCount: { type: Number, default: 0 },
    options: {
      allowImages: { type: Boolean, default: true },
      allowText: { type: Boolean, default: true },
    },
    statistics: {
      totalObservations: { type: Number, default: 0 },
      observationTypeCounts: { type: Map, of: Number, default: {} },
      participationCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

lectureSchema.index({ status: 1 });

module.exports = mongoose.model('Lecture', lectureSchema);

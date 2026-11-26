const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    lectureId: { type: mongoose.Types.ObjectId, ref: 'Lecture', required: true, index: true },
    studentId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

participantSchema.index({ lectureId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Participant', participantSchema);

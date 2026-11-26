const mongoose = require('mongoose');

const insightSchema = new mongoose.Schema(
  {
    lectureId: { type: mongoose.Types.ObjectId, ref: 'Lecture', required: true, index: true },
    type: {
      type: String,
      enum: ['REPEATED_QUESTION', 'CONFUSION_SPIKE', 'HIGH_ACTIVITY', 'TOPIC_BURST'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    evidence: {
      observationIds: [{ type: mongoose.Types.ObjectId, ref: 'Observation' }],
      participantCount: { type: Number, default: 0 },
      elapsedSecRange: { start: Number, end: Number },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LectureInsight', insightSchema);

const mongoose = require('mongoose');

const clusterSchema = new mongoose.Schema(
  {
    lectureId: { type: mongoose.Types.ObjectId, ref: 'Lecture', required: true, index: true },
    category: { type: String, enum: ['TOPIC', 'QUESTION', 'CONFUSION', 'IMPORTANT'], required: true },
    label: { type: String, required: true },
    memberIds: [{ type: mongoose.Types.ObjectId, ref: 'Observation' }],
    studentIds: [{ type: mongoose.Types.ObjectId, ref: 'User' }],
    participantCount: { type: Number, default: 0 },
    centroid: { type: [Number], default: undefined, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ObservationCluster', clusterSchema);

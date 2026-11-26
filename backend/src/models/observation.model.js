const mongoose = require('mongoose');

const observationSchema = new mongoose.Schema(
  {
    lectureId: { type: mongoose.Types.ObjectId, ref: 'Lecture', required: true, index: true },
    studentId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['IMPORTANT', 'QUESTION', 'CONFUSION', 'EXAMPLE', 'NOTE', 'IMAGE'],
      required: true,
    },
    text: { type: String, trim: true, maxlength: 500, default: '' },
    image: {
      type: { type: String, default: '' },
      storage: { type: String, enum: ['', 'local', 'cloudinary'], default: '' },
      url: String,
      width: Number,
      height: Number,
      sizeBytes: Number,
    },
    ocrText: { type: String, default: '' },
    classification: {
      type: {
        type: String,
        enum: ['QUESTION', 'CONFUSION', 'IMPORTANT', 'NEUTRAL'],
        default: 'NEUTRAL',
      },
      confidence: { type: Number, default: 0, min: 0, max: 1 },
      matchedTerms: { type: [String], default: [] },
      classifiedAt: { type: Date, default: null },
    },
    elapsedSec: { type: Number, required: true, min: 0 },
    embedding: { type: [Number], default: undefined, select: false },
    isDuplicate: { type: Boolean, default: false },
    duplicateOf: { type: mongoose.Types.ObjectId, ref: 'Observation', default: null },
    clusterRef: { type: mongoose.Types.ObjectId, ref: 'ObservationCluster' },
    source: { type: String, enum: ['app', 'simulator'], default: 'app' },
    idempotencyKey: { type: String, index: true },
  },
  { timestamps: true }
);

observationSchema.index({ lectureId: 1, elapsedSec: 1 });
observationSchema.index({ lectureId: 1, studentId: 1 });
observationSchema.index({ lectureId: 1, type: 1 });

observationSchema.virtual('effectiveType').get(function effectiveType() {
  const classified = this.classification?.type;
  if (classified === 'QUESTION' || classified === 'CONFUSION' || classified === 'IMPORTANT') {
    return classified;
  }
  return this.type;
});

observationSchema.set('toJSON', { virtuals: true });
observationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Observation', observationSchema);
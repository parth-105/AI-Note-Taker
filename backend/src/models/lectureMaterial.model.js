const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema(
  {
    lectureId: { type: mongoose.Types.ObjectId, ref: 'Lecture', required: true, index: true },
    uploaderId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    filename: String,
    originalName: String,
    mime: String,
    sizeBytes: Number,
    storageUrl: String,
    format: { type: String, enum: ['pdf', 'pptx'] },
    extraction: {
      status: { type: String, enum: ['pending', 'done', 'no-text-found', 'error'], default: 'pending' },
      pages: [{ index: Number, text: String }],
      fullText: String,
      wordCount: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LectureMaterial', materialSchema);

const mongoose = require('mongoose');

const synthesizedNoteSchema = new mongoose.Schema(
  {
    lectureId: { type: mongoose.Types.ObjectId, ref: 'Lecture', required: true, index: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    sections: {
      importantPoints: [{ type: String }],
      commonQuestions: [{ type: String }],
      confusionPoints: [{ type: String }],
      coveredTopics: [{ type: String }],
      optionalNotes: [{ type: String }],
    },
    evidenceClusters: [
      {
        clusterId: { type: mongoose.Types.ObjectId, ref: 'ObservationCluster' },
        label: String,
        participantCount: Number,
      },
    ],
    generation: {
      provider: { type: String, default: 'evidence-fallback' },
      model: String,
      evidenceObservationCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SynthesizedNote', synthesizedNoteSchema);
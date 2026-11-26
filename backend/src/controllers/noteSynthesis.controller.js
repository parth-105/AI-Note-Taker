const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');
const { buildCollectiveNote } = require('../services/noteSynthesisService');

exports.synthesize = asyncHandler(async (req, res) => {
  const note = await buildCollectiveNote(req.params.id, {
    question: req.body?.question,
    maxTokens: req.body?.maxTokens,
  });
  res.status(201).json(note);
});

exports.list = asyncHandler(async (req, res) => {
  const SynthesizedNote = require('../models/synthesizedNote.model');
  const notes = await SynthesizedNote.find({ lectureId: req.params.id }).sort({ createdAt: -1 });
  res.json({ notes });
});
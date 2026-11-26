const ObservationCluster = require('../models/observationCluster.model');
const LectureInsight = require('../models/lectureInsight.model');
const { asyncHandler } = require('../utils/asyncHandler');

exports.clusters = asyncHandler(async (req, res) => {
  const clusters = await ObservationCluster.find({ lectureId: req.params.id }).sort({ participantCount: -1 });
  res.json({ clusters });
});

exports.insights = asyncHandler(async (req, res) => {
  const insights = await LectureInsight.find({ lectureId: req.params.id }).sort({ createdAt: -1 });
  res.json({ insights });
});

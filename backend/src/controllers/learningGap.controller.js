const Observation = require('../models/observation.model');
const ObservationCluster = require('../models/observationCluster.model');
const Lecture = require('../models/lecture.model');
const Participant = require('../models/participant.model');
const { asyncHandler } = require('../utils/asyncHandler');
const { effectiveObsType } = require('../services/clusterService');

function topicKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

exports.gaps = asyncHandler(async (req, res) => {
  const studentId = req.params.id === 'me' ? req.user.sub : req.params.id;
  const lectureId = req.query.lectureId;

  if (!lectureId) {
    throw Object.assign(new Error('lectureId query parameter is required'), { status: 400 });
  }

  const [lecture, clusters, myObservations] = await Promise.all([
    Lecture.findById(lectureId),
    ObservationCluster.find({ lectureId }).sort({ participantCount: -1 }).limit(20),
    Observation.find({ lectureId, studentId }),
  ]);

  if (!lecture) {
    throw Object.assign(new Error('Lecture not found'), { status: 404 });
  }

  const contributedClusterIds = new Set(
    myObservations.map((o) => String(o.clusterRef)).filter(Boolean)
  );

  const gaps = clusters
    .filter((c) => !contributedClusterIds.has(String(c._id)))
    .map((c) => ({
      clusterId: c._id,
      label: c.label,
      participantCount: c.participantCount,
      reason: 'High-participant cluster you did not contribute to',
    }));

  const topicsCovered = [];
  const topicsMarkedImportant = [];
  const topicsQuestioned = [];
  const topicsReportedConfusing = [];

  for (const observation of myObservations) {
    const labelSource = observation.text || observation.ocrText || effectiveObsType(observation);
    const label = topicKey(labelSource);
    if (!label) continue;

    const type = effectiveObsType(observation);
    if (type === 'IMPORTANT') topicsMarkedImportant.push(labelSource);
    if (type === 'QUESTION') topicsQuestioned.push(labelSource);
    if (type === 'CONFUSION') topicsReportedConfusing.push(labelSource);
    if (['IMPORTANT', 'QUESTION', 'CONFUSION', 'EXAMPLE', 'NOTE'].includes(type)) {
      topicsCovered.push(labelSource);
    }
  }

  res.json({
    gaps,
    evidenceProfile: {
      studentId,
      lectureId,
      topicsCovered,
      topicsMarkedImportant,
      topicsQuestioned,
      topicsReportedConfusing,
      participationCount: myObservations.length,
      duplicateCount: myObservations.filter((o) => o.isDuplicate).length,
      understandingClaim: 'not-assessed',
      policy: 'Evidence only. Notes do not prove understanding.',
    },
  });
});
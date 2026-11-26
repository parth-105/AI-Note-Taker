const LectureInsight = require('../models/lectureInsight.model');
const Observation = require('../models/observation.model');
const ObservationCluster = require('../models/observationCluster.model');
const { effectiveObsType } = require('./clusterService');

function deriveInsights(clusters) {
  const insights = [];
  for (const c of clusters) {
    const questions = c.items.filter((x) => effectiveObsType(x.obs) === 'QUESTION').length;
    const confusion = c.items.filter((x) => effectiveObsType(x.obs) === 'CONFUSION').length;
    if (questions >= 3) {
      insights.push({
        type: 'REPEATED_QUESTION',
        title: `Repeated question: ${c.label}`,
        description: `${questions} students asked independently about "${c.label}"`,
        participantCount: c.participantCount,
      });
    }
    if (confusion >= 5) {
      insights.push({
        type: 'CONFUSION_SPIKE',
        title: `Confusion spike: ${c.label}`,
        description: `${confusion} students independently reported confusion related to "${c.label}"`,
        participantCount: c.participantCount,
      });
    }
  }
  return insights;
}

async function persistInsights(lectureId) {
  const clusters = await ObservationCluster.find({ lectureId });
  const observations = await Observation.find({ lectureId });
  await LectureInsight.deleteMany({ lectureId });

  const insights = [];
  for (const cluster of clusters) {
    const items = observations
      .filter((o) => String(o.clusterRef || '') === String(cluster._id))
      .map((o) => ({ obs: o }));

    const questions = items.filter((x) => effectiveObsType(x.obs) === 'QUESTION');
    const confusion = items.filter((x) => effectiveObsType(x.obs) === 'CONFUSION');
    const elapsedValues = items.map((x) => x.obs.elapsedSec || 0);

    if (questions.length >= 3) {
      insights.push({
        lectureId,
        type: 'REPEATED_QUESTION',
        title: `Repeated question: ${cluster.label}`,
        description: `${questions.length} students independently asked about "${cluster.label}"`,
        evidence: {
          observationIds: questions.map((x) => x.obs._id),
          participantCount: cluster.participantCount,
          elapsedSecRange: {
            start: Math.min(...elapsedValues),
            end: Math.max(...elapsedValues),
          },
        },
      });
    }

    if (confusion.length >= 5) {
      insights.push({
        lectureId,
        type: 'CONFUSION_SPIKE',
        title: `Confusion spike: ${cluster.label}`,
        description: `${confusion.length} students independently reported confusion related to "${cluster.label}"`,
        evidence: {
          observationIds: confusion.map((x) => x.obs._id),
          participantCount: cluster.participantCount,
          elapsedSecRange: {
            start: Math.min(...elapsedValues),
            end: Math.max(...elapsedValues),
          },
        },
      });
    }
  }

  if (insights.length) await LectureInsight.insertMany(insights);
  return LectureInsight.find({ lectureId });
}

module.exports = { deriveInsights, persistInsights };
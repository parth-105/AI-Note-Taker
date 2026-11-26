const Observation = require('../models/observation.model');
const Lecture = require('../models/lecture.model');
const LectureMaterial = require('../models/lectureMaterial.model');
const SynthesizedNote = require('../models/synthesizedNote.model');
const { syncObservationClusters, effectiveObsType } = require('./clusterService');
const { generateAnswer } = require('./answerService');
const { tokenize } = require('./tfidf');

function observationContent(observation) {
  return `${observation.text || ''} ${observation.ocrText || ''}`.trim();
}

function cleanEvidenceText(text, maxLength = 220) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function uniqueByContent(values) {
  const set = new Set();
  const result = [];
  for (const value of values) {
    const key = value.toLowerCase().replace(/\s+/g, ' ').trim();
    if (key && !set.has(key)) {
      set.add(key);
      result.push(cleanEvidenceText(value, 180));
    }
  }
  return result.slice(0, 8);
}

function extractTopicsFromText(value) {
  return tokenize(value)
    .filter((term) => term.length > 2)
    .slice(0, 8);
}

async function buildCollectiveNote(lectureId, options = {}) {
  const lecture = await Lecture.findById(lectureId);
  if (!lecture) {
    throw Object.assign(new Error('Lecture not found'), { status: 404 });
  }

  const observations = await Observation.find({
    lectureId,
    isDuplicate: { $ne: true },
    $or: [
      { text: { $ne: '' } },
      { ocrText: { $ne: '' } },
    ],
  }).sort({ createdAt: 1 });

  const clusters = await syncObservationClusters(lectureId);

  // Refetch because syncObservationClusters updates clusterRef directly in Mongo.
  const clusteredObservations = await Observation.find({
    lectureId,
    isDuplicate: { $ne: true },
    $or: [
      { text: { $ne: '' } },
      { ocrText: { $ne: '' } },
    ],
  }).sort({ createdAt: 1 });

  const [materials] = await Promise.all([
    LectureMaterial.find({ lectureId }),
  ]);

  // Always use evidence language. We do not claim student understanding.
  const importantPoints = [];
  const commonQuestions = [];
  const confusionPoints = [];
  const optionalNotes = [];

  for (const cluster of clusters) {
    const items = clusteredObservations.filter(
      (o) => String(o.clusterRef || '') === String(cluster._id)
    );
    if (!items.length) continue;

    const participants = cluster.participantCount
      || new Set(items.map((o) => String(o.studentId))).size;
    const label = cleanEvidenceText(cluster.label, 160);

    const importantItems = items.filter((o) => effectiveObsType(o) === 'IMPORTANT');
    const questionItems = items.filter((o) => effectiveObsType(o) === 'QUESTION');
    const confusionItems = items.filter((o) => effectiveObsType(o) === 'CONFUSION');
    const questionParticipants = new Set(questionItems.map((o) => String(o.studentId))).size;
    const confusionParticipants = new Set(confusionItems.map((o) => String(o.studentId))).size;

    if (importantItems.length) {
      importantPoints.push(
        `${label} was emphasized by ${participants} student${participants === 1 ? '' : 's'}.`
      );
    }

    if (questionItems.length >= 3 || questionParticipants >= 3) {
      commonQuestions.push(`${label} was asked independently by multiple students.`);
    } else if (questionItems.length) {
      optionalNotes.push(`A question about ${label} appeared in the lecture evidence.`);
    }

    if (confusionItems.length >= 5 || confusionParticipants >= 5) {
      confusionPoints.push(`Several students reported confusion around ${label}.`);
    } else if (confusionItems.length) {
      optionalNotes.push(`Confusion evidence appeared around ${label}.`);
    }
  }

  const coveredTopics = uniqueByContent([
    ...clusters.map((cluster) => cluster.label),
    ...clusteredObservations.map((observation) => observationContent(observation)),
    ...extractTopicsFromText(lecture.topic || ''),
    ...extractTopicsFromText(lecture.subject || ''),
  ]);

  const question = options.question
    || 'What important topics, questions, and confusion points appear in the collective student notes?';

  const evidenceForLlm = {
    observations: clusteredObservations.slice(0, 15).map((observation) => ({
      observation,
      score: 1,
    })),
    observationCount: clusteredObservations.length,
    clusters,
    insights: [],
  };

  const generated = await generateAnswer(question, evidenceForLlm, {
    enabled: process.env.AI_ENABLED !== 'false'
      && process.env.NOTE_SYNTHESIS_ENABLED !== 'false',
    preferCloud: process.env.LLM_PROVIDER === 'cloud',
    cloud: {
      maxTokens: 500,
      temperature: 0.2,
    },
    maxTokens: options.maxTokens || 320,
  });

  const note = await SynthesizedNote.create({
    lectureId,
    title: `Collective class note: ${lecture.title || lecture.subject || 'Lecture'}`,
    summary: generated.answer,
    sections: {
      importantPoints: uniqueByContent(importantPoints),
      commonQuestions: uniqueByContent(commonQuestions),
      confusionPoints: uniqueByContent(confusionPoints),
      coveredTopics,
      optionalNotes: uniqueByContent(optionalNotes),
    },
    evidenceClusters: clusters.slice(0, 12).map((cluster) => ({
      clusterId: cluster._id,
      label: cleanEvidenceText(cluster.label, 180),
      participantCount: cluster.participantCount,
    })),
    generation: {
      provider: generated.provider,
      model: generated.model,
      evidenceObservationCount: clusteredObservations.length,
    },
  });

  return {
    note,
    materialCount: materials.length,
  };
}

module.exports = {
  buildCollectiveNote,
};
const { buildVocabulary, tfidfVector, cosine, tokenize } = require('./tfidf');
const Observation = require('../models/observation.model');
const ObservationCluster = require('../models/observationCluster.model');
const { embedTexts } = require('./embeddingService');

function effectiveObsType(observation) {
  const classified = observation?.classification?.type;
  if (classified === 'QUESTION' || classified === 'CONFUSION' || classified === 'IMPORTANT') {
    return classified;
  }
  return observation?.type || 'TOPIC';
}

function observationDoc(observation) {
  return `${effectiveObsType(observation)}: ${observation.text || ''} ${observation.ocrText || ''}`;
}

function clusterWithVectors(observations, vectors, threshold) {
  let clusterIdx = 0;
  const clusters = [];
  for (let i = 0; i < observations.length; i += 1) {
    const obs = observations[i];
    const vec = vectors[i];
    let matched = false;
    for (const cluster of clusters) {
      const ref = cluster.items[0].vec;
      const score = cosine(vec, ref);
      if (score >= threshold) {
        cluster.items.push({ obs, vec, score });
        cluster.participantCount = new Set(cluster.items.map((x) => String(x.obs.studentId))).size;
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({
        id: `cluster-${clusterIdx += 1}`,
        items: [{ obs, vec, score: 1 }],
        participantCount: 1,
        label: obs.text || effectiveObsType(obs),
      });
    }
  }
  return clusters;
}

function clusterWithTfidf(observations, threshold) {
  const docs = observations.map(observationDoc);
  const vocab = buildVocabulary(docs);
  const df = { df: new Map(), N: docs.length };
  for (const doc of docs) {
    for (const t of new Set(tokenize(doc))) df.df.set(t, (df.df.get(t) || 0) + 1);
  }
  const vectors = docs.map((doc) => tfidfVector(doc, vocab, df));
  return clusterWithVectors(observations, vectors, threshold);
}

async function clusterObservations(observations, threshold = 0.55) {
  if (!observations.length) return [];

  let embeddings = null;
  if (process.env.EMBEDDINGS_ENABLED !== 'false') {
    try {
      embeddings = await embedTexts(observations.map(observationDoc));
    } catch (err) {
      embeddings = null;
    }
  }

  const vectors = observations.map((o, i) => ({
    obs: o,
    vec: embeddings?.[i]?.length ? embeddings[i] : null,
  }));

  if (!vectors.every((x) => x.vec?.length)) return clusterWithTfidf(observations, threshold);

  return clusterWithVectors(observations, vectors.map((x) => x.vec), 0.72);
}

function mapCategory(type) {
  if (type === 'QUESTION' || type === 'CONFUSION' || type === 'IMPORTANT') return type;
  return 'TOPIC';
}

async function syncObservationClusters(lectureId) {
  const observations = await Observation.find({ lectureId }).sort({ createdAt: 1 });
  const grouped = await clusterObservations(observations);

  await ObservationCluster.deleteMany({ lectureId });
  await Observation.updateMany({ lectureId }, { $set: { clusterRef: null } });

  const created = [];
  for (const group of grouped) {
    const first = group.items[0];
    const cluster = await ObservationCluster.create({
      lectureId,
      category: mapCategory(effectiveObsType(first.obs)),
      label: first.obs.text || effectiveObsType(first.obs),
      memberIds: group.items.map((x) => x.obs._id),
      studentIds: [...new Set(group.items.map((x) => String(x.obs.studentId)))],
      participantCount: group.participantCount,
      centroid: first.vec?.length ? first.vec : undefined,
    });

    await Observation.updateMany(
      { _id: { $in: group.items.map((x) => x.obs._id) } },
      {
        $set: {
          clusterRef: cluster._id,
          embedding: first.vec?.length ? first.vec : undefined,
        },
      }
    );
    created.push(cluster);
  }
  return created;
}

module.exports = {
  clusterObservations,
  syncObservationClusters,
  mapCategory,
  effectiveObsType,
};
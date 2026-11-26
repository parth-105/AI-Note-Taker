const { tokenize, cosine, buildVocabulary, tfidfVector } = require('./tfidf');
const { embedTexts } = require('./embeddingService');

function normalizedText(observation) {
  return `${observation.text || ''} ${observation.ocrText || ''}`.trim();
}

function tokenJaccard(a, b) {
  const at = new Set(tokenize(a));
  const bt = new Set(tokenize(b));
  if (!at.size || !bt.size) return 0;

  let intersection = 0;
  for (const t of at) if (bt.has(t)) intersection += 1;

  return intersection / (at.size + bt.size - intersection);
}

async function markDuplicates(observations) {
  if (!observations.length) { return { observations, changed: [] }; }

  let embeddings = null;
  if (process.env.EMBEDDINGS_ENABLED !== 'false') {
    try {
      embeddings = await embedTexts(observations.map(normalizedText));
    } catch (err) {
      embeddings = null;
    }
  }

  const docs = observations.map(normalizedText);
  const vocab = buildVocabulary(docs);
  const df = { df: new Map(), N: docs.length };
  for (const doc of docs) {
    for (const t of new Set(tokenize(doc))) {
      df.df.set(t, (df.df.get(t) || 0) + 1);
    }
  }

  const vectors = observations.map((o, i) => ({
    obs: o,
    vec: embeddings?.[i]?.length
      ? embeddings[i]
      : tfidfVector(docs[i], vocab, df),
  }));

  const changed = [];
  for (let i = 0; i < vectors.length; i += 1) {
    const current = vectors[i];
    const priorMatches = [];

    for (let j = 0; j < i; j += 1) {
      const prior = vectors[j];

      // Different students reporting similar evidence is a common pattern,
      // not a duplicate. Only the same student's resubmission is duplicate.
      if (String(current.obs.studentId) !== String(prior.obs.studentId)) continue;

      const score = cosine(current.vec, prior.vec);
      if (score >= 0.88) priorMatches.push({ observation: prior.obs, score });
    }

    const isDuplicate = priorMatches.length > 0;
    const best = priorMatches.sort((a, b) => b.score - a.score)[0];

    if (isDuplicate !== Boolean(current.obs.isDuplicate) || current.obs.duplicateOf !== best?.observation?._id) {
      current.obs.isDuplicate = isDuplicate;
      current.obs.duplicateOf = isDuplicate ? best.observation._id : undefined;
      await current.obs.save();
      changed.push(current.obs);
    }
  }

  return { observations, changed };
}

module.exports = { markDuplicates, normalizedText, tokenJaccard };
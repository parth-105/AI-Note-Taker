const path = require('path');
const Observation = require('../models/observation.model');
const ObservationCluster = require('../models/observationCluster.model');
const LectureInsight = require('../models/lectureInsight.model');
const { embedTexts } = require('./embeddingService');
const { tokenize, buildVocabulary, tfidfVector, cosine } = require('./tfidf');
const { generateCloudAnswer, hasCloudLlm } = require('./cloudLlmService');

let generators = new Map();

async function getGenerator(modelName) {
  if (generators.has(modelName)) return generators.get(modelName);
  try {
    const transformers = require('@huggingface/transformers');
    if (transformers.env) {
      transformers.env.cacheDir = process.env.HF_CACHE_DIR
        || path.resolve(__dirname, '../../.cache/huggingface');
    }
    const generator = await transformers.pipeline('text2text-generation', modelName);
    generators.set(modelName, generator);
    return generator;
  } catch (err) {
    return null;
  }
}

function effectiveObsType(observation) {
  const classified = observation?.classification?.type;
  if (classified === 'QUESTION' || classified === 'CONFUSION' || classified === 'IMPORTANT') {
    return classified;
  }
  return observation?.type || 'NOTE';
}

function observationContent(observation) {
  return `${observation.text || ''} ${observation.ocrText || ''}`.trim();
}

async function retrieveEvidence(lectureId, question, options = {}) {
  const limit = options.limit || 12;

  const [observations, clusters, insights] = await Promise.all([
    Observation.find({
      lectureId,
      isDuplicate: { $ne: true },
      $or: [
        { text: { $ne: '' } },
        { ocrText: { $ne: '' } },
      ],
    }).sort({ createdAt: -1 }).limit(limit),
    ObservationCluster.find({ lectureId }).sort({ participantCount: -1 }).limit(8),
    LectureInsight.find({ lectureId }).sort({ createdAt: -1 }).limit(5),
  ]);

  if (!observations.length) {
    return { observations: [], observationCount: 0, clusters, insights };
  }

  const docs = observations.map((observation) => observationContent(observation));
  const lowerQuestion = String(question).toLowerCase();
  const terms = tokenize(lowerQuestion).filter((term) => term.length > 2);

  let semanticVectors = null;
  if (process.env.EMBEDDINGS_ENABLED !== 'false') {
    try {
      semanticVectors = await embedTexts(docs, options.embedding || {});
    } catch (err) {
      semanticVectors = null;
    }
  }

  let scoreFn;
  if (semanticVectors?.length === docs.length) {
    const questionVector = (await embedTexts([lowerQuestion], options.embedding || {}))?.[0];
    if (questionVector?.length) {
      scoreFn = (index) => cosine(questionVector, semanticVectors[index]);
    }
  }

  if (!scoreFn) {
    const vocabulary = buildVocabulary([...docs, lowerQuestion]);
    const df = { df: new Map(), N: docs.length + 1 };
    for (const doc of [...docs, lowerQuestion]) {
      for (const token of new Set(tokenize(doc))) {
        df.df.set(token, (df.df.get(token) || 0) + 1);
      }
    }
    const questionVector = tfidfVector(lowerQuestion, vocabulary, df);
    scoreFn = (index) => cosine(questionVector, tfidfVector(docs[index], vocabulary, df));
  }

  const scored = observations
    .map((observation, index) => ({
      observation,
      score: Number(scoreFn(index).toFixed(4)),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return {
    observations: scored,
    observationCount: observations.length,
    clusters,
    insights,
  };
}

function formatEvidenceForPrompt(evidence) {
  return evidence.observations.map((item, index) => {
    const type = effectiveObsType(item.observation);
    const text = observationContent(item.observation);
    return `${index + 1}. [${type}] ${text}`;
  }).join('\n');
}

function fallbackAnswer(question, evidence) {
  if (!evidence.observations.length) {
    return 'No matching evidence was found in this lecture. Ask the faculty for clarification.';
  }

  const top = evidence.observations[0];
  const topText = observationContent(top.observation);
  const types = [...new Set(evidence.observations.map((item) => effectiveObsType(item.observation)))];
  const typeText = types.map((type) => type.toLowerCase()).join(', ');

  if (evidence.observations.length === 1) {
    return `Based on one matching ${typeText} observation, the strongest related lecture evidence says: "${topText}".`;
  }

  const bullets = evidence.observations
    .slice(0, 3)
    .map((item) => `- ${observationContent(item.observation)}`)
    .join('\n');

  return `Based on ${evidence.observations.length} matching observations (${typeText}), the most relevant lecture evidence is:\n${bullets}`;
}

async function generateAnswer(question, evidence, options = {}) {
  if (options.preferCloud && hasCloudLlm()) {
    try {
      const cloud = await generateCloudAnswer(question, evidence, options.cloud || {});
      return { ...cloud, evidenceIdCount: evidence.observations.length };
    } catch (err) {
      // Continue to local generation, then evidence fallback.
    }
  }

  const enabled = options.enabled
    ?? (process.env.AI_ENABLED === 'true' && process.env.LLM_ENABLED !== 'false');

  if (!enabled) {
    return { answer: fallbackAnswer(question, evidence), provider: 'evidence-fallback' };
  }

  const modelName = options.model || process.env.AI_ANSWER_MODEL || 'Xenova/flan-t5-small';

  try {
    const generator = await getGenerator(modelName);
    if (!generator) {
      return { answer: fallbackAnswer(question, evidence), provider: 'evidence-fallback' };
    }

    const context = formatEvidenceForPrompt(evidence);
    const prompt = [
      'You are a lecture assistant.',
      'Answer the student question using only the numbered evidence.',
      'Do not invent facts. If evidence is insufficient, say that the lecture evidence is insufficient.',
      '',
      'Evidence:',
      context || '(none)',
      '',
      `Student question: ${question}`,
      'Answer:',
    ].join('\n');

    const output = await generator(prompt, {
      max_new_tokens: Number(options.maxTokens || 180),
      do_sample: false,
    });

    const generated = Array.isArray(output) ? output[0]?.generated_text : output?.generated_text;
    const answer = String(generated || '').trim();
    if (!answer) throw new Error('Empty generation result');

    return {
      answer,
      provider: 'local-transformers',
      model: modelName,
    };
  } catch (err) {
    return {
      answer: fallbackAnswer(question, evidence),
      provider: 'evidence-fallback',
      generationError: String(err && err.message),
    };
  }
}

module.exports = {
  retrieveEvidence,
  generateAnswer,
  fallbackAnswer,
  effectiveObsType,
};
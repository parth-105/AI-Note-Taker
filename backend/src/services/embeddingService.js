const path = require('path');

let transformersModule = null;
const pipelineCache = new Map();

async function loadTransformers() {
  if (transformersModule) return transformersModule;
  try {
    transformersModule = require('@huggingface/transformers');
    if (transformersModule.env) {
      transformersModule.env.cacheDir = process.env.HF_CACHE_DIR
        || path.resolve(__dirname, '../../.cache/huggingface');
    }
    return transformersModule;
  } catch (err) {
    transformersModule = null;
    return null;
  }
}

function hasTransformers() {
  return Boolean(transformersModule);
}

async function getExtractor(modelName) {
  if (pipelineCache.has(modelName)) return pipelineCache.get(modelName);
  const transformers = await loadTransformers();
  if (!transformers) return null;
  const extractor = await transformers.pipeline('feature-extraction', modelName);
  pipelineCache.set(modelName, extractor);
  return extractor;
}

async function embedTexts(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const modelName = options.model || 'Xenova/all-MiniLM-L6-v2';
  const extractor = await getExtractor(modelName);
  if (!extractor) return null; // caller falls back to TF-IDF

  const output = await extractor(texts, {
    pooling: 'mean',
    normalize: true,
  });

  if (typeof output.tolist === 'function') {
    return output.tolist();
  }

  const dims = output.dims || [];
  const batchSize = dims[0] || texts.length;
  const vectorSize = dims[dims.length - 1] || 0;
  if (!vectorSize || !output.data) return null;

  const vectors = [];
  for (let i = 0; i < batchSize; i += 1) {
    vectors.push(Array.from(output.data.slice(i * vectorSize, (i + 1) * vectorSize)));
  }
  return vectors;
}

module.exports = {
  embedTexts,
  hasTransformers,
  getExtractor,
};
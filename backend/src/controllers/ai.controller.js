const config = require('../config');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');
const { retrieveEvidence, generateAnswer, effectiveObsType } = require('../services/answerService');

exports.query = asyncHandler(async (req, res) => {
  if (process.env.AI_ENABLED !== undefined) {
    config.aiEnabled = process.env.AI_ENABLED === 'true';
  }

  if (!config.aiEnabled) {
    throw new ApiError(503, 'AI is disabled. Set AI_ENABLED=true to use RAG answers.');
  }

  const { lectureId, question } = req.body || {};
  if (!lectureId) throw new ApiError(400, 'lectureId is required');
  if (!question) throw new ApiError(400, 'question is required');

  const evidence = await retrieveEvidence(lectureId, question);
  const generated = await generateAnswer(question, evidence, {
    enabled: config.aiEnabled && process.env.LLM_ENABLED !== 'false',
    preferCloud: process.env.LLM_PROVIDER === 'cloud',
    cloud: {
      maxTokens: process.env.CLOUD_LLM_MAX_TOKENS,
      temperature: process.env.CLOUD_LLM_TEMPERATURE,
    },
  });

  res.json({
    answer: generated.answer,
    provider: generated.provider,
    model: generated.model,
    generationError: generated.generationError,
    evidence: {
      lectureId,
      question,
      observations: evidence.observations.map(({ observation, score }) => ({
        _id: observation._id,
        type: observation.type,
        effectiveType: effectiveObsType(observation),
        text: observation.text,
        ocrText: observation.ocrText,
        clusterRef: observation.clusterRef,
        elapsedSec: observation.elapsedSec,
        score,
      })),
      observationCount: evidence.observationCount,
      clusters: evidence.clusters,
      insights: evidence.insights,
    },
  });
});
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function cloudLlmConfig() {
  return {
    provider: process.env.CLOUD_LLM_PROVIDER || 'openai-compatible',
    apiKey: process.env.CLOUD_LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl: (process.env.CLOUD_LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.CLOUD_LLM_MODEL || 'gpt-4o-mini',
    timeoutMs: Number(process.env.CLOUD_LLM_TIMEOUT_MS || 30000),
  };
}

function hasCloudLlm() {
  return Boolean(cloudLlmConfig().apiKey);
}

async function generateCloudAnswer(question, evidence, options = {}) {
  const config = cloudLlmConfig();
  if (!config.apiKey) {
    throw new Error('Cloud LLM API key is not configured');
  }

  const evidenceLines = evidence.observations.map((item, index) => {
    const type = item.observation.effectiveType
      || (item.observation.classification?.type ?? item.observation.type);
    const text = `${item.observation.text || ''} ${item.observation.ocrText || ''}`.trim();
    return `${index + 1}. [${type}] ${text}`;
  }).join('\n');

  const insightLines = evidence.insights.map((insight) => `- ${insight.title}: ${insight.description}`);
  const prompt = [
    'You are a lecture assistant.',
    'Answer the student question using only the provided lecture evidence.',
    'Do not invent facts.',
    'If the evidence is insufficient, clearly say that the lecture evidence is insufficient.',
    'Be concise and reference the supplied evidence naturally when helpful.',
    '',
    'Lecture evidence:',
    evidenceLines || '(none)',
    '',
    insightLines.length ? 'Related insights:' : '',
    insightLines.join('\n'),
    '',
    `Student question: ${question}`,
    'Answer:',
  ].filter((line) => line !== '').join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: Number(options.temperature ?? 0.2),
        max_tokens: Number(options.maxTokens || 300),
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || `Cloud LLM request failed with status ${response.status}`;
      throw new Error(message);
    }

    const answer = payload?.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error('Cloud LLM returned an empty answer');

    return {
      answer,
      provider: config.provider,
      cloudProvider: 'openai-compatible',
      model: options.model || config.model,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  cloudLlmConfig,
  hasCloudLlm,
  generateCloudAnswer,
};
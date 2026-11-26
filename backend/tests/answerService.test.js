import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateAnswer } from '../src/services/answerService.js';

describe('answerService', () => {
  const evidence = {
    observations: [
      {
        observation: {
          type: 'NOTE',
          classification: { type: 'CONFUSION' },
          text: 'BCNF decomposition is unclear.',
          ocrText: '',
        },
        score: 0.92,
      },
    ],
    insights: [],
  };

  beforeEach(() => {
    delete process.env.AI_ENABLED;
    delete process.env.LLM_PROVIDER;
    delete process.env.CLOUD_LLM_API_KEY;
    delete process.env.CLOUD_LLM_BASE_URL;
  });

  afterEach(() => {
    delete process.env.AI_ENABLED;
    delete process.env.LLM_PROVIDER;
    delete process.env.CLOUD_LLM_API_KEY;
    delete process.env.CLOUD_LLM_BASE_URL;
  });

  it('uses evidence-grounded fallback when no AI is enabled', async () => {
    const result = await generateAnswer('What is unclear?', evidence, { enabled: false });
    expect(result.provider).toBe('evidence-fallback');
    expect(result.answer).toContain('BCNF decomposition is unclear.');
  });

  it('uses cloud LLM when cloud provider is preferred and succeeds', async () => {
    process.env.LLM_PROVIDER = 'cloud';
    process.env.CLOUD_LLM_API_KEY = 'test-key';
    process.env.CLOUD_LLM_BASE_URL = 'https://mock.invalid/v1';

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'The lecture evidence says BCNF decomposition is unclear.',
            },
          },
        ],
      }),
    });

    try {
      const result = await generateAnswer('What is unclear?', evidence, {
        enabled: true,
        preferCloud: true,
      });
      expect(result.provider).toBe('openai-compatible');
      expect(result.answer).toContain('BCNF decomposition is unclear.');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('falls back safely when cloud LLM fails', async () => {
    process.env.LLM_PROVIDER = 'cloud';
    process.env.CLOUD_LLM_API_KEY = 'test-key';
    process.env.CLOUD_LLM_BASE_URL = 'https://mock.invalid/v1';

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'mock cloud failure' } }),
    });

    try {
      const result = await generateAnswer('What is unclear?', evidence, {
        enabled: true,
        preferCloud: true,
      });
      expect(result.provider).toBe('evidence-fallback');
      expect(result.answer).toContain('BCNF decomposition is unclear.');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
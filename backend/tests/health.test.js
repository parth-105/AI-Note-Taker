import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('app smoke test', () => {
  it('serves /health', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('404s unknown api route', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body.message).toContain('Not found');
  });
});
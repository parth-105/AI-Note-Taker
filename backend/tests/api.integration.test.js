import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

async function registerUser(role, suffix = role.toLowerCase()) {
  const res = await request(app).post('/api/auth/register').send({
    name: `${role} User`,
    email: `${suffix}@test.com`,
    password: 'password123',
    role,
  });
  expect(res.status).toBe(201);
  return res.body;
}

async function createActiveLecture(faculty, title = 'Database Normalization') {
  const created = await request(app)
    .post('/api/lectures')
    .set('Authorization', `Bearer ${faculty.token}`)
    .send({ title, subject: 'DBMS', topic: 'BCNF' });
  expect(created.status).toBe(201);
  const lecture = created.body.lecture;
  const started = await request(app)
    .post(`/api/lectures/${lecture._id}/start`)
    .set('Authorization', `Bearer ${faculty.token}`);
  expect(started.status).toBe(200);
  return lecture;
}

async function joinAndObserve(student, lecture, payload) {
  const joined = await request(app)
    .post('/api/lectures/join')
    .set('Authorization', `Bearer ${student.token}`)
    .send({ code: lecture.sessionCode });
  expect(joined.status).toBe(200);

  const obs = await request(app)
    .post('/api/observations')
    .set('Authorization', `Bearer ${student.token}`)
    .send({ lectureId: lecture._id, ...payload });
  expect(obs.status).toBe(201);
  return obs.body;
}

async function addObservation(student, lecture, payload, expectedStatus = 201) {
  const obs = await request(app)
    .post('/api/observations')
    .set('Authorization', `Bearer ${student.token}`)
    .send({ lectureId: lecture._id, ...payload });
  expect(obs.status).toBe(expectedStatus);
  return obs.body;
}

describe('API integration', () => {
  beforeEach(async () => {
    const { collections } = require('mongoose').connection;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  it('register, login, and me', async () => {
    const user = await registerUser('STUDENT');
    expect(user.user.role).toBe('STUDENT');
    const login = await request(app).post('/api/auth/login').send({
      email: 'student@test.com',
      password: 'password123',
    });
    expect(login.status).toBe(200);
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
  });

  it('faculty can create and start a lecture; student joins and posts observation', async () => {
    const faculty = await registerUser('FACULTY');
    const student = await registerUser('STUDENT');

    const created = await request(app)
      .post('/api/lectures')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ title: 'Database Normalization', subject: 'DBMS', topic: 'BCNF' });
    expect(created.status).toBe(201);
    const lecture = created.body.lecture;
    expect(lecture.sessionCode).toMatch(/CLI-/);

    const started = await request(app)
      .post(`/api/lectures/${lecture._id}/start`)
      .set('Authorization', `Bearer ${faculty.token}`);
    expect(started.status).toBe(200);
    expect(started.body.lecture.status).toBe('ACTIVE');

    const joined = await request(app)
      .post('/api/lectures/join')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ code: lecture.sessionCode });
    expect(joined.status).toBe(200);

    const obs = await request(app)
      .post('/api/observations')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ lectureId: lecture._id, type: 'CONFUSION', text: 'BCNF is confusing', elapsedSec: 120 });
    expect(obs.status).toBe(201);
    expect(obs.body.observation.type).toBe('CONFUSION');

    const list = await request(app)
      .get(`/api/observations/lectures/${lecture._id}`)
      .set('Authorization', `Bearer ${faculty.token}`);
    expect(list.status).toBe(200);
    expect(list.body.observations).toHaveLength(1);
  });

  it('clusters repeated questions and creates insight', async () => {
    const faculty = await registerUser('FACULTY');
    const created = await request(app)
      .post('/api/lectures')
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({ title: 'Indexes', subject: 'DBMS', topic: 'B-trees' });
    const lecture = created.body.lecture;
    await request(app).post(`/api/lectures/${lecture._id}/start`).set('Authorization', `Bearer ${faculty.token}`);

    for (let i = 1; i <= 3; i += 1) {
      const student = await registerUser('STUDENT', `q${i}`);
      const join = await request(app)
        .post('/api/lectures/join')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ code: lecture.sessionCode });
      expect(join.status).toBe(200);
      const obs = await request(app)
        .post('/api/observations')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ lectureId: lecture._id, type: 'QUESTION', text: 'How do B-tree indexes work?', elapsedSec: i * 10 });
      expect(obs.status).toBe(201);
    }

    const clusters = await request(app)
      .get(`/api/clusters/${lecture._id}/clusters`)
      .set('Authorization', `Bearer ${faculty.token}`);
    expect(clusters.status).toBe(200);
    expect(clusters.body.clusters).toHaveLength(1);
    expect(clusters.body.clusters[0].participantCount).toBe(3);

    const insights = await request(app)
      .get(`/api/clusters/${lecture._id}/insights`)
      .set('Authorization', `Bearer ${faculty.token}`);
    expect(insights.status).toBe(200);
    expect(insights.body.insights).toHaveLength(1);
    expect(insights.body.insights[0].type).toBe('REPEATED_QUESTION');
    expect(insights.body.insights[0].evidence.observationIds).toHaveLength(3);
  });

  it('marks semantic duplicate from same student and preserves original', async () => {
    const faculty = await registerUser('FACULTY', 'dup-faculty');
    const student = await registerUser('STUDENT', 'dup-student');
    const lecture = await createActiveLecture(faculty, 'Semantic Duplicate');

    const first = await joinAndObserve(student, lecture, {
      type: 'CONFUSION',
      text: 'I do not understand BCNF decomposition.',
      elapsedSec: 30,
    });
    expect(first.observation.effectiveType).toBe('CONFUSION');

    const second = await addObservation(student, lecture, {
      type: 'NOTE',
      text: 'I do not understand BCNF decomposition!',
      elapsedSec: 35,
    });

    expect(second.observation.type).toBe('NOTE');
    expect(second.observation.isDuplicate).toBe(true);
    expect(String(second.observation.duplicateOf)).toBe(String(first.observation._id));
  });

  it('classifies free-form note as confusion and uses it for insights', async () => {
    const faculty = await registerUser('FACULTY', 'class-faculty');
    const lecture = await createActiveLecture(faculty, 'Free-form Confusion');

    for (let i = 1; i <= 5; i += 1) {
      const student = await registerUser('STUDENT', `confuse-${i}`);
      const result = await joinAndObserve(student, lecture, {
        type: 'NOTE',
        text: 'I am confused by indexing.',
        elapsedSec: i * 20,
      });
      expect(result.observation.type).toBe('NOTE');
      expect(result.observation.effectiveType).toBe('CONFUSION');
    }

    const insights = await request(app)
      .get(`/api/clusters/${lecture._id}/insights`)
      .set('Authorization', `Bearer ${faculty.token}`);
    expect(insights.status).toBe(200);
    expect(insights.body.insights).toHaveLength(1);
    expect(insights.body.insights[0].type).toBe('CONFUSION_SPIKE');
    expect(insights.body.insights[0].evidence.observationIds).toHaveLength(5);
  });

  it('returns lecture-scoped evidence answer without LLM', async () => {
    const faculty = await registerUser('FACULTY', 'ai-faculty');
    const student = await registerUser('STUDENT', 'ai-student');
    const lecture = await createActiveLecture(faculty, 'AI Evidence');

    const result = await joinAndObserve(student, lecture, {
      type: 'CONFUSION',
      text: 'BCNF isolation levels are unclear.',
      elapsedSec: 20,
    });
    expect(result.observation.effectiveType).toBe('CONFUSION');

    process.env.AI_ENABLED = 'true';
    process.env.LLM_ENABLED = 'false';

    const ai = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ lectureId: lecture._id, question: 'What is unclear about BCNF?' });

    delete process.env.AI_ENABLED;
    delete process.env.LLM_ENABLED;

    expect(ai.status).toBe(200);
    expect(ai.body.provider).toBe('evidence-fallback');
    expect(ai.body.answer).toContain('lecture evidence');
    expect(ai.body.evidence.observations).toHaveLength(1);
    expect(ai.body.evidence.observations[0].effectiveType).toBe('CONFUSION');
  });
});
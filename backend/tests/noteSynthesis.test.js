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

async function createActiveLecture(faculty, title = 'Collective Notes') {
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

async function observe(student, lecture, payload) {
  const joined = await request(app)
    .post('/api/lectures/join')
    .set('Authorization', `Bearer ${student.token}`)
    .send({ code: lecture.sessionCode });
  expect(joined.status).toBe(200);

  const result = await request(app)
    .post('/api/observations')
    .set('Authorization', `Bearer ${student.token}`)
    .send({ lectureId: lecture._id, ...payload });
  expect(result.status).toBe(201);
  return result.body.observation;
}

describe('note synthesis and evidence profile', () => {
  beforeEach(async () => {
    const { collections } = require('mongoose').connection;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
    process.env.AI_ENABLED = 'false';
    process.env.NOTE_SYNTHESIS_ENABLED = 'false';
  });

  it('creates safe collective note from clustered observations', async () => {
    const faculty = await registerUser('FACULTY', 'synth-faculty');
    const lecture = await createActiveLecture(faculty);

    for (let i = 1; i <= 5; i += 1) {
      const student = await registerUser('STUDENT', `synth-${i}`);
      await observe(student, lecture, {
        type: 'NOTE',
        text: 'I am confused by BCNF decomposition.',
        elapsedSec: i * 10,
      });
    }

    const response = await request(app)
      .post(`/api/students/${lecture._id}/synthesize`)
      .set('Authorization', `Bearer ${faculty.token}`)
      .send({});

    expect(response.status).toBe(201);
    expect(response.body.note.title).toContain('Collective class note');
    expect(response.body.note.summary).toContain('BCNF decomposition');
    expect(response.body.note.sections.confusionPoints.length).toBeGreaterThan(0);
    expect(response.body.note.evidenceClusters).toHaveLength(1);

    const confusionEvidence = response.body.note.sections.confusionPoints[0];
    expect(confusionEvidence).toContain('Several students reported confusion');
    expect(confusionEvidence).not.toContain('did not understand');
  });

  it('returns evidence profile without claiming understanding', async () => {
    const faculty = await registerUser('FACULTY', 'profile-faculty');
    const student = await registerUser('STUDENT', 'profile-student');
    const lecture = await createActiveLecture(faculty);

    await observe(student, lecture, {
      type: 'NOTE',
      text: 'I am confused by indexes.',
      elapsedSec: 15,
    });

    const response = await request(app)
      .get(`/api/students/me/learning-gaps?lectureId=${lecture._id}`)
      .set('Authorization', `Bearer ${student.token}`);

    expect(response.status).toBe(200);
    expect(response.body.evidenceProfile.topicsReportedConfusing).toHaveLength(1);
    expect(response.body.evidenceProfile.understandingClaim).toBe('not-assessed');
    expect(response.body.evidenceProfile.policy).toContain('Notes do not prove understanding');
  });
});
# Collective Lecture Intelligence — Backend

Node.js + Express + Socket.IO + MongoDB Atlas API.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Default: `http://localhost:4000`.

## Environment

Copy `.env.example` to `.env` and set:

- `MONGODB_URI` — MongoDB connection string (local or Atlas)
- `JWT_SECRET` — long random string
- `AI_ENABLED` — `true` enables the `/api/ai/query` endpoint stub

## Scripts

```bash
npm test            # Vitest + Supertest (uses mongodb-memory-server)
npm run lint        # ESLint (once configured/installed)
node scripts/seed-demo-data.js
node scripts/simulate-students.js
```

## API overview

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/google
GET    /api/auth/me

POST   /api/lectures                     # faculty
GET    /api/lectures
GET    /api/lectures/:id
POST   /api/lectures/:id/start           # faculty
POST   /api/lectures/:id/end             # faculty
POST   /api/lectures/join                # student by session code
GET    /api/lectures/:id/participants

POST   /api/lectures/:id/materials       # faculty upload PDF/PPTX
GET    /api/lectures/:id/materials

POST   /api/observations                 # JSON or multipart (image)
GET    /api/observations/lectures/:id

GET    /api/clusters/:id/clusters
GET    /api/clusters/:id/insights
GET    /api/students/:me/learning-gaps
POST   /api/ai/query
```

## Notes

- Only `ACTIVE` lectures accept observations.
- Observations carry `elapsedSec` (seconds since lecture start).
- `idempotencyKey` on observation create protects against duplicate retries.
- Socket room: `room:<lectureId>`. Events: `lecture:started`, `lecture:ended`, `student:joined`, `observation:new`, `cluster:updated`, `insight:new`, `faculty:counts`, `participant:ping`.

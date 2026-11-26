/* Demo seed: create faculty + students + an open lecture.
 * Usage: node scripts/seed-demo-data.js
 */
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../src/models/user.model');
const Lecture = require('../src/models/lecture.model');
const { generateSessionCode } = require('../src/utils/sessionCode');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collective_lecture';
  await mongoose.connect(uri);

  const pw = await bcrypt.hash('password123', 10);
  const faculty = await User.create({
    name: 'Dr. Demo',
    email: 'faculty@demo.com',
    passwordHash: pw,
    role: 'FACULTY',
  });

  const students = [];
  for (let i = 1; i <= 5; i += 1) {
    students.push(await User.create({
      name: `Student ${i}`,
      email: `student${i}@demo.com`,
      passwordHash: pw,
      role: 'STUDENT',
    }));
  }

  const lecture = await Lecture.create({
    title: 'Database Normalization',
    subject: 'DBMS',
    topic: 'BCNF',
    description: 'Demo lecture',
    facultyId: faculty._id,
    sessionCode: generateSessionCode(),
    status: 'ACTIVE',
    startTime: new Date(),
  });

  console.log('Seeded demo data');
  console.log({ faculty: faculty.email, students: students.map((s) => s.email), lectureId: lecture._id, sessionCode: lecture.sessionCode });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

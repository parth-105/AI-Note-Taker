const mongoose = require('mongoose');

async function connectDb(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, poolSize: 10 });
  console.log('[db] connected');
}

module.exports = { connectDb };

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    googleId: { type: String, default: '' },
    passwordHash: { type: String, default: '' },
    role: { type: String, enum: ['STUDENT', 'FACULTY'], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

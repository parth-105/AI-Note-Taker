const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const config = require('../config');
const User = require('../models/user.model');
const { ApiError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../utils/asyncHandler');

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(['STUDENT', 'FACULTY']),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = registerSchema.parse(req.body);
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, 'Email already registered');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role });
  res.status(201).json({
    token: signToken(user),
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(401, 'Invalid credentials');
  if (!user.passwordHash) throw new ApiError(401, 'Use Google sign-in');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, 'Invalid credentials');
  res.json({
    token: signToken(user),
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

exports.google = asyncHandler(async (req, res) => {
  // Placeholder: replace with verified Google token exchange.
  // Email, name, and role are illustrative only.
  const { email, name, role, googleId } = req.body || {};
  if (!email || !googleId) throw new ApiError(400, 'googleId and email are required');
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ name: name || email.split('@')[0], email, googleId: googleId || '', role: role || 'STUDENT' });
  }
  res.json({
    token: signToken(user),
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.sub);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

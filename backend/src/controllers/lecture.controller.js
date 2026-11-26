const { z } = require('zod');
const Lecture = require('../models/lecture.model');
const Participant = require('../models/participant.model');
const { ApiError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../utils/asyncHandler');
const { generateSessionCode } = require('../utils/sessionCode');
const { getIo } = require('../services/socketService');

const createSchema = z.object({
  title: z.string().min(1).max(120),
  subject: z.string().max(80).optional().default(''),
  topic: z.string().max(120).optional().default(''),
  description: z.string().max(1000).optional().default(''),
  allowImages: z.boolean().optional(),
  allowText: z.boolean().optional(),
});

const joinSchema = z.object({ code: z.string().min(1).max(30) });

exports.create = asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  let sessionCode = generateSessionCode();
  while (await Lecture.findOne({ sessionCode })) sessionCode = generateSessionCode();
  const lecture = await Lecture.create({ ...data, facultyId: req.user.sub, sessionCode, status: 'DRAFT' });
  res.status(201).json({ lecture });
});

exports.list = asyncHandler(async (req, res) => {
  const isFaculty = req.user.role === 'FACULTY';
  const query = isFaculty ? { facultyId: req.user.sub } : {};
  const lectures = await Lecture.find(query).sort({ createdAt: -1 }).limit(100);
  res.json({ lectures });
});

exports.get = asyncHandler(async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) throw new ApiError(404, 'Lecture not found');
  res.json({ lecture });
});

exports.start = asyncHandler(async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture || lecture.facultyId.toString() !== req.user.sub) throw new ApiError(404, 'Lecture not found');
  if (lecture.status !== 'DRAFT') throw new ApiError(409, 'Only DRAFT lectures can be started');
  lecture.status = 'ACTIVE';
  lecture.startTime = new Date();
  await lecture.save();
  getIo().to(`room:${lecture._id}`).emit('lecture:started', { lectureId: lecture._id });
  res.json({ lecture });
});

exports.end = asyncHandler(async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture || lecture.facultyId.toString() !== req.user.sub) throw new ApiError(404, 'Lecture not found');
  if (lecture.status !== 'ACTIVE') throw new ApiError(409, 'Only ACTIVE lectures can be ended');
  lecture.status = 'ENDED';
  lecture.endTime = new Date();
  await lecture.save();
  getIo().to(`room:${lecture._id}`).emit('lecture:ended', { lectureId: lecture._id });
  res.json({ lecture });
});

exports.join = asyncHandler(async (req, res) => {
  const { code } = joinSchema.parse(req.body);
  const lecture = await Lecture.findOne({ sessionCode: code.toUpperCase() });
  if (!lecture) throw new ApiError(404, 'Lecture not found');
  if (lecture.status !== 'ACTIVE') throw new ApiError(409, 'Lecture is not active');
  await Participant.findOneAndUpdate(
    { lectureId: lecture._id, studentId: req.user.sub },
    { joinedAt: new Date(), lastActiveAt: new Date() },
    { upsert: true, new: true }
  );
  await Lecture.updateOne({ _id: lecture._id }, { $inc: { studentCount: 1 } });
  getIo().to(`room:${lecture._id}`).emit('student:joined', { lectureId: lecture._id, studentId: req.user.sub });
  res.json({ lecture });
});

exports.participants = asyncHandler(async (req, res) => {
  const participants = await Participant.find({ lectureId: req.params.id }).populate('studentId', 'name email');
  res.json({ participants });
});

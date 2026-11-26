const { z } = require('zod');
const Observation = require('../models/observation.model');
const Lecture = require('../models/lecture.model');
const { ApiError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../utils/asyncHandler');
const { getIo } = require('../services/socketService');
const { syncObservationClusters } = require('../services/clusterService');
const { persistInsights } = require('../services/insightService');
const { markDuplicates } = require('../services/duplicateService');
const { classifyText } = require('../services/classificationService');
const { storeImage } = require('../services/imageStorage');
const { extractTextFromImage } = require('../services/ocrService');

const createSchema = z.object({
  lectureId: z.string().min(1),
  type: z.enum(['IMPORTANT', 'QUESTION', 'CONFUSION', 'EXAMPLE', 'NOTE', 'IMAGE']).optional(),
  text: z.string().max(500).default(''),
  elapsedSec: z.number().min(0).max(86400).optional(),
  idempotencyKey: z.string().max(100).optional(),
});

exports.create = asyncHandler(async (req, res) => {
  let payload;
  let image = null;
  let ocrResult = null;
  let classification = null;

  if (req.file) {
    payload = {
      lectureId: req.body.lectureId,
      type: req.body.type || 'IMAGE',
      text: req.body.text || '',
      elapsedSec: Number(req.body.elapsedSec || 0),
      idempotencyKey: req.body.idempotencyKey,
    };
    createSchema.parse(payload);
    ocrResult = await extractTextFromImage(req.file);
    image = await storeImage(req.file);
    classification = classifyText(payload.text, ocrResult.text);
  } else {
    payload = createSchema.parse(req.body);
    classification = classifyText(payload.text);
  }

  const lecture = await Lecture.findById(payload.lectureId);
  if (!lecture) throw new ApiError(404, 'Lecture not found');
  if (lecture.status !== 'ACTIVE') throw new ApiError(409, 'Lecture is not active');
  if (payload.idempotencyKey) {
    const existing = await Observation.findOne({
      lectureId: lecture._id,
      studentId: req.user.sub,
      idempotencyKey: payload.idempotencyKey,
    });
    if (existing) return res.json({ observation: existing, duplicate: true });
  }

  const observation = await Observation.create({
    lectureId: lecture._id,
    studentId: req.user.sub,
    type: image ? 'IMAGE' : payload.type,
    text: payload.text,
    image: image ? { ...image, type: req.file.mimetype, mime: req.file.mimetype, ocrStatus: ocrResult.status } : undefined,
    ocrText: image ? ocrResult.text : '',
    classification: classification ? { ...classification, classifiedAt: new Date() } : undefined,
    elapsedSec: payload.elapsedSec || 0,
    idempotencyKey: payload.idempotencyKey || undefined,
  });

  await Lecture.updateOne(
    { _id: lecture._id },
    {
      $inc: {
        'statistics.totalObservations': 1,
        [`statistics.observationTypeCounts.${observation.type}`]: 1,
      },
    }
  );

  const { observations: allObservations } = await markDuplicates([
    ...(await Observation.find({ lectureId: lecture._id }).sort({ createdAt: 1 })),
  ]);

  const refreshedObservation = await Observation.findById(observation._id);
  const clusters = await syncObservationClusters(lecture._id);
  const insights = await persistInsights(lecture._id);

  getIo().to(`room:${lecture._id}`).emit('observation:new', { observation });
  getIo().to(`room:${lecture._id}`).emit('clusters:updated', { clusters });
  getIo().to(`room:${lecture._id}`).emit('insights:updated', { insights });

  res.status(201).json({ observation: refreshedObservation, clusters, insights });
});

exports.listForLecture = asyncHandler(async (req, res) => {
  const observations = await Observation.find({ lectureId: req.params.id }).sort({ createdAt: 1 });
  res.json({ observations });
});
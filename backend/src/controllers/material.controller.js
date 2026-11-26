const Lecture = require('../models/lecture.model');
const LectureMaterial = require('../models/lectureMaterial.model');
const { storeMaterial } = require('../services/imageStorage');
const { extractMaterial } = require('../services/materialExtractor');
const { ApiError } = require('../middleware/errorHandler');
const { asyncHandler } = require('../utils/asyncHandler');

exports.upload = asyncHandler(async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture || lecture.facultyId.toString() !== req.user.sub) {
    throw new ApiError(404, 'Lecture not found');
  }
  if (!req.file) throw new ApiError(400, 'File required');

  const stored = await storeMaterial(req.file);
  const material = await LectureMaterial.create({
    lectureId: lecture._id,
    uploaderId: req.user.sub,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mime: req.file.mimetype,
    sizeBytes: stored.sizeBytes,
    storageUrl: stored.url,
    format: /\.pdf$/i.test(req.file.originalname) ? 'pdf' : 'pptx',
  });

  // Extraction happens async where possible.
  const fs = require('fs');
  const path = require('path');
  const buf = fs.readFileSync(path.join(__dirname, '../../uploads', path.basename(stored.url)));
  const extraction = await extractMaterial(req.file.originalname, buf);
  material.extraction = extraction;
  await material.save();

  res.status(201).json({ material });
});

exports.list = asyncHandler(async (req, res) => {
  const materials = await LectureMaterial.find({ lectureId: req.params.id }).sort({ createdAt: -1 });
  res.json({ materials });
});

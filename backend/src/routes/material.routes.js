const router = require('express').Router();
const multer = require('multer');
const material = require('../controllers/material.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const upload = multer({ dest: 'uploads/', limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticate);

router.post('/:id/materials', requireRole('FACULTY'), upload.single('file'), material.upload);
router.get('/:id/materials', material.list);

module.exports = router;

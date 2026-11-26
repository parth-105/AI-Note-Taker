const router = require('express').Router();
const multer = require('multer');
const observation = require('../controllers/observation.controller');
const { authenticate } = require('../middleware/auth');
const { observationLimiter } = require('../middleware/rateLimit');

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

router.use(authenticate);

router.post('/', observationLimiter, upload.single('image'), observation.create);
router.get('/lectures/:id', observation.listForLecture);

module.exports = router;
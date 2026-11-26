const router = require('express').Router();
const learningGap = require('../controllers/learningGap.controller');
const { authenticate } = require('../middleware/auth');

router.get('/:id/learning-gaps', authenticate, learningGap.gaps);

module.exports = router;

const router = require('express').Router();
const ai = require('../controllers/ai.controller');
const { authenticate } = require('../middleware/auth');

router.post('/query', authenticate, ai.query);

module.exports = router;

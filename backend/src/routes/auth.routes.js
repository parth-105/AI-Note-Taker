const router = require('express').Router();
const auth = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

router.post('/register', auth.register);
router.post('/login', loginLimiter, auth.login);
router.post('/google', auth.google);
router.get('/me', authenticate, auth.me);

module.exports = router;

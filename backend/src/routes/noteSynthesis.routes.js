const router = require('express').Router();
const controller = require('../controllers/noteSynthesis.controller');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.post('/:id/synthesize', requireRole('FACULTY'), controller.synthesize);
router.get('/:id', controller.list);

module.exports = router;
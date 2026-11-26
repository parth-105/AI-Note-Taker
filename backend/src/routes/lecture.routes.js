const router = require('express').Router();
const lecture = require('../controllers/lecture.controller');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.post('/', requireRole('FACULTY'), lecture.create);
router.get('/', lecture.list);
router.get('/:id', lecture.get);
router.post('/:id/start', requireRole('FACULTY'), lecture.start);
router.post('/:id/end', requireRole('FACULTY'), lecture.end);
router.post('/join', lecture.join);
router.get('/:id/participants', lecture.participants);

module.exports = router;

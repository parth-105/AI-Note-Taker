const router = require('express').Router();
const authRoutes = require('./auth.routes');
const lectureRoutes = require('./lecture.routes');
const observationRoutes = require('./observation.routes');
const clusterRoutes = require('./cluster.routes');
const materialRoutes = require('./material.routes');
const aiRoutes = require('./ai.routes');
const learningGapRoutes = require('./learningGap.routes');
const noteSynthesisRoutes = require('./noteSynthesis.routes');

router.get('/ping', (req, res) => res.json({ pong: true }));
router.use('/auth', authRoutes);
router.use('/lectures', lectureRoutes);
router.use('/lectures', materialRoutes);
router.use('/observations', observationRoutes);
router.use('/clusters', clusterRoutes);
router.use('/ai', aiRoutes);
router.use('/students', learningGapRoutes);
router.use('/students', noteSynthesisRoutes);

module.exports = router;

const router = require('express').Router();
const cluster = require('../controllers/cluster.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/:id/clusters', cluster.clusters);
router.get('/:id/insights', cluster.insights);

module.exports = router;

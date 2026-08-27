const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const recordRoutes = require('./record-routes');
const workflowRoutes = require('./workflow-routes');

const router = express.Router();

router.use(requireAuth);
router.use(recordRoutes);
router.use(workflowRoutes);

module.exports = router;

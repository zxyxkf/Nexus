const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const recordRoutes = require('./record-routes');

const router = express.Router();

router.use(requireAuth);
router.use(recordRoutes);

module.exports = router;

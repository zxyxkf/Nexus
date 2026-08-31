const express = require('express');
const recordRoutes = require('./record-routes');
const workflowRoutes = require('./workflow-routes');
const imageRoutes = require('./image-routes');
const openRoutes = require('./open-routes');
const categoryRoutes = require('./category-routes');
const promotionRoutes = require('./promotion-routes');

const router = express.Router();

router.use(imageRoutes);
router.use(recordRoutes);
router.use(workflowRoutes);
router.use(openRoutes);
router.use(categoryRoutes);
router.use(promotionRoutes);

module.exports = router;

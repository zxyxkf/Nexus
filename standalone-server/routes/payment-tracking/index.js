const express = require('express');
const recordRoutes = require('./record-routes');
const workflowRoutes = require('./workflow-routes');
const imageRoutes = require('./image-routes');
const openRoutes = require('./open-routes');
const categoryRoutes = require('./category-routes');
const promotionRoutes = require('./promotion-routes');
const linkStatusRoutes = require('./link-status-routes');
const managerReviewRoutes = require('./manager-review-routes');

const router = express.Router();

router.use(imageRoutes);
router.use(recordRoutes);
router.use(workflowRoutes);
router.use(openRoutes);
router.use(categoryRoutes);
router.use(promotionRoutes);
router.use(linkStatusRoutes);
router.use(managerReviewRoutes);

module.exports = router;

// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validateId } = require('../middleware/validation');

const paymentController = require('../controllers/paymentController');

// Public webhook endpoint
router.post('/webhook', paymentController.handleWebhook);

// Protected payment routes
router.use(protect);
router.post('/initialize/:orderId', validateId, paymentController.initializePayment);
router.get('/verify/:reference', paymentController.verifyPayment);

module.exports = router;
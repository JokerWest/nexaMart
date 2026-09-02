// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const { validateOrder, validateId, validatePagination } = require('../middleware/validation');

const orderController = require('../controllers/orderController');

// All order routes are protected
router.use(protect);

router.get('/', validatePagination, orderController.getMyOrders);
router.get('/:id', validateId, orderController.getOrder);
router.post('/', validateOrder, orderController.createOrder);

// Admin routes
router.get('/admin/all', restrictTo('admin'), validatePagination, orderController.getAllOrders);
router.patch('/:id/status', restrictTo('admin'), validateId, orderController.updateOrderStatus);
router.patch('/:id/cancel', validateId, orderController.cancelOrder);

module.exports = router;
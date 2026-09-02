// controllers/paymentController.js
const Order = require('../models/Order');
const { AppError } = require('../middleware/errorHandler');
const { PAYMENT_STATUS } = require('../utils/constants');

// NOTE: This is a mock payment service for testing
// Replace with actual Paystack integration when ready

// @desc    Initialize payment
// @route   POST /api/payments/initialize/:orderId
// @access  Private
exports.initializePayment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('user', 'email');
    
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check ownership
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to pay for this order', 403);
    }

    // Check if already paid
    if (order.payment.status === PAYMENT_STATUS.PAID) {
      throw new AppError('Order already paid', 400);
    }

    // Mock payment initialization
    const mockReference = `MOCK-${order.orderNumber}-${Date.now()}`;
    
    // Update order with payment reference
    order.payment.reference = mockReference;
    order.payment.status = PAYMENT_STATUS.PENDING;
    await order.save();

    res.status(200).json({
      success: true,
      data: {
        authorizationUrl: `http://localhost:5000/mock-payment/${mockReference}`,
        reference: mockReference,
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: order.total
      },
      message: 'Payment initialized (MOCK MODE)'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify payment
// @route   GET /api/payments/verify/:reference
// @access  Private
exports.verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    const order = await Order.findOne({ 'payment.reference': reference });
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check ownership
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to view this payment', 403);
    }

    // Mock verification - always succeeds in test mode
    const isSuccessful = true; // Change to false to test failure

    if (isSuccessful) {
      order.payment.status = PAYMENT_STATUS.PAID;
      order.payment.paystackResponse = {
        status: 'success',
        reference: reference,
        amount: order.total * 100,
        paid_at: new Date().toISOString()
      };
      
      // Update order status
      order.updateStatus('processing', 'Payment confirmed (MOCK)');
      await order.save();

      res.status(200).json({
        success: true,
        data: {
          status: 'success',
          reference: reference,
          orderId: order._id,
          orderNumber: order.orderNumber
        },
        message: 'Payment verified successfully (MOCK MODE)'
      });
    } else {
      order.payment.status = PAYMENT_STATUS.FAILED;
      await order.save();

      throw new AppError('Payment failed', 400);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Handle webhook
// @route   POST /api/payments/webhook
// @access  Public
exports.handleWebhook = async (req, res, next) => {
  try {
    // In test mode, just log the webhook
    console.log('📨 Webhook received (MOCK):', req.body);

    // Mock webhook processing
    res.status(200).json({
      success: true,
      message: 'Webhook received (MOCK MODE)'
    });
  } catch (error) {
    next(error);
  }
};w
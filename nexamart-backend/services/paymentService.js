// services/paymentService.js
const axios = require('axios');
const crypto = require('crypto');
const Order = require('../models/Order');
const { AppError } = require('../middleware/errorHandler');
const { PAYMENT_STATUS } = require('../utils/constants');

class PaymentService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.paystack.co' 
      : 'https://api.paystack.co';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Initialize payment
  async initializePayment(order, callbackUrl) {
    try {
      const payload = {
        email: order.user.email,
        amount: order.total * 100, // Paystack uses kobo
        reference: order.orderNumber,
        callback_url: callbackUrl,
        metadata: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          userId: order.user._id.toString()
        },
        currency: 'NGN'
      };

      const response = await this.client.post('/transaction/initialize', payload);
      
      if (response.data.status) {
        return {
          authorizationUrl: response.data.data.authorization_url,
          reference: response.data.data.reference,
          accessCode: response.data.data.access_code
        };
      } else {
        throw new AppError('Payment initialization failed', 400);
      }
    } catch (error) {
      console.error('Payment initialization error:', error.response?.data || error.message);
      throw new AppError('Payment initialization failed', 500);
    }
  }

  // Verify payment
  async verifyPayment(reference) {
    try {
      const response = await this.client.get(`/transaction/verify/${reference}`);
      
      if (response.data.status) {
        const data = response.data.data;
        return {
          status: data.status,
          amount: data.amount / 100, // Convert from kobo
          currency: data.currency,
          reference: data.reference,
          paidAt: data.paid_at,
          channel: data.channel,
          metadata: data.metadata,
          customer: data.customer,
          transactionDetails: data
        };
      } else {
        throw new AppError('Payment verification failed', 400);
      }
    } catch (error) {
      console.error('Payment verification error:', error.response?.data || error.message);
      throw new AppError('Payment verification failed', 500);
    }
  }

  // Handle webhook events
  handleWebhook(payload, signature) {
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha512', this.secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new AppError('Invalid webhook signature', 401);
    }

    const { event, data } = payload;

    // Handle different events
    switch (event) {
      case 'charge.success':
        return this.handleChargeSuccess(data);
      case 'charge.failed':
        return this.handleChargeFailed(data);
      case 'charge.dispute.create':
        return this.handleDispute(data);
      default:
        console.log(`Unhandled webhook event: ${event}`);
        return null;
    }
  }

  // Handle successful charge
  async handleChargeSuccess(data) {
    try {
      const reference = data.reference;
      const order = await Order.findOne({ orderNumber: reference }).populate('user');

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      // Update order payment status
      order.updatePaymentStatus(
        PAYMENT_STATUS.PAID,
        reference,
        data
      );

      // Update order status to processing
      order.updateStatus('processing', 'Payment confirmed');

      // Reduce product stock
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.reduceStock(item.quantity);
          await product.save();
        }
      }

      await order.save();

      // Send confirmation email (optional)
      // await emailService.sendOrderConfirmation(order);

      return {
        success: true,
        order: order
      };
    } catch (error) {
      console.error('Webhook charge success error:', error);
      throw error;
    }
  }

  // Handle failed charge
  async handleChargeFailed(data) {
    try {
      const reference = data.reference;
      const order = await Order.findOne({ orderNumber: reference });

      if (order) {
        order.updatePaymentStatus(
          PAYMENT_STATUS.FAILED,
          reference,
          data
        );
        order.updateStatus('cancelled', 'Payment failed');
        await order.save();
      }

      return { success: true };
    } catch (error) {
      console.error('Webhook charge failed error:', error);
      throw error;
    }
  }

  // Handle dispute
  async handleDispute(data) {
    // Implement dispute handling logic
    console.log('Dispute created:', data);
    return { success: true };
  }
}

module.exports = new PaymentService();
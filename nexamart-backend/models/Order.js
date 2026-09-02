// models/Order.js
const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: { type: String, required: true },
  sku: { type: String },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  total: { type: Number, required: true },
  attributes: {
    color: String,
    size: String
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  shipping: {
    cost: { type: Number, default: 0 },
    method: { type: String },
    trackingNumber: { type: String },
    carrier: { type: String }
  },
  discount: {
    code: String,
    amount: { type: Number, default: 0 },
    type: { type: String, enum: ['percentage', 'fixed'] }
  },
  total: {
    type: Number,
    required: true
  },
  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    postalCode: { type: String, required: true },
    phone: { type: String },
    recipientName: { type: String }
  },
  billingAddress: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String }
  },
  payment: {
    method: { 
      type: String, 
      enum: ['card', 'transfer', 'paystack'],
      default: 'paystack'
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING
    },
    reference: { type: String },
    paystackResponse: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PENDING
  },
  statusHistory: [{
    status: { type: String, enum: Object.values(ORDER_STATUS) },
    note: { type: String },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
  }],
  notes: {
    type: String,
    maxlength: 500
  },
  cancelledAt: Date,
  cancelledReason: String,
  deliveredAt: Date,
  metadata: {
    ip: String,
    userAgent: String,
    device: String
  }
}, {
  timestamps: true
});

// Indexes
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.status': 1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', function(next) {
  if (this.isNew) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderNumber = `ORD-${timestamp}-${random}`;
  }
  next();
});

// Instance methods
orderSchema.methods = {
  // Update order status
  updateStatus(status, note = '', updatedBy = null) {
    this.status = status;
    this.statusHistory.push({
      status,
      note,
      updatedBy,
      timestamp: new Date()
    });
    
    // Handle status-specific timestamps
    if (status === ORDER_STATUS.CANCELLED) {
      this.cancelledAt = new Date();
    }
    if (status === ORDER_STATUS.DELIVERED) {
      this.deliveredAt = new Date();
    }
    
    return this;
  },

  // Update payment status
  updatePaymentStatus(status, reference = null, response = null) {
    this.payment.status = status;
    if (reference) this.payment.reference = reference;
    if (response) this.payment.paystackResponse = response;
    return this;
  },

  // Calculate order total
  calculateTotal() {
    const itemsTotal = this.items.reduce((sum, item) => sum + item.total, 0);
    this.subtotal = itemsTotal;
    this.total = this.subtotal + this.tax + this.shipping.cost - (this.discount.amount || 0);
    return this.total;
  }
};

// Static methods
orderSchema.statics = {
  // Get orders by user
  getByUser(userId, options = {}) {
    return this.find({ user: userId })
      .populate('items.product', 'name slug images')
      .sort({ createdAt: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 50);
  },

  // Get orders by status
  getByStatus(status, options = {}) {
    return this.find({ status })
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 100);
  }
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
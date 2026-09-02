// controllers/orderController.js
const Order = require('../models/Order');
const Product = require('../models/Product');
const { AppError } = require('../middleware/errorHandler');
const { ORDER_STATUS } = require('../utils/constants');

// @desc    Get user's orders
// @route   GET /api/orders
// @access  Private
exports.getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ user: req.user.id })
        .populate('items.product', 'name slug images price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments({ user: req.user.id })
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'username email')
      .populate('items.product', 'name slug images price');

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check ownership (allow admin to view any order)
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to view this order', 403);
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, billingAddress, notes } = req.body;

    // Validate items and check stock
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        throw new AppError(`Product ${item.product} not found`, 404);
      }

      if (!product.isInStock(item.quantity)) {
        throw new AppError(`Insufficient stock for ${product.name}`, 400);
      }

      const total = product.price * item.quantity;
      subtotal += total;

      orderItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: item.quantity,
        total: total,
        attributes: item.attributes || {}
      });
    }

    // Calculate totals
    const tax = subtotal * 0.075; // 7.5% VAT (example)
    const shippingCost = subtotal > 50000 ? 0 : 1500; // Free shipping over 50k
    const total = subtotal + tax + shippingCost;

    // Create order
    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      subtotal,
      tax,
      shipping: {
        cost: shippingCost,
        method: 'standard'
      },
      total,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      notes,
      status: ORDER_STATUS.PENDING,
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Reduce stock
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: -item.quantity, salesCount: item.quantity } }
      );
    }

    // Populate order before returning
    await order.populate('items.product', 'name slug images');

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders/admin/all
// @access  Private/Admin
exports.getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'username email')
        .populate('items.product', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status (Admin)
// @route   PATCH /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    
    if (!status || !Object.values(ORDER_STATUS).includes(status)) {
      throw new AppError('Valid order status is required', 400);
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    order.updateStatus(status, note || '', req.user.id);
    await order.save();

    res.status(200).json({
      success: true,
      data: order,
      message: `Order status updated to ${status}`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check ownership (allow admin to cancel any order)
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to cancel this order', 403);
    }

    // Check if order can be cancelled
    if (order.status === ORDER_STATUS.DELIVERED || order.status === ORDER_STATUS.CANCELLED) {
      throw new AppError(`Order cannot be cancelled (status: ${order.status})`, 400);
    }

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity, salesCount: -item.quantity } }
      );
    }

    order.updateStatus(ORDER_STATUS.CANCELLED, reason || 'Cancelled by user', req.user.id);
    await order.save();

    res.status(200).json({
      success: true,
      data: order,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};
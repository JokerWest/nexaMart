// middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

// Validation result checker
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    throw new AppError(errorMessages.join('. '), 400);
  }
  next();
};

// Registration validation
exports.validateRegistration = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter'),
  
  validate
];

// Login validation
exports.validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
  
  validate
];

// Product validation
exports.validateProduct = [
  body('name')
    .trim()
    .notEmpty().withMessage('Product name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Product name must be 3-100 characters'),
  
  body('description')
    .trim()
    .notEmpty().withMessage('Product description is required')
    .isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
  
  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
  
  body('stock')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock must be a positive integer'),
  
  body('category')
    .notEmpty().withMessage('Category is required')
    .isMongoId().withMessage('Invalid category ID'),
  
  body('images')
    .optional()
    .isArray().withMessage('Images must be an array'),
  
  validate
];

// Order validation
exports.validateOrder = [
  body('items')
    .isArray({ min: 1 }).withMessage('Order must contain at least one item')
    .custom((items) => {
      if (!items.every(item => item.product && item.quantity)) {
        throw new Error('Each item must have product ID and quantity');
      }
      if (!items.every(item => typeof item.quantity === 'number' && item.quantity > 0)) {
        throw new Error('Quantity must be a positive number');
      }
      return true;
    }),
  
  body('shippingAddress')
    .isObject().withMessage('Shipping address is required')
    .custom((address) => {
      const required = ['street', 'city', 'state', 'country', 'postalCode'];
      const missing = required.filter(field => !address[field]);
      if (missing.length > 0) {
        throw new Error(`Missing shipping address fields: ${missing.join(', ')}`);
      }
      return true;
    }),
  
  validate
];

// ID validation
exports.validateId = [
  param('id')
    .isMongoId().withMessage('Invalid ID format'),
  validate
];

// Pagination validation
exports.validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
    .toInt(),
  
  validate
];
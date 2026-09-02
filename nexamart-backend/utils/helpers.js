// utils/helpers.js
const crypto = require('crypto');

// Generate random token
exports.generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate random code
exports.generateCode = (length = 6) => {
  return Math.random().toString(36).substring(2, length + 2).toUpperCase();
};

// Calculate pagination
exports.getPagination = (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  return { skip, limit: Math.min(limit, 100) };
};

// Format currency
exports.formatCurrency = (amount, currency = 'NGN') => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

// Validate email
exports.isValidEmail = (email) => {
  const emailRegex = /^\S+@\S+\.\S+$/;
  return emailRegex.test(email);
};

// Mask sensitive data
exports.maskEmail = (email) => {
  const [local, domain] = email.split('@');
  const maskedLocal = local.substring(0, 3) + '***' + local.substring(local.length - 2);
  return `${maskedLocal}@${domain}`;
};

// Calculate discount
exports.calculateDiscount = (price, discountPercentage) => {
  return price - (price * (discountPercentage / 100));
};

// Extract domain from email
exports.extractDomain = (email) => {
  return email.split('@')[1];
};

// Generate SKU
exports.generateSKU = (productName, category, variant = '') => {
  const prefix = productName.substring(0, 3).toUpperCase();
  const categoryCode = category.substring(0, 3).toUpperCase();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const variantCode = variant ? `-${variant.substring(0, 3).toUpperCase()}` : '';
  return `${prefix}-${categoryCode}-${random}${variantCode}`;
};
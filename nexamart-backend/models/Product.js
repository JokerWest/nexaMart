// models/Product.js
const mongoose = require('mongoose');
const { PRODUCT_CATEGORY } = require('../utils/constants');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [3, 'Product name must be at least 3 characters'],
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0.01, 'Price must be greater than 0']
  },
  comparePrice: {
    type: Number,
    min: [0, 'Compare price must be positive'],
    validate: {
      validator: function(value) {
        return !value || value > this.price;
      },
      message: 'Compare price must be greater than regular price'
    }
  },
  costPrice: {
    type: Number,
    min: [0, 'Cost price must be positive'],
    select: false // Only admin should see this
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: [0, 'Low stock threshold must be positive']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Product category is required']
  },
  images: [{
    url: { type: String, required: true },
    publicId: { type: String },
    isMain: { type: Boolean, default: false },
    altText: { type: String },
    order: { type: Number, default: 0 }
  }],
  attributes: {
    color: [String],
    size: [String],
    material: String,
    brand: String,
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: { type: String, default: 'cm' }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isOnSale: {
    type: Boolean,
    default: false
  },
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  salesCount: {
    type: Number,
    default: 0
  },
  tags: [String],
  sku: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// Indexes for performance
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });

// Pre-save middleware
productSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  // Update isOnSale based on comparePrice
  this.isOnSale = !!this.comparePrice && this.comparePrice > this.price;
  
  // Ensure main image flag
  if (this.images && this.images.length > 0) {
    const hasMain = this.images.some(img => img.isMain);
    if (!hasMain) {
      this.images[0].isMain = true;
    }
  }
  
  next();
});

// Instance methods
productSchema.methods = {
  // Check if product is in stock
  isInStock(quantity = 1) {
    return this.stock >= quantity;
  },

  // Reduce stock
  reduceStock(quantity) {
    if (!this.isInStock(quantity)) {
      throw new Error('Insufficient stock');
    }
    this.stock -= quantity;
    this.salesCount += quantity;
    return this;
  },

  // Increase stock
  increaseStock(quantity) {
    this.stock += quantity;
    return this;
  }
};

// Static methods
productSchema.statics = {
  // Get featured products
  getFeatured(limit = 10) {
    return this.find({ isActive: true, isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(limit);
  },

  // Search products
  search(query, options = {}) {
    return this.find(
      { $text: { $search: query }, isActive: true },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .skip(options.skip || 0)
    .limit(options.limit || 20);
  }
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
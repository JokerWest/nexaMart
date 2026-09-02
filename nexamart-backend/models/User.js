// models/User.js - COMPLETE FIXED VERSION
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, ADDRESS_TYPES } = require('../utils/constants');

const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [ADDRESS_TYPES.HOME, ADDRESS_TYPES.WORK, ADDRESS_TYPES.OTHER],
    default: ADDRESS_TYPES.HOME
  },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  postalCode: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  phone: { type: String },
  recipientName: { type: String }
}, { _id: true });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.CUSTOMER
  },
  refreshToken: {
    type: String,
    select: false
  },
  addresses: [addressSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

// ✅ FIXED: Combined pre-save middleware
userSchema.pre('save', async function(next) {
  try {
    // 1. Hash password if modified
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
      this.passwordChangedAt = Date.now() - 1000;
    }
    
    // 2. Ensure only one default address
    if (this.addresses && this.addresses.length > 0) {
      const defaultAddresses = this.addresses.filter(addr => addr.isDefault);
      if (defaultAddresses.length > 1) {
        let foundFirst = false;
        this.addresses.forEach(addr => {
          if (addr.isDefault && !foundFirst) {
            foundFirst = true;
          } else if (addr.isDefault) {
            addr.isDefault = false;
          }
        });
      }
    }
    
    next(); // ✅ Call next once at the end
  } catch (error) {
    next(error);
  }
});

// Instance methods
userSchema.methods = {
  async comparePassword(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  },

  isPasswordChangedAfter(jwtTimestamp) {
    if (this.passwordChangedAt) {
      const changedTimestamp = parseInt(
        this.passwordChangedAt.getTime() / 1000,
        10
      );
      return jwtTimestamp < changedTimestamp;
    }
    return false;
  },

  toJSON() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.refreshToken;
    delete userObject.passwordResetToken;
    delete userObject.passwordResetExpires;
    return userObject;
  }
};

// Static methods
userSchema.statics = {
  async findByEmail(email) {
    return await this.findOne({ email: email.toLowerCase() });
  },

  async isEmailTaken(email) {
    const user = await this.findOne({ email: email.toLowerCase() });
    return !!user;
  },

  async isUsernameTaken(username) {
    const user = await this.findOne({ username });
    return !!user;
  }
};

const User = mongoose.model('User', userSchema);
module.exports = User;
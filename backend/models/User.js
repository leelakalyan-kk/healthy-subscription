const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, default: 'Home' },
  recipientPhone: { type: String, required: true },
  address: { type: String, required: true },
  flat: { type: String, default: '' },
  street: { type: String, default: '' },
  area: { type: String, default: '' },
  city: { type: String, default: '' },
  pin: { type: String, default: '' },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  isDefault: { type: Boolean, default: false }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  phone: {
    type: String,
    required: true,
    match: [/^[0-9]{10}$/, 'Phone number must be exactly 10 digits']
  },
  role: {
    type: String,
    enum: ['user', 'seller', 'admin', 'helpdesk'],
    default: 'user'
  },
  kitchenName: { type: String, default: '' },
  branchName: { type: String, default: '' },
  areaName: { type: String, default: '' },
  city: { type: String, default: '' },
  pincode: { type: String, default: '' },
  walletBalance: { type: Number, default: 0 },
  addresses: [addressSchema],
  isDeletionPending: { type: Boolean, default: false },
  deletionRequestedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  protein: { type: String, default: 'High Protein' },
  imageUrl: { type: String, default: '' },
  sellerId: { type: String, default: 'tests' },
  sellerName: { type: String, default: 'Kitchen Partner' },
  areaName: { type: String, default: 'Vijayawada' },
  city: { type: String, default: 'Vijayawada' },
  pincode: { type: String, default: '520001' },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Food', foodSchema);

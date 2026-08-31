const mongoose = require('mongoose');

const FoodSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  protein: { type: String, default: 'High Protein' },
  imageUrl: { type: String, default: '' },
  sellerId: { type: String, default: 'tests' },
  sellerName: { type: String, default: 'Kitchen Partner' },
  branchName: { type: String, default: '' },
  areaName: { type: String, required: true },
  city: { type: String, required: true },
  pincode: { type: String, required: true },
  distanceKm: { type: Number, default: 1.0 },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Food', FoodSchema);

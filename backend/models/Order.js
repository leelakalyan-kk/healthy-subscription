const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  deliveryOtp: { type: String, default: '' },
  sellerId: { type: String, required: true },
  items: [{
    foodId: String,
    title: String,
    price: Number,
    qty: Number,
    sellerId: String,
    sellerName: String,
    areaName: String,
    city: String,
    lat: Number,
    lng: Number
  }],
  totalAmount: { type: Number, required: true },
  deliveryAddress: { type: String, required: true },
  orderStatus: { type: String, default: 'Order Placed' },
  paymentType: { type: String, default: 'Instant UPI' },
  paymentStatus: { type: String, default: 'PAID' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);

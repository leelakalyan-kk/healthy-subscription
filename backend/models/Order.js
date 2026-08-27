const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerName: { type: String, default: 'kalyan' },
  customerId: { type: String, default: 'user_123' },
  sellerId: { type: String, default: 'tests' },
  items: [{
    title: String,
    price: Number,
    qty: Number
  }],
  totalAmount: { type: Number, required: true },
  deliveryAddress: { type: String, default: 'Saved Customer Location' },
  orderStatus: { type: String, default: 'Order Placed' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);

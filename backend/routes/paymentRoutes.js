const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Universal Sandbox Checkout Route
router.post(['/sandbox-pay', '/create-order', '/order', '/checkout', '/place'], async (req, res) => {
  try {
    const { userId, customerName, items, totalAmount, deliveryAddress, paymentType } = req.body;

    const newOrder = {
      customerId: userId || 'user_1',
      customerName: customerName || 'kalyan',
      sellerId: (items && items[0] && items[0].sellerId) ? items[0].sellerId : 'tests',
      items: items || [],
      totalAmount: Number(totalAmount) || 150,
      deliveryAddress: deliveryAddress || 'Vijayawada',
      paymentType: paymentType || 'Sandbox (UPI)',
      paymentStatus: 'PAID',
      orderStatus: 'Order Placed',
      createdAt: new Date()
    };

    const result = await mongoose.connection.db.collection('orders').insertOne(newOrder);
    newOrder._id = result.insertedId;

    const io = req.app.get('io');
    if (io) io.emit('new_order_placed', newOrder);

    const txnId = 'TXN_' + Math.floor(100000 + Math.random() * 900000);
    res.json({
      success: true,
      txnId,
      order: newOrder,
      message: 'Sandbox payment completed successfully'
    });
  } catch (err) {
    console.error('Payment Route Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

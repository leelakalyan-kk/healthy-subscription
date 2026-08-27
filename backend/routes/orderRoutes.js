const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Get seller orders
router.get(['/seller-orders/:sellerId', '/seller/:sellerId', '/all'], async (req, res) => {
  try {
    const orders = await mongoose.connection.db.collection('orders').find().sort({ _id: -1 }).toArray();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user orders (Account page)
router.get('/user-orders/:customerName', async (req, res) => {
  try {
    const cName = req.params.customerName.toLowerCase();
    const orders = await mongoose.connection.db.collection('orders').find().sort({ _id: -1 }).toArray();
    
    // Return all or user specific
    const filtered = orders.filter(o => !o.customerName || o.customerName.toLowerCase() === cName || cName === 'kalyan');
    res.json(filtered.length > 0 ? filtered : orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order status
router.put('/status/:orderId', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const { status } = req.body;
    
    await mongoose.connection.db.collection('orders').updateOne(
      { _id: new ObjectId(req.params.orderId) },
      { $set: { orderStatus: status, updatedAt: new Date() } }
    );

    const updated = await mongoose.connection.db.collection('orders').findOne({ _id: new ObjectId(req.params.orderId) });

    const io = req.app.get('io');
    if (io) io.emit('order_status_updated', updated);

    res.json({ success: true, order: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

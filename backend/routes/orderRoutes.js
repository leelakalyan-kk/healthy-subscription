const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 1. Place a New Order
router.post('/create', async (req, res) => {
  try {
    const { userId, customerName, items, totalAmount, deliveryAddress, paymentType } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required' });
    }

    const orderDoc = {
      userId: userId ? String(userId) : 'kalyan',
      customerName: customerName || 'Customer',
      items: items.map(i => ({
        foodId: i._id || i.foodId,
        title: i.title || 'Healthy Meal',
        price: Number(i.price || 0),
        qty: Number(i.qty || 1),
        sellerId: i.sellerId || 'tests'
      })),
      totalAmount: Number(totalAmount || 0),
      deliveryAddress: deliveryAddress || 'Plot 42, Jubilee Hills, Hyderabad',
      paymentType: paymentType || 'Sandbox (UPI)',
      orderStatus: 'Order Placed',
      createdAt: new Date()
    };

    const result = await mongoose.connection.db.collection('orders').insertOne(orderDoc);
    orderDoc._id = result.insertedId;

    const io = req.app.get('io');
    if (io) {
      io.emit('new_order_placed', orderDoc);
    }

    res.json({ success: true, message: 'Order placed successfully!', order: orderDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get User Orders
router.get('/user-orders/:userId', async (req, res) => {
  try {
    const queryId = req.params.userId;
    const orders = await mongoose.connection.db.collection('orders')
      .find({
        $or: [
          { userId: queryId },
          { customerName: { $regex: new RegExp(queryId, 'i') } }
        ]
      })
      .sort({ _id: -1 })
      .toArray();

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Seller Orders
router.get('/seller-orders/:sellerId', async (req, res) => {
  try {
    const sellerId = req.params.sellerId;
    const orders = await mongoose.connection.db.collection('orders')
      .find({
        $or: [
          { "items.sellerId": sellerId },
          { sellerId: sellerId },
          { "items.sellerId": "tests" },
          { sellerId: "tests" }
        ]
      })
      .sort({ _id: -1 })
      .toArray();

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update Order Status
router.put('/status/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const { ObjectId } = require('mongodb');

    await mongoose.connection.db.collection('orders').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { orderStatus: status, updatedAt: new Date() } }
    );

    const updated = await mongoose.connection.db.collection('orders').findOne({ _id: new ObjectId(req.params.id) });

    const io = req.app.get('io');
    if (io && updated) {
      io.emit('order_status_updated', updated);
    }

    res.json({ success: true, message: 'Order status updated', order: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Sandbox Payment endpoint
router.post('/sandbox-pay', async (req, res) => {
  try {
    const { userId, customerName, totalAmount, paymentType, items, deliveryAddress } = req.body;
    const txnId = 'TXN_' + Math.floor(100000 + Math.random() * 900000);

    const orderDoc = {
      userId: userId ? String(userId) : 'kalyan',
      customerName: customerName || 'Customer',
      items: items || [],
      totalAmount: Number(totalAmount || 0),
      deliveryAddress: deliveryAddress || 'Plot 42, Jubilee Hills, Hyderabad',
      paymentType: paymentType || 'Sandbox (UPI)',
      orderStatus: 'Order Placed',
      transactionId: txnId,
      createdAt: new Date()
    };

    const result = await mongoose.connection.db.collection('orders').insertOne(orderDoc);
    orderDoc._id = result.insertedId;

    const io = req.app.get('io');
    if (io) {
      io.emit('new_order_placed', orderDoc);
    }

    res.json({ success: true, message: 'Payment successful', txnId, order: orderDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

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

    const User = require('../models/User');
    const userRecord = await User.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(userId) ? userId : null },
        { username: customerName },
        { username: userId }
      ]
    });

    const userPhone = userRecord?.phone || req.body.customerPhone || req.body.phone;
    if (!userPhone) {
      return res.status(400).json({ success: false, message: 'Customer phone number not found in profile' });
    }

    const cleanPhone = String(userPhone).replace(/\D/g, '');
    const constantOtp = cleanPhone.slice(-4);

    const orderDoc = {
      userId: String(userId),
      customerName: customerName || userRecord?.username || 'Customer',
      customerPhone: userPhone,
      deliveryOtp: constantOtp,
      items: items.map(i => ({
        foodId: i._id || i.foodId,
        title: i.title || 'Healthy Meal',
        price: Number(i.price || 0),
        qty: Number(i.qty || 1),
        sellerId: String(i.sellerId || '')
      })),
      totalAmount: Number(totalAmount || 0),
      deliveryAddress: deliveryAddress || 'Address Not Provided',
      paymentType: paymentType || 'Sandbox (UPI)',
      orderStatus: 'Order Placed',
      createdAt: new Date()
    };

    const result = await mongoose.connection.db.collection('orders').insertOne(orderDoc);
    orderDoc._id = result.insertedId;

    const io = req.app.get('io');
    if (io) io.emit('new_order_placed', orderDoc);

    res.json({ success: true, message: 'Order placed successfully!', order: orderDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Specific User Orders (Customer Account)
router.get('/user-orders/:userId', async (req, res) => {
  try {
    const queryId = req.params.userId;
    const orders = await mongoose.connection.db.collection('orders')
      .find({
        $or: [
          { userId: queryId },
          { customerName: queryId }
        ]
      })
      .sort({ _id: -1 })
      .toArray();

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Specific Seller Orders (Isolated Multi-tenancy & Tests Fallback)
router.get('/seller-orders/:sellerId', async (req, res) => {
  try {
    const sellerId = String(req.params.sellerId || '').trim();
    let query = {};

    if (sellerId && sellerId !== 'all' && sellerId !== 'admin') {
      query = {
        $or: [
          { "items.sellerId": sellerId },
          { sellerId: sellerId },
          { "items.sellerName": sellerId }
        ]
      };
    }

    const orders = await mongoose.connection.db.collection('orders')
      .find(query)
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

    const existingOrder = await mongoose.connection.db.collection('orders').findOne({ _id: new ObjectId(req.params.id) });
    const rawCustPhone = String(existingOrder?.customerPhone || '').replace(/\D/g, '');
    const lockedOtp = rawCustPhone.length >= 4 ? rawCustPhone.slice(-4) : (existingOrder?.deliveryOtp || '');

    const updateFields = {
      orderStatus: status,
      deliveryOtp: lockedOtp,
      updatedAt: new Date()
    };

    if (req.body.assignedRiderName) updateFields.assignedRiderName = req.body.assignedRiderName;
    if (req.body.riderLocation) updateFields.riderLocation = req.body.riderLocation;

    await mongoose.connection.db.collection('orders').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateFields }
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

// 5. Support Override Action: Force Delivered, Cancelled, or Wallet Refund
router.put('/support-action/:id', async (req, res) => {
  try {
    const { action, refundAmount, reason } = req.body;
    const { ObjectId } = require('mongodb');
    const db = mongoose.connection.db;

    const existing = await db.collection('orders').findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) return res.status(404).json({ success: false, message: 'Order not found' });

    const updateFields = { updatedAt: new Date() };

    if (action === 'CANCEL_AND_REFUND') {
      updateFields.orderStatus = 'Cancelled';
      updateFields.refundStatus = 'REFUNDED';
      updateFields.refundAmount = Number(refundAmount || existing.totalAmount || 0);
      updateFields.cancellationReason = reason || 'Admin / Helpdesk Customer Support Refund';

      if (existing.userId) {
        await db.collection('users').updateOne(
          { $or: [{ _id: existing.userId }, { username: existing.userId }, { username: existing.customerName }] },
          { $inc: { walletBalance: Number(refundAmount || existing.totalAmount || 0) } }
        );
      }
    } else if (action === 'FORCE_DELIVER') {
      updateFields.orderStatus = 'Delivered';
      updateFields.paymentStatus = 'PAID (Support Override)';
      updateFields.deliveredAt = new Date();
    } else if (action === 'FORCE_CANCEL') {
      updateFields.orderStatus = 'Cancelled';
      updateFields.cancellationReason = reason || 'Support Force Cancellation';
    }

    await db.collection('orders').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateFields });
    const updated = await db.collection('orders').findOne({ _id: new ObjectId(req.params.id) });

    const io = req.app.get('io');
    if (io) io.emit('order_status_updated', updated);

    res.json({ success: true, message: 'Support action executed successfully', order: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

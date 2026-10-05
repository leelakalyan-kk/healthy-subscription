const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.post(['/sandbox-pay', '/create-order', '/order', '/checkout', '/place'], async (req, res) => {
  try {
    const { userId, customerName, items, totalAmount, itemTotal, gst, platformFee, deliveryFee, deliveryAddress, paymentType } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required' });
    }

    const sellerId = items[0]?.sellerId || req.body.sellerId;
    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'Invalid kitchen/seller ID in order' });
    }

    const foodIds = items.map(i => i.foodId || i._id).filter(Boolean);
    const db = mongoose.connection.db;

    const unavailableCheck = await db.collection('foods').findOne({
      $or: [
        { sellerId: sellerId, isAvailable: false },
        { _id: { $in: foodIds.map(id => {
          try { return new mongoose.Types.ObjectId(id); } catch(e) { return id; }
        }) }, isAvailable: false }
      ]
    });

    if (unavailableCheck) {
      return res.status(400).json({
        success: false,
        message: 'Kitchen is currently paused or dish is out of stock.'
      });
    }

    const calculatedSubtotal = items.reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.qty || 1)), 0);
    const grossFoodAmount = Number(itemTotal || calculatedSubtotal || 0);

    const User = require('../models/User');
    const userRecord = await User.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(userId) ? userId : null },
        { username: customerName },
        { username: userId }
      ].filter(Boolean)
    });

    const phoneFromDb = userRecord?.phone || req.body.customerPhone || req.body.phone;
    if (!phoneFromDb) {
      return res.status(400).json({ success: false, message: 'Customer phone number is required.' });
    }

    const cleanPhone = String(phoneFromDb).replace(/\D/g, '');
    const constantDeliveryOtp = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : '';

    const newOrder = {
      userId: String(userId || userRecord?._id || ''),
      customerName: customerName || userRecord?.username || 'Customer',
      customerPhone: cleanPhone,
      deliveryOtp: constantDeliveryOtp,
      sellerId: String(sellerId),
      items: items.map(it => ({
        foodId: it.foodId || it._id,
        title: it.title || 'Healthy Meal',
        price: Number(it.price || 0),
        qty: Number(it.qty || 1),
        sellerId: String(it.sellerId || sellerId),
        sellerName: it.sellerName || '',
        areaName: it.areaName || '',
        city: it.city || '',
        lat: Number(it.lat || 0),
        lng: Number(it.lng || 0)
      })),
      itemTotal: grossFoodAmount,
      gst: Number(gst || 0),
      platformFee: Number(platformFee || 0),
      deliveryFee: Number(deliveryFee || 0),
      totalAmount: Number(totalAmount || grossFoodAmount),
      deliveryAddress: deliveryAddress || userRecord?.areaName || '',
      paymentType: paymentType || 'Instant UPI',
      paymentStatus: (paymentType && paymentType.toLowerCase().includes('cash')) ? 'PENDING' : 'PAID',
      orderStatus: 'Order Placed',
      createdAt: new Date()
    };

    const result = await db.collection('orders').insertOne(newOrder);
    newOrder._id = result.insertedId;

    const io = req.app.get('io');
    if (io) io.emit('new_order_placed', newOrder);

    const txnId = 'TXN_' + Math.floor(100000 + Math.random() * 900000);
    res.json({
      success: true,
      txnId,
      order: newOrder,
      message: 'Payment and order processed successfully'
    });
  } catch (err) {
    console.error('Payment Route Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.post(['/sandbox-pay', '/create-order', '/order', '/checkout', '/place'], async (req, res) => {
  try {
    const { userId, customerName, items, totalAmount, itemTotal, gst, platformFee, deliveryFee, deliveryAddress, paymentType } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required' });
    }

    const sellerId = (items && items[0] && items[0].sellerId) ? items[0].sellerId : 'tests';

    // Verify if kitchen is active and dishes are available
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
        message: '⚠️ Kitchen is currently PAUSED or dish is Out of Stock. Cannot accept new orders right now.'
      });
    }

    const calculatedSubtotal = (items || []).reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.qty || 1)), 0);
    const grossFoodAmount = Number(itemTotal || calculatedSubtotal || 0);

    const User = require('../models/User');
    const userRecord = await User.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(userId) ? userId : null },
        { username: customerName },
        { username: userId }
      ]
    });

    const phoneFromDb = userRecord?.phone || req.body.customerPhone || req.body.phone;
    const cleanPhone = String(phoneFromDb || '').replace(/\D/g, '');
    const constantDeliveryOtp = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : '0000';

    const rawPhone = String(req.body.customerPhone || req.body.phone || '8074095895').replace(/\D/g, '');
    const phoneBasedOtp = rawPhone.length >= 4 ? rawPhone.slice(-4) : '1234';

    const newOrder = {
      deliveryOtp: phoneBasedOtp,
      userId: userId || 'user_1',
      customerName: customerName || userRecord?.username || 'Customer',
      customerPhone: phoneFromDb,
      deliveryOtp: constantDeliveryOtp,
      sellerId: sellerId,
      items: (items || []).map(it => ({
        foodId: it.foodId || it._id,
        title: it.title || 'Healthy Meal',
        price: Number(it.price || 0),
        qty: Number(it.qty || 1),
        sellerId: it.sellerId || sellerId
      })),
      itemTotal: grossFoodAmount,
      gst: Number(gst || 0),
      platformFee: Number(platformFee || 0),
      deliveryFee: Number(deliveryFee || 0),
      totalAmount: Number(totalAmount || grossFoodAmount),
      deliveryAddress: deliveryAddress || 'Saved Customer Location',
      paymentType: paymentType || 'Sandbox (UPI)',
      paymentStatus: 'PAID',
      orderStatus: 'Order Placed',
      // OTP locked to customer phone
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
      message: 'Payment completed successfully'
    });
  } catch (err) {
    console.error('Payment Route Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

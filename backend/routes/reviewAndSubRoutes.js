const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.post('/review/add', async (req, res) => {
  try {
    const { foodId, customerName, rating, reviewText } = req.body;
    const reviewDoc = {
      foodId: new mongoose.Types.ObjectId(foodId),
      customerName: customerName || 'Customer',
      rating: Number(rating),
      reviewText: reviewText || '',
      createdAt: new Date()
    };
    await mongoose.connection.db.collection('reviews').insertOne(reviewDoc);
    res.json({ success: true, message: 'Review posted successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Recurring Meal Subscription (Dynamic without hardcoded phones or sellers)
router.post('/subscription/create', async (req, res) => {
  try {
    const { customerName, customerEmail, planType, durationDays, items, totalAmount, deliveryTime, deliveryAddress, defaultDish, sellerId } = req.body;
    const db = mongoose.connection.db;

    const User = require('../models/User');
    const userDoc = await User.findOne({
      $or: [{ email: customerEmail }, { username: customerName }]
    });

    const userPhone = userDoc?.phone || req.body.phone;
    if (!userPhone) {
      return res.status(400).json({ success: false, message: 'Valid contact number required for subscription.' });
    }
    const cleanPhone = String(userPhone).replace(/\D/g, '');
    const lockedOtp = cleanPhone.slice(-4);

    const resolvedSellerId = sellerId || (items && items[0]?.sellerId) || (userDoc?.role === 'seller' ? String(userDoc._id) : '');

    const subDoc = {
      customerName: customerName || userDoc?.username || 'Customer',
      customerEmail: customerEmail || userDoc?.email || '',
      customerPhone: cleanPhone,
      planType: planType || '7-Day High Protein Lunch Box',
      durationDays: Number(durationDays) || 7,
      selectedTomorrowMeal: defaultDish || 'Chef Special Balanced Bowl',
      items: items || [],
      totalAmount: Number(totalAmount) || 0,
      deliveryTime: deliveryTime || '12:30 PM - 01:30 PM',
      deliveryAddress: deliveryAddress || '',
      status: 'Active',
      startDate: new Date(),
      endDate: new Date(Date.now() + (Number(durationDays) || 7) * 24 * 60 * 60 * 1000)
    };

    const result = await db.collection('subscriptions').insertOne(subDoc);
    subDoc._id = result.insertedId;

    if (resolvedSellerId) {
      const sellerOrderDoc = {
        userId: userDoc?._id ? String(userDoc._id) : customerName,
        customerName: customerName,
        customerPhone: cleanPhone,
        deliveryOtp: lockedOtp,
        items: [{
          title: `[Subscription] ${defaultDish || planType}`,
          price: Math.round(Number(totalAmount) / (Number(durationDays) || 7)),
          qty: 1,
          sellerId: resolvedSellerId
        }],
        totalAmount: Math.round(Number(totalAmount) / (Number(durationDays) || 7)),
        deliveryAddress: deliveryAddress,
        paymentType: 'Subscription Pre-Paid',
        paymentStatus: 'PAID',
        orderStatus: 'Ready for Pickup',
        createdAt: new Date()
      };

      const insertedOrder = await db.collection('orders').insertOne(sellerOrderDoc);
      sellerOrderDoc._id = insertedOrder.insertedId;

      const io = req.app.get('io');
      if (io) io.emit('new_order_placed', sellerOrderDoc);
    }

    res.json({ success: true, subscription: subDoc, message: 'Subscription activated & dispatched to kitchen!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/subscription/customize-meal/:subId', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const { selectedMeal } = req.body;

    await mongoose.connection.db.collection('subscriptions').updateOne(
      { _id: new ObjectId(req.params.subId) },
      { $set: { selectedTomorrowMeal: selectedMeal, updatedAt: new Date() } }
    );

    const updated = await mongoose.connection.db.collection('subscriptions').findOne({ _id: new ObjectId(req.params.subId) });
    res.json({ success: true, message: "Tomorrow's meal updated!", subscription: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/subscription/user/:email', async (req, res) => {
  try {
    const list = await mongoose.connection.db.collection('subscriptions')
      .find({ customerEmail: req.params.email })
      .sort({ _id: -1 })
      .toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Support Ticket System (Dynamic contact lookup)
router.post('/support/ticket/create', async (req, res) => {
  try {
    const { senderRole, senderName, senderContact, orderId, issueType, message } = req.body;
    const db = mongoose.connection.db;

    if (!senderContact) {
      return res.status(400).json({ success: false, message: 'Sender contact information is required.' });
    }

    const ticketDoc = {
      ticketId: 'TKT_' + Math.floor(100000 + Math.random() * 900000),
      senderRole: senderRole || 'customer',
      senderName: senderName || 'User',
      senderContact: String(senderContact).trim(),
      orderId: orderId ? String(orderId).slice(-6).toUpperCase() : 'GENERAL',
      issueType: issueType || 'Order Delay',
      message: message || '',
      status: 'OPEN',
      createdAt: new Date()
    };

    const result = await db.collection('support_tickets').insertOne(ticketDoc);
    ticketDoc._id = result.insertedId;

    const io = req.app.get('io');
    if (io) io.emit('new_support_ticket', ticketDoc);

    res.json({ success: true, message: 'Ticket raised! Agent will assist you shortly.', ticket: ticketDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/support/tickets/all', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const tickets = await db.collection('support_tickets').find().sort({ createdAt: -1 }).toArray();
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/support/ticket/resolve/:id', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const db = mongoose.connection.db;
    await db.collection('support_tickets').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: 'RESOLVED', resolvedAt: new Date() } }
    );
    res.json({ success: true, message: 'Ticket marked as Resolved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/support/tickets/user/:identifier', async (req, res) => {
  try {
    const id = req.params.identifier;
    const db = mongoose.connection.db;
    const tickets = await db.collection('support_tickets')
      .find({ $or: [{ senderName: id }, { senderContact: id }] })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rider-feedback/add', async (req, res) => {
  try {
    const { orderId, riderName, customerName, rating, feedbackText } = req.body;
    const db = mongoose.connection.db;

    const feedbackDoc = {
      orderId: orderId || 'GENERAL',
      riderName: riderName || 'Delivery Partner',
      customerName: customerName || 'Customer',
      rating: Number(rating) || 5,
      feedbackText: feedbackText || 'On-time delivery',
      createdAt: new Date()
    };

    await db.collection('rider_reviews').insertOne(feedbackDoc);
    res.json({ success: true, message: 'Delivery partner feedback recorded!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

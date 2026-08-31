const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 1. Submit a Food Review & Rating
router.post('/review/add', async (req, res) => {
  try {
    const { foodId, customerName, rating, reviewText } = req.body;
    if (!foodId || !rating) {
      return res.status(400).json({ success: false, message: 'Rating and foodId are required' });
    }

    const reviewDoc = {
      foodId: new mongoose.Types.ObjectId(foodId),
      customerName: customerName || 'Customer',
      rating: Number(rating),
      reviewText: reviewText || '',
      createdAt: new Date()
    };

    await mongoose.connection.db.collection('reviews').insertOne(reviewDoc);

    const allReviews = await mongoose.connection.db.collection('reviews')
      .find({ foodId: new mongoose.Types.ObjectId(foodId) })
      .toArray();

    const avgRating = (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1);

    await mongoose.connection.db.collection('foods').updateOne(
      { _id: new mongoose.Types.ObjectId(foodId) },
      { $set: { rating: Number(avgRating), reviewCount: allReviews.length } }
    );

    res.json({ success: true, message: 'Review posted successfully!', avgRating });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Create Recurring Meal Subscription
router.post('/subscription/create', async (req, res) => {
  try {
    const { customerName, customerEmail, planType, durationDays, items, totalAmount, deliveryTime, deliveryAddress, defaultDish } = req.body;

    const subDoc = {
      customerName: customerName || 'Customer',
      customerEmail: customerEmail || 'customer@example.com',
      planType: planType || '7-Day High Protein Lunch Box',
      durationDays: Number(durationDays) || 7,
      selectedTomorrowMeal: defaultDish || 'Paneer Quinoa High Protein Bowl',
      items: items || [],
      totalAmount: Number(totalAmount) || 0,
      deliveryTime: deliveryTime || '12:30 PM - 01:30 PM',
      deliveryAddress: deliveryAddress || 'Plot 42, Jubilee Hills, Hyderabad',
      status: 'Active',
      startDate: new Date(),
      endDate: new Date(Date.now() + (Number(durationDays) || 7) * 24 * 60 * 60 * 1000)
    };

    const result = await mongoose.connection.db.collection('subscriptions').insertOne(subDoc);
    subDoc._id = result.insertedId;

    res.json({ success: true, subscription: subDoc, message: 'Subscription activated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Update Tomorrow's Meal Choice by Customer
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

// 4. Get Subscriptions by User Email
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

module.exports = router;

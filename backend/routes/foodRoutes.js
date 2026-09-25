const express = require('express');
const router = express.Router();
const Food = require('../models/Food');
const cloudinary = require('../utils/cloudinary');
const mongoose = require('mongoose');

// 1. Get All Foods
router.get('/all', async (req, res) => {
  try {
    const foods = await Food.find().sort({ createdAt: -1 });
    res.json(foods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Toggle Kitchen Online / Paused (Bulk update all dishes for seller)
router.put('/toggle-kitchen/:sellerId', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { isOnline } = req.body;

    const db = mongoose.connection.db;
    await db.collection('foods').updateMany(
      { $or: [{ sellerId: sellerId }, { sellerName: sellerId }] },
      { $set: { isAvailable: Boolean(isOnline), kitchenOnline: Boolean(isOnline) } }
    );

    const updatedFoods = await Food.find().sort({ createdAt: -1 });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('kitchen_status_changed', { sellerId, isOnline });
      io.emit('foods_bulk_updated', updatedFoods);
    }

    res.json({ success: true, isOnline: Boolean(isOnline), message: isOnline ? 'Kitchen is now LIVE' : 'Kitchen is PAUSED' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Add Food with Cloudinary
router.post('/add', async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      protein,
      imageUrl,
      sellerId,
      sellerName,
      branchName,
      areaName,
      city,
      pincode
    } = req.body;

    let finalImageUrl = imageUrl || '';

    if (imageUrl && imageUrl.startsWith('data:image')) {
      try {
        const uploadRes = await cloudinary.uploader.upload(imageUrl, {
          folder: 'healthybites_dishes'
        });
        finalImageUrl = uploadRes.secure_url;
      } catch (cErr) {
        console.warn("Cloudinary upload failed, using fallback:", cErr.message);
        finalImageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
      }
    }

    const newFood = new Food({
      title: title?.trim(),
      description: description?.trim() || '',
      price: Number(price),
      protein: protein || 'High Protein',
      imageUrl: finalImageUrl,
      sellerId: String(sellerId || ''),
      sellerName: String(sellerName || ''),
      branchName: branchName?.trim() || 'Main Branch',
      areaName: areaName?.trim() || 'Local Area',
      city: city?.trim() || 'Vijayawada',
      pincode: pincode?.trim() || '520001',
      isAvailable: true
    });

    const savedFood = await newFood.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('food_added', savedFood);
    }

    res.status(201).json({ success: true, food: savedFood });
  } catch (err) {
    console.error('Cloudinary / Mongo Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Update Food
router.put('/update/:id', async (req, res) => {
  try {
    const updated = await Food.findByIdAndUpdate(req.params.id, req.body, { new: true });
    const io = req.app.get('io');
    if (io && updated) {
      io.emit('food_updated', updated);
    }
    res.json({ success: true, food: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Delete Food
router.delete('/:id', async (req, res) => {
  try {
    await Food.findByIdAndDelete(req.params.id);
    const io = req.app.get('io');
    if (io) {
      io.emit('food_deleted', req.params.id);
    }
    res.json({ success: true, message: 'Dish deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

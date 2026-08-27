const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const cloudinary = require('../utils/cloudinary');

// Universal Fetch Dishes
router.get(['/all', '/', '/list', '/seller/:sellerId'], async (req, res) => {
  try {
    const foods = await mongoose.connection.db.collection('foods').find().sort({ _id: -1 }).toArray();
    
    const normalized = foods.map(item => ({
      ...item,
      id: item._id,
      title: item.title || item.name || 'Healthy Meal',
      price: Number(item.price) || 120,
      protein: item.protein || 'High Protein',
      isAvailable: item.isAvailable !== false,
      sellerId: item.sellerId || 'tests',
      sellerName: item.sellerName || 'tests',
      areaName: item.areaName || 'Vijayawada',
      city: item.city || 'Vijayawada',
      pincode: item.pincode || '520001',
      imageUrl: item.imageUrl || ''
    }));

    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Dish with Cloudinary
router.post(['/add', '/create'], async (req, res) => {
  try {
    let finalImageUrl = req.body.imageUrl || '';

    if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
      try {
        const uploadRes = await cloudinary.uploader.upload(finalImageUrl, {
          folder: 'healthybites_dishes'
        });
        finalImageUrl = uploadRes.secure_url;
      } catch (uploadErr) {
        console.error('Cloudinary Upload Error:', uploadErr.message);
      }
    }

    const doc = {
      title: req.body.title,
      description: req.body.description || '',
      price: Number(req.body.price) || 100,
      protein: req.body.protein || 'High Protein',
      imageUrl: finalImageUrl,
      sellerId: req.body.sellerId || 'tests',
      sellerName: req.body.sellerName || 'tests',
      areaName: req.body.areaName || 'Vijayawada',
      city: req.body.city || 'Vijayawada',
      pincode: req.body.pincode || '520001',
      isAvailable: true,
      createdAt: new Date()
    };

    const result = await mongoose.connection.db.collection('foods').insertOne(doc);
    doc._id = result.insertedId;

    const io = req.app.get('io');
    if (io) io.emit('food_added', doc);

    res.json({ success: true, food: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Dish
router.put('/update/:id', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const updateData = { ...req.body };
    delete updateData._id;
    await mongoose.connection.db.collection('foods').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });
    
    const updated = await mongoose.connection.db.collection('foods').findOne({ _id: new ObjectId(req.params.id) });
    const io = req.app.get('io');
    if (io) io.emit('food_updated', updated);

    res.json({ success: true, food: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Dish
router.delete(['/:id', '/delete/:id'], async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    await mongoose.connection.db.collection('foods').deleteOne({ _id: new ObjectId(req.params.id) });
    
    const io = req.app.get('io');
    if (io) io.emit('food_deleted', req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

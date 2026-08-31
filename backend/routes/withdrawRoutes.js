const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 1. Request a Payout / Withdrawal (Auto-settles in Sandbox Mode)
router.post('/request', async (req, res) => {
  try {
    const { sellerId, amount, upiId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payout amount' });
    }

    const refNumber = `PAYOUT_${Math.floor(100000 + Math.random() * 900000)}`;

    const withdrawDoc = {
      sellerId: sellerId || 'kalyan',
      amount: Number(amount),
      payoutDetails: upiId || 'kalyan@okhdfcbank',
      referenceId: refNumber,
      status: 'Completed', // Instantly completed in sandbox mode
      requestedAt: new Date(),
      settledAt: new Date()
    };

    const result = await mongoose.connection.db.collection('withdrawals').insertOne(withdrawDoc);
    withdrawDoc._id = result.insertedId;

    const io = req.app.get('io');
    if (io) {
      io.emit('withdrawal_requested', withdrawDoc);
    }

    res.json({
      success: true,
      withdrawal: withdrawDoc,
      message: 'Instant payout transfer successful!'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Auto-Update all previous Pending/Processing Payouts to Completed
router.put('/settle-all', async (req, res) => {
  try {
    await mongoose.connection.db.collection('withdrawals').updateMany(
      { status: 'Processing' },
      { $set: { status: 'Completed', settledAt: new Date() } }
    );
    res.json({ success: true, message: 'All pending payouts marked as Completed!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Withdrawal History for a Kitchen
router.get('/history/:sellerId', async (req, res) => {
  try {
    // Auto mark processing records as Completed on load
    await mongoose.connection.db.collection('withdrawals').updateMany(
      { status: 'Processing' },
      { $set: { status: 'Completed', settledAt: new Date() } }
    );

    const history = await mongoose.connection.db.collection('withdrawals')
      .find({
        $or: [
          { sellerId: req.params.sellerId },
          { sellerId: 'tests' },
          { sellerId: 'kalyan' }
        ]
      })
      .sort({ _id: -1 })
      .toArray();

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

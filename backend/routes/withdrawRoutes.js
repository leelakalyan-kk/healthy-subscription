const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 1. Get seller withdrawals history
router.get(['/history/:sellerId', '/all'], async (req, res) => {
  try {
    const list = await mongoose.connection.db.collection('withdrawals').find().sort({ _id: -1 }).toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Request new withdrawal payout
router.post('/request', async (req, res) => {
  try {
    const { sellerId, amount, upiId, bankAccount, ifsc } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid amount' });
    }

    const newWithdrawal = {
      sellerId: sellerId || 'tests',
      amount: Number(amount),
      payoutMode: upiId ? 'UPI' : 'Bank Transfer',
      payoutDetails: upiId || `${bankAccount} (${ifsc})`,
      status: 'Processing',
      referenceId: 'PAYOUT_' + Math.floor(100000 + Math.random() * 900000),
      requestedAt: new Date()
    };

    const result = await mongoose.connection.db.collection('withdrawals').insertOne(newWithdrawal);
    newWithdrawal._id = result.insertedId;

    const io = req.app.get('io');
    if (io) io.emit('withdrawal_requested', newWithdrawal);

    res.json({ success: true, withdrawal: newWithdrawal, message: 'Withdrawal payout requested successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

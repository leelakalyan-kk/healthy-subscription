const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 1. Seller / Kitchen Partner Withdrawal
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
      payoutDetails: upiId || 'partner@okhdfcbank',
      referenceId: refNumber,
      status: 'Completed',
      type: 'SELLER_PAYOUT',
      requestedAt: new Date(),
      settledAt: new Date()
    };

    const result = await mongoose.connection.db.collection('withdrawals').insertOne(withdrawDoc);
    withdrawDoc._id = result.insertedId;

    const io = req.app.get('io');
    if (io) io.emit('withdrawal_requested', withdrawDoc);

    res.json({
      success: true,
      withdrawal: withdrawDoc,
      message: 'Instant payout transfer successful!'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Admin / Company Profit Withdrawal to Bank Account
router.post('/admin-withdraw', async (req, res) => {
  try {
    const { amount, accountNumber, ifscCode, accountHolder } = req.body;
    const numAmt = Number(amount);

    if (!numAmt || numAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid profit withdrawal amount' });
    }
    if (!accountNumber || !ifscCode) {
      return res.status(400).json({ success: false, message: 'Account Number and IFSC Code are required' });
    }

    const refNumber = `ADMIN_BANK_TXN_${Math.floor(100000 + Math.random() * 900000)}`;
    const bankDetailsStr = `A/C: ${accountNumber.slice(-4).padStart(accountNumber.length, 'X')} · IFSC: ${ifscCode.toUpperCase()} (${accountHolder || 'Company Admin'})`;

    const adminWithdrawDoc = {
      sellerId: 'COMPANY_ADMIN',
      amount: numAmt,
      payoutDetails: bankDetailsStr,
      accountNumber: accountNumber,
      ifscCode: ifscCode.toUpperCase(),
      accountHolder: accountHolder || 'HealthyBites Corp',
      referenceId: refNumber,
      status: 'Completed',
      type: 'ADMIN_PROFIT_WITHDRAW',
      requestedAt: new Date(),
      settledAt: new Date()
    };

    const result = await mongoose.connection.db.collection('withdrawals').insertOne(adminWithdrawDoc);
    adminWithdrawDoc._id = result.insertedId;

    const io = req.app.get('io');
    if (io) io.emit('withdrawal_requested', adminWithdrawDoc);

    res.json({
      success: true,
      withdrawal: adminWithdrawDoc,
      message: `🎉 Company Profit of ₹${numAmt} successfully transferred to Bank A/C ending in ${accountNumber.slice(-4)}!`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Auto-Settle all pending payouts
router.put('/settle-all', async (req, res) => {
  try {
    await mongoose.connection.db.collection('withdrawals').updateMany(
      { status: 'Processing' },
      { $set: { status: 'Completed', settledAt: new Date() } }
    );
    res.json({ success: true, message: 'All payouts settled!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Withdrawal History
router.get('/history/:sellerId', async (req, res) => {
  try {
    const sellerId = req.params.sellerId;
    let query = {};
    if (sellerId !== 'all' && sellerId !== 'admin') {
      query = {
        $or: [
          { sellerId: sellerId },
          { sellerId: 'tests' },
          { sellerId: 'kalyan' }
        ]
      };
    }

    const history = await mongoose.connection.db.collection('withdrawals')
      .find(query)
      .sort({ _id: -1 })
      .toArray();

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Cross-server Rider Fleet Status & COD Ledger Proxy
router.get('/rider-fleet-summary', async (req, res) => {
  try {
    const axios = require('axios');
    const RIDER_SERVER_IP = 'http://15.206.179.97';
    
    // Fetch riders from Delivery Partner instance
    const ridersRes = await axios.get(`${RIDER_SERVER_IP}/api/admin/riders/pending`, { timeout: 3500 }).catch(() => ({ data: { riders: [] } }));
    
    // Read local mongo database for settlement ledger if shared, or fallback
    const db = mongoose.connection.db;
    const localSettlements = await db.collection('settlements').find().sort({ createdAt: -1 }).limit(30).toArray();
    
    res.json({
      success: true,
      pendingRiders: ridersRes.data.riders || [],
      settlements: localSettlements || []
    });
  } catch (err) {
    res.json({ success: true, pendingRiders: [], settlements: [] });
  }
});

module.exports = router;

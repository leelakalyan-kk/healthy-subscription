const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PATCH", "DELETE"] }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const MONGO_URI = "mongodb+srv://leelakumardj:RgG7Gw32FXgZJ9Ul@healthybites.yi1xnfr.mongodb.net/healthySubscription?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Atlas Connected Successfully"))
  .catch(err => console.error("❌ MongoDB Atlas Connection Error:", err));

io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);
});

// FOOD SCHEMA
const FoodSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: 'Nutritious meal' },
  price: { type: Number, required: true },
  protein: { type: String, default: 'High Protein' },
  pincode: { type: String, default: '520001' },
  areaName: { type: String, default: 'Benz Circle' },
  city: { type: String, default: 'Vijayawada' },
  location: { type: String, default: 'Benz Circle, Vijayawada' },
  lat: { type: Number, default: 16.5062 },
  lng: { type: Number, default: 80.6480 },
  sellerId: { type: String, default: 'tests' },
  sellerName: { type: String, default: 'tests' },
  imageUrl: { type: String, default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500' }
}, { timestamps: true, collection: 'foods' });

const Food = mongoose.model('Food', FoodSchema);

// USER & ADDRESS SCHEMA
const LocationSchema = new mongoose.Schema({
  labelName: { type: String, default: 'Home' },
  address: { type: String, required: true },
  pin: { type: String, default: '' },
  phone: { type: String, required: true },
  isDefault: { type: Boolean, default: false }
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  walletBalance: { type: Number, default: 250 },
  locations: [LocationSchema]
}, { timestamps: true, collection: 'users' });

const User = mongoose.model('User', UserSchema);

// ORDER SCHEMA
const OrderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  customerName: { type: String, default: 'Customer' },
  sellerId: { type: String, default: 'tests' },
  sellerName: { type: String, default: 'tests' },
  items: Array,
  totalAmount: Number,
  deliveryAddress: String,
  deliveryPincode: String,
  paymentMethod: { type: String, default: 'Sandbox Instant Pay' },
  paymentId: String,
  orderStatus: { type: String, default: 'Order Placed' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'orders' });

const Order = mongoose.model('Order', OrderSchema);

// WITHDRAWAL SCHEMA
const WithdrawalSchema = new mongoose.Schema({
  sellerId: { type: String, required: true },
  sellerName: { type: String, default: 'Kitchen' },
  amount: { type: Number, required: true },
  payoutMethod: { type: String, default: 'UPI' },
  accountNumber: { type: String, default: '' },
  ifscCode: { type: String, default: '' },
  upiId: { type: String, default: '' },
  bankHolderName: { type: String, default: '' },
  status: { type: String, default: 'Completed' },
  referenceId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'withdrawals' });

const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

// --- FOOD ROUTES ---
app.get('/api/food', async (req, res) => {
  try {
    const foods = await Food.find({}).sort({ createdAt: -1 });
    res.json(foods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/food/seller/:sellerId', async (req, res) => {
  try {
    const sid = String(req.params.sellerId || '').trim();
    let foods = [];
    if (sid && sid !== 'undefined' && sid !== 'null') {
      foods = await Food.find({
        $or: [
          { sellerId: sid },
          { sellerName: sid },
          { sellerName: new RegExp(sid, "i") }
        ]
      }).sort({ createdAt: -1 });
    }
    if (foods.length === 0) {
      foods = await Food.find({}).sort({ createdAt: -1 });
    }
    res.json(foods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/food/add', async (req, res) => {
  try {
    const foodData = {
      title: req.body.title,
      description: req.body.description || 'Fresh nutrient-rich balanced meal.',
      price: Number(req.body.price),
      protein: req.body.protein || 'High Protein',
      pincode: req.body.pincode || '520001',
      areaName: req.body.areaName || 'Benz Circle',
      city: req.body.city || 'Vijayawada',
      location: `${req.body.areaName || 'Benz Circle'}, ${req.body.city || 'Vijayawada'}`,
      lat: 16.5062,
      lng: 80.6480,
      sellerId: req.body.sellerId || 'tests',
      sellerName: req.body.sellerName || 'tests',
      imageUrl: req.body.imageUrl
    };

    const newFood = new Food(foodData);
    const saved = await newFood.save();
    io.emit('food_added', saved);
    res.status(201).json({ success: true, message: "Food added!", food: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/food/:id', async (req, res) => {
  try {
    await Food.findByIdAndDelete(req.params.id);
    io.emit('food_deleted', req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- USER & ADDRESS ROUTES ---
app.get('/api/user/locations/:identifier', async (req, res) => {
  try {
    const id = req.params.identifier;
    let user = mongoose.Types.ObjectId.isValid(id) ? await User.findById(id) : await User.findOne({ username: id });
    res.json(user ? user.locations : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/location/add', async (req, res) => {
  try {
    const { userId, location } = req.body;
    let user = mongoose.Types.ObjectId.isValid(userId) ? await User.findById(userId) : await User.findOne({ username: userId });
    
    if (!user) {
      user = new User({
        username: userId || 'user',
        email: `${userId || 'user'}@healthy.com`,
        password: '123',
        locations: []
      });
    }

    user.locations.forEach(l => l.isDefault = false);
    user.locations.push({ ...location, isDefault: true });
    await user.save();
    res.json({ success: true, locations: user.locations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/user/location/set-active/:userId/:locationId', async (req, res) => {
  try {
    const { userId, locationId } = req.params;
    let user = mongoose.Types.ObjectId.isValid(userId) ? await User.findById(userId) : await User.findOne({ username: userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    user.locations.forEach(l => l.isDefault = (String(l._id) === String(locationId)));
    await user.save();
    res.json({ success: true, locations: user.locations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/user/location/:userId/:locationId', async (req, res) => {
  try {
    const { userId, locationId } = req.params;
    let user = mongoose.Types.ObjectId.isValid(userId) ? await User.findById(userId) : await User.findOne({ username: userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    user.locations = user.locations.filter(l => String(l._id) !== String(locationId));
    if (user.locations.length > 0 && !user.locations.some(l => l.isDefault)) {
      user.locations[0].isDefault = true;
    }
    await user.save();
    res.json({ success: true, locations: user.locations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- AUTH ROUTES ---
app.post('/api/auth/signup', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.json({ message: "Registered!", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const user = await User.findOne({
      $or: [{ email: req.body.identifier }, { username: req.body.identifier }],
      password: req.body.password
    });
    if (!user) return res.status(400).json({ error: "Invalid credentials." });
    res.json({ message: "Login Successful", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ORDER ROUTES ---
app.post('/api/payment/sandbox-pay', async (req, res) => {
  try {
    const { userId, customerName, items, totalAmount, deliveryAddress, deliveryPincode, paymentType } = req.body;
    const sellerId = items[0]?.sellerId || 'tests';
    const sellerName = items[0]?.sellerName || 'tests';
    const mockTxnId = `TXN_SANDBOX_${Date.now()}`;

    const newOrder = new Order({
      userId: userId || 'guest_user',
      customerName: customerName || 'Customer',
      sellerId: String(sellerId),
      sellerName,
      items,
      totalAmount,
      deliveryAddress: deliveryAddress || 'Vijayawada',
      deliveryPincode: deliveryPincode || '520001',
      paymentMethod: `Sandbox [${paymentType || 'UPI'}]`,
      paymentId: mockTxnId,
      orderStatus: 'Order Placed'
    });

    await newOrder.save();
    io.emit('new_order_placed', newOrder);
    res.json({ success: true, order: newOrder, txnId: mockTxnId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/my-orders/:userId', async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [{ userId: req.params.userId }, { customerName: req.params.userId }]
    }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/seller-orders/:sellerId', async (req, res) => {
  try {
    const sid = req.params.sellerId;
    const orders = await Order.find({
      $or: [{ sellerId: sid }, { sellerName: sid }, { sellerId: 'tests' }]
    }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SELLER PAYOUTS ---
app.get('/api/seller/payout-summary/:sellerId', async (req, res) => {
  try {
    const sId = req.params.sellerId;
    const sellerOrders = await Order.find({
      $or: [{ sellerId: sId }, { sellerName: sId }, { sellerId: 'tests' }],
      orderStatus: { $ne: 'Cancelled' }
    });
    const totalGrossSales = sellerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const platformCommission = Math.round(totalGrossSales * 0.05);
    const netEarnings = totalGrossSales - platformCommission;

    const withdrawals = await Withdrawal.find({ $or: [{ sellerId: sId }, { sellerId: 'tests' }] }).sort({ createdAt: -1 });
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const availableBalance = Math.max(0, netEarnings - totalWithdrawn);

    res.json({ totalGrossSales, platformCommission, netEarnings, totalWithdrawn, availableBalance, withdrawals, completedOrdersCount: sellerOrders.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

server.listen(5000, () => console.log('🚀 Server listening on port 5000'));

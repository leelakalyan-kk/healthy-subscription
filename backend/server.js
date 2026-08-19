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
mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB Connected")).catch(console.error);

io.on('connection', (socket) => {
  console.log('⚡ Connected:', socket.id);
});

// SCHEMAS
const FoodSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  protein: { type: String, default: 'High Protein' },
  pincode: { type: String, default: '520001' },
  areaName: { type: String, default: 'Benz Circle' },
  city: { type: String, default: 'Vijayawada' },
  location: { type: String, default: 'Benz Circle, Vijayawada' },
  lat: { type: Number, default: 16.5062 },
  lng: { type: Number, default: 80.6480 },
  sellerId: { type: String, default: 'default_seller' },
  sellerName: { type: String, default: 'Verified Kitchen' },
  imageUrl: { type: String, default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500' }
}, { timestamps: true });
const Food = mongoose.model('Food', FoodSchema);

const LocationSchema = new mongoose.Schema({
  labelName: { type: String, default: 'Home' },
  address: { type: String, required: true },
  pin: { type: String, default: '' },
  phone: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  lat: { type: Number, default: 16.5062 },
  lng: { type: Number, default: 80.6480 }
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  walletBalance: { type: Number, default: 250 },
  locations: [LocationSchema]
}, { timestamps: true });
const User = mongoose.model('User', UserSchema);

const OrderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  customerName: { type: String, default: 'Customer' },
  sellerId: { type: String, default: 'default_seller' },
  sellerName: { type: String, default: 'Kitchen' },
  items: Array,
  totalAmount: Number,
  deliveryAddress: String,
  deliveryPincode: String,
  paymentMethod: { type: String, default: 'Sandbox Test Payment' },
  paymentId: String,
  orderStatus: { type: String, default: 'Order Placed' },
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

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
});
const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

// INSTANT ORDER STATUS BROADCAST
app.patch('/api/orders/update-status', async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(orderId, { orderStatus: status }, { new: true });
    if (!updatedOrder) return res.status(404).json({ error: "Order not found" });

    // ⚡ Instant 0-second emission to all connected clients
    io.emit('order_status_updated', updatedOrder);
    res.json({ message: "Status updated!", order: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// INSTANT ORDER CREATION BROADCAST
app.post('/api/payment/sandbox-pay', async (req, res) => {
  try {
    const { userId, customerName, items, totalAmount, deliveryAddress, deliveryPincode, paymentType } = req.body;
    const sellerId = items[0]?.sellerId || 'default_seller';
    const sellerName = items[0]?.sellerName || 'Kitchen';
    const mockTxnId = `TXN_SANDBOX_${Date.now()}`;

    const newOrder = new Order({
      userId: userId || 'guest_user',
      customerName: customerName || 'Customer',
      sellerId: String(sellerId),
      sellerName,
      items,
      totalAmount,
      deliveryAddress,
      deliveryPincode: deliveryPincode || '',
      paymentMethod: `Sandbox [${paymentType || 'UPI'}]`,
      paymentId: mockTxnId,
      orderStatus: 'Order Placed'
    });

    await newOrder.save();
    // ⚡ Instant emission
    io.emit('new_order_placed', newOrder);
    res.json({ success: true, order: newOrder, txnId: mockTxnId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SELLER PAYOUTS
app.get('/api/seller/payout-summary/:sellerId', async (req, res) => {
  try {
    const sId = req.params.sellerId;
    const sellerOrders = await Order.find({ $or: [{ sellerId: sId }, { sellerName: sId }], orderStatus: { $ne: 'Cancelled' } });
    const totalGrossSales = sellerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const platformCommission = Math.round(totalGrossSales * 0.05);
    const netEarnings = totalGrossSales - platformCommission;

    const withdrawals = await Withdrawal.find({ sellerId: sId }).sort({ createdAt: -1 });
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const availableBalance = Math.max(0, netEarnings - totalWithdrawn);

    res.json({ totalGrossSales, platformCommission, netEarnings, totalWithdrawn, availableBalance, withdrawals, completedOrdersCount: sellerOrders.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/seller/request-withdrawal', async (req, res) => {
  try {
    const { sellerId, sellerName, amount, payoutMethod, bankHolderName, accountNumber, ifscCode, upiId } = req.body;
    const newWithdrawal = new Withdrawal({
      sellerId: String(sellerId),
      sellerName: sellerName || 'Kitchen',
      amount: Number(amount),
      payoutMethod: payoutMethod || 'UPI',
      bankHolderName: bankHolderName || sellerName,
      accountNumber, ifscCode, upiId,
      referenceId: `REF_${Date.now()}`
    });
    await newWithdrawal.save();
    io.emit('withdrawal_created', newWithdrawal);
    res.json({ message: "Success", withdrawal: newWithdrawal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD ROUTES
app.get('/api/food', async (req, res) => res.json(await Food.find().sort({ createdAt: -1 })));
app.get('/api/food/seller/:sellerId', async (req, res) => res.json(await Food.find({ $or: [{ sellerId: req.params.sellerId }, { sellerName: req.params.sellerId }] }).sort({ createdAt: -1 })));
app.post('/api/food/add', async (req, res) => {
  const newFood = new Food(req.body);
  await newFood.save();
  io.emit('food_added', newFood);
  res.json({ message: "Food added!", food: newFood });
});
app.delete('/api/food/:id', async (req, res) => {
  await Food.findByIdAndDelete(req.params.id);
  io.emit('food_deleted', req.params.id);
  res.json({ message: "Deleted", id: req.params.id });
});

app.post('/api/auth/signup', async (req, res) => {
  const user = new User(req.body);
  await user.save();
  res.json({ message: "Registered!", user });
});
app.post('/api/auth/login', async (req, res) => {
  const user = await User.findOne({ $or: [{ email: req.body.identifier }, { username: req.body.identifier }], password: req.body.password });
  if (!user) return res.status(400).json({ error: "Invalid credentials." });
  res.json({ message: "Login Successful", user });
});

app.get('/api/orders/my-orders/:userId', async (req, res) => res.json(await Order.find({ $or: [{ userId: req.params.userId }, { customerName: req.params.userId }] }).sort({ createdAt: -1 })));
app.get('/api/orders/seller-orders/:sellerId', async (req, res) => res.json(await Order.find({ $or: [{ sellerId: req.params.sellerId }, { sellerName: req.params.sellerId }] }).sort({ createdAt: -1 })));

app.get('/api/user/locations/:identifier', async (req, res) => {
  const id = req.params.identifier;
  let user = mongoose.Types.ObjectId.isValid(id) ? await User.findById(id) : await User.findOne({ username: id });
  res.json(user ? user.locations : []);
});
app.post('/api/user/location/add', async (req, res) => {
  const { userId, location } = req.body;
  let user = mongoose.Types.ObjectId.isValid(userId) ? await User.findById(userId) : await User.findOne({ username: userId });
  if (!user) user = new User({ username: userId || 'user', email: `${userId}@healthy.com`, password: '123', locations: [] });
  user.locations.forEach(l => l.isDefault = false);
  user.locations.push({ ...location, isDefault: true });
  await user.save();
  res.json({ locations: user.locations });
});
app.patch('/api/user/location/set-active/:userId/:locationId', async (req, res) => {
  const { userId, locationId } = req.params;
  let user = mongoose.Types.ObjectId.isValid(userId) ? await User.findById(userId) : await User.findOne({ username: userId });
  if (!user) return res.status(404).json({ error: "User not found" });
  user.locations.forEach(l => l.isDefault = (String(l._id) === String(locationId)));
  await user.save();
  res.json({ locations: user.locations });
});
app.delete('/api/user/location/:userId/:locationId', async (req, res) => {
  const { userId, locationId } = req.params;
  let user = mongoose.Types.ObjectId.isValid(userId) ? await User.findById(userId) : await User.findOne({ username: userId });
  if (!user) return res.status(404).json({ error: "User not found" });
  user.locations = user.locations.filter(l => String(l._id) !== String(locationId));
  if (user.locations.length > 0 && !user.locations.some(l => l.isDefault)) user.locations[0].isDefault = true;
  await user.save();
  res.json({ locations: user.locations });
});

server.listen(5000, () => console.log('🚀 Server listening on 5000'));

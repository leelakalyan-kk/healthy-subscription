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
  .then(() => console.log("✅ MongoDB Atlas Connected with Geospatial Engine"))
  .catch(err => console.error("❌ MongoDB Atlas Connection Error:", err));

// FOOD SCHEMA WITH GEOJSON & 2DSPHERE
const FoodSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: 'Nutritious meal' },
  price: { type: Number, required: true },
  protein: { type: String, default: 'High Protein' },
  pincode: { type: String, required: true },
  areaName: { type: String, default: '' },
  city: { type: String, default: '' },
  locationName: { type: String, default: '' },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  sellerId: { type: String, default: 'tests' },
  sellerName: { type: String, default: 'tests' },
  imageUrl: { type: String, default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500' }
}, { timestamps: true, collection: 'foods' });

FoodSchema.index({ location: '2dsphere' });
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

// 🌐 UNIVERSAL ALL-INDIA GEOCODING ENGINE
async function dynamicIndiaGeocode(area, pin, city) {
  const cleanPin = String(pin || '').trim().match(/\b\d{6}\b/)?.[0];
  
  try {
    // 1. First priority: Government Open Postal India API
    if (cleanPin) {
      const pRes = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
      const pData = await pRes.json();
      if (pData && pData[0]?.Status === 'Success' && pData[0].PostOffice?.length > 0) {
        const po = pData[0].PostOffice[0];
        const osmQuery = encodeURIComponent(`${po.Name || ''} ${po.District} ${cleanPin} India`);
        const osmRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${osmQuery}&limit=1`, {
          headers: { 'User-Agent': 'HealthySubscriptionApp/2.0' }
        });
        const osmData = await osmRes.json();
        if (osmData && osmData.length > 0) {
          return { lat: parseFloat(osmData[0].lat), lng: parseFloat(osmData[0].lon), city: po.District };
        }
      }
    }

    // 2. Second priority: OpenStreetMap Direct Query
    const fullQuery = encodeURIComponent(`${area || ''} ${city || ''} ${cleanPin || ''} India`.trim());
    const osmRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${fullQuery}&limit=1`, {
      headers: { 'User-Agent': 'HealthySubscriptionApp/2.0' }
    });
    const osmData = await osmRes.json();
    if (osmData && osmData.length > 0) {
      return { lat: parseFloat(osmData[0].lat), lng: parseFloat(osmData[0].lon), city: city || 'India' };
    }
  } catch (err) {
    console.error("Geocoding service error:", err.message);
  }

  // 3. Mathematical India PIN Grid Projection (Universal Fallback for ANY 6-digit PIN in India)
  if (cleanPin) {
    const prefix2 = parseInt(cleanPin.substring(0, 2), 10);
    const pinVal = parseInt(cleanPin, 10);
    
    // Grid interpolation for all zones in India
    let baseLat = 20.0, baseLng = 78.0;
    if (prefix2 >= 11 && prefix2 <= 19) { baseLat = 28.6; baseLng = 77.2; } // North (Delhi/Punjab/Haryana/HP/J&K)
    else if (prefix2 >= 20 && prefix2 <= 28) { baseLat = 26.8; baseLng = 80.9; } // UP/Uttarakhand
    else if (prefix2 >= 30 && prefix2 <= 34) { baseLat = 26.9; baseLng = 75.8; } // Rajasthan
    else if (prefix2 >= 36 && prefix2 <= 39) { baseLat = 23.0; baseLng = 72.5; } // Gujarat
    else if (prefix2 >= 40 && prefix2 <= 44) { baseLat = 19.0; baseLng = 72.8; } // Maharashtra/Goa
    else if (prefix2 >= 45 && prefix2 <= 49) { baseLat = 23.2; baseLng = 77.4; } // MP/Chhattisgarh
    else if (prefix2 >= 50 && prefix2 <= 53) {
      // AP & Telangana Zone
      if (prefix2 === 50 || prefix2 === 51) { baseLat = 17.3850 + ((pinVal % 1000) * 0.0005); baseLng = 78.4867 + ((pinVal % 1000) * 0.0005); } // Hyderabad/Rayalaseema
      else if (prefix2 === 52) { baseLat = 16.5062 + ((pinVal % 1000) * 0.0005); baseLng = 80.6480 + ((pinVal % 1000) * 0.0005); } // Vijayawada/Guntur/Coastal
      else if (prefix2 === 53) { baseLat = 17.6868 + ((pinVal % 1000) * 0.0005); baseLng = 83.2185 + ((pinVal % 1000) * 0.0005); } // Vizag/East Godavari
    }
    else if (prefix2 >= 56 && prefix2 <= 59) { baseLat = 12.9716; baseLng = 77.5946; } // Karnataka
    else if (prefix2 >= 60 && prefix2 <= 64) { baseLat = 13.0827; baseLng = 80.2707; } // Tamil Nadu
    else if (prefix2 >= 67 && prefix2 <= 69) { baseLat = 8.5241; baseLng = 76.9366; } // Kerala
    else if (prefix2 >= 70 && prefix2 <= 74) { baseLat = 22.5726; baseLng = 88.3639; } // West Bengal
    else if (prefix2 >= 75 && prefix2 <= 77) { baseLat = 20.2961; baseLng = 85.8245; } // Odisha
    else if (prefix2 >= 78 && prefix2 <= 79) { baseLat = 26.1445; baseLng = 91.7362; } // North East
    else if (prefix2 >= 80 && prefix2 <= 85) { baseLat = 25.5941; baseLng = 85.1376; } // Bihar/Jharkhand

    return { lat: baseLat, lng: baseLng, city: city || 'India' };
  }

  return { lat: 16.5062, lng: 80.6480, city: 'India' };
}

// 1. GET ALL FOODS
app.get('/api/food', async (req, res) => {
  try {
    const foods = await Food.find({}).sort({ createdAt: -1 });
    res.json(foods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET SELLER FOODS
app.get('/api/food/seller/:sellerId', async (req, res) => {
  try {
    const sid = String(req.params.sellerId || '').trim();
    const foods = await Food.find({
      $or: [
        { sellerId: sid },
        { sellerName: sid },
        { sellerName: new RegExp(sid, "i") },
        { sellerId: "tests" }
      ]
    }).sort({ createdAt: -1 });
    res.json(foods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST ADD NEW FOOD (Automatic India Maps Live Geocoding)
app.post('/api/food/add', async (req, res) => {
  try {
    const { title, description, price, protein, pincode, areaName, city, imageUrl, sellerId, sellerName } = req.body;
    
    // Live Map Resolution
    const geo = await dynamicIndiaGeocode(areaName, pincode, city);

    const newFood = new Food({
      title,
      description: description || 'Fresh nutrient-rich balanced meal.',
      price: Number(price),
      protein: protein || 'High Protein',
      pincode: String(pincode || '520001'),
      areaName: areaName || '',
      city: city || geo.city || '',
      locationName: `${areaName || ''}, ${city || ''} (${pincode || ''})`.trim(),
      lat: geo.lat,
      lng: geo.lng,
      location: {
        type: 'Point',
        coordinates: [geo.lng, geo.lat]
      },
      sellerId: sellerId || 'tests',
      sellerName: sellerName || 'tests',
      imageUrl
    });

    const saved = await newFood.save();
    io.emit('food_added', saved);
    res.status(201).json({ success: true, food: saved });
  } catch (err) {
    console.error("Add food error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. DELETE FOOD
app.delete('/api/food/:id', async (req, res) => {
  try {
    await Food.findByIdAndDelete(req.params.id);
    io.emit('food_deleted', req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. USER ADDRESSES
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

// 6. AUTH & ORDERS
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
      deliveryAddress: deliveryAddress || 'India',
      deliveryPincode: deliveryPincode || '',
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

server.listen(5000, () => console.log('🚀 Server listening on port 5000 with Universal Maps Geocoder'));

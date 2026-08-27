const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set('io', io);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://leelakumardj:RgG7Gw32FXgZJ9Ul@healthybites.yi1xnfr.mongodb.net/healthySubscription?retryWrites=true&w=majority&appName=healthybites";

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully to healthySubscription'))
  .catch(err => console.error('❌ DB Error:', err.message));

// Routes Mapping
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/foods', require('./routes/foodRoutes'));
app.use('/api/food', require('./routes/foodRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));
app.use('/api/withdraw', require('./routes/withdrawRoutes'));

// Socket Handler
io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 HealthyBites Backend live on port ${PORT}`);
});

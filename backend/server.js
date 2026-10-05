const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Strict Socket CORS
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.set('io', io);

// 1. HTTP Security Headers (XSS, Clickjacking, MIME-Sniffing protection)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// 2. Controlled CORS
app.use(cors());

// 3. Payload Limiter to prevent Buffer Overflows
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// 4. Rate Limiting for Auth Endpoints (Prevents Brute-force & Credential Stuffing)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 login/signup attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts from this IP, please try again after 15 minutes.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signin', authLimiter);
app.use('/api/auth/signup', authLimiter);

// 5. General API Rate Limiting (Anti-Spam / Anti-DDoS)
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600, // 600 requests per minute
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', generalLimiter);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/healthySubscription';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Securely'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Register all modular API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/food', require('./routes/foodRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));
app.use('/api/withdraw', require('./routes/withdrawRoutes'));
app.use('/api/extra', require('./routes/reviewAndSubRoutes'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Secured server running on port ${PORT}`);
});

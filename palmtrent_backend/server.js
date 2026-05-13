const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/database');
const validateEnv = require('./config/validateEnv');
const { setupSocketHandler } = require('./socket/socketHandler');
const { requestContext } = require('./middleware/observability');
const opsController = require('./controllers/opsController');

// Route files
const auth = require('./routes/auth');
const verification = require('./routes/verification');
const bookings = require('./routes/bookings');
const shipments = require('./routes/shipments');
const corporate = require('./routes/corporate');
const transporter = require('./routes/transporter');
const shipper = require('./routes/shipper');
const trailerOwner = require('./routes/trailerOwner');
const vehicle = require('./routes/vehicles');
const driver = require('./routes/driver');
const vehicleRoutes = require('./routes/vehicleRoutes');
const payments = require('./routes/payments');
const ratings = require('./routes/ratings');
const claims = require('./routes/claims');
const notifications = require('./routes/notifications');
const rentals = require('./routes/rentals');
const trailers = require('./routes/trailers');
const crossBorder = require('./routes/crossBorder');
const reference = require('./routes/reference');
const emergency = require('./routes/emergency');
const documentExpiry = require('./routes/documentExpiry');
const whatsapp = require('./routes/whatsapp');
const uploads = require('./routes/uploads');
const admin = require('./routes/admin');
const tracking = require('./routes/tracking');
const safety = require('./routes/safety');
const ops = require('./routes/ops');
const insurance = require('./routes/insurance');
const path = require('path');

validateEnv();

// Connect to database
connectDB();

const app = express();
app.use(requestContext);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS middleware
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '*')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routers
app.use('/api/v1/auth', auth);
app.use('/api/v1/verification', verification);
app.use('/api/v1/bookings', bookings);
app.use('/api/v1/shipments', shipments);
app.use('/api/v1/corporate', corporate);
app.use('/api/v1/transporter', transporter);
app.use('/api/v1/shipper', shipper);
app.use('/api/v1/trailer-owner', trailerOwner);
app.use('/api/v1/drivers', driver);
app.use('/api/v1/vehicles', vehicle);
app.use('/api/v1/routes', vehicleRoutes);
app.use('/api/v1/payments', payments);
app.use('/api/v1/ratings', ratings);
app.use('/api/v1/claims', claims);
app.use('/api/v1/notifications', notifications);
app.use('/api/v1/rentals', rentals);
app.use('/api/v1/trailers', trailers);
app.use('/api/v1/cross-border', crossBorder);
app.use('/api/v1/reference', reference);
app.use('/api/v1/emergency', emergency);
app.use('/api/v1/documents', documentExpiry);
app.use('/api/v1/whatsapp', whatsapp);
app.use('/api/v1/uploads', uploads);
app.use('/api/v1/admin', admin);
app.use('/api/v1/tracking', tracking);
app.use('/api/v1/safety', safety);
app.use('/api/v1/ops', ops);
app.use('/api/v1/insurance', insurance);

// Health check route
app.get('/api/v1/health', opsController.health);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  res.status(err.statusCode || 500).json({
    success: false,
    requestId: req.requestId,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize socket handler
setupSocketHandler(io);

// Make io available to routes
app.set('io', io);

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`Socket.io enabled for real-time features`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', err);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = { app, io };

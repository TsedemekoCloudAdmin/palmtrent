const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/database');

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

// Connect to database
connectDB();

const app = express();

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
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

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

// Health check route
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

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
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', err);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;
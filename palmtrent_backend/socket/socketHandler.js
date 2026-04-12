// socket/socketHandler.js
// Socket.io handler for real-time features

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Booking = require('../models/Booking');

// Store active connections
const connections = new Map();
const transporterLocations = new Map();

const setupSocketHandler = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket auth error:', error.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    const userRole = socket.user.role;

    console.log(`User connected: ${userId} (${userRole})`);

    // Store connection
    connections.set(userId, socket);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join role-specific room
    socket.join(`role:${userRole}`);

    // ============ LOCATION UPDATES (Transporter) ============
    socket.on('location:update', async (data) => {
      try {
        const { latitude, longitude, bookingId, heading, speed } = data;

        if (userRole !== 'transporter') {
          return socket.emit('error', { message: 'Only transporters can update location' });
        }

        const locationData = {
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
          timestamp: new Date(),
          transporterId: userId
        };

        // Store latest location
        transporterLocations.set(userId, locationData);

        // If tracking a specific booking, notify the shipper
        if (bookingId) {
          const booking = await Booking.findById(bookingId).select('shipper');
          if (booking && booking.shipper) {
            io.to(`user:${booking.shipper.toString()}`).emit('tracking:location', {
              bookingId,
              ...locationData
            });
          }

          // Also broadcast to tracking room
          io.to(`tracking:${bookingId}`).emit('tracking:location', {
            bookingId,
            ...locationData
          });
        }

        socket.emit('location:updated', { success: true });
      } catch (error) {
        console.error('Location update error:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // ============ TRACKING SUBSCRIPTION ============
    socket.on('tracking:subscribe', async (data) => {
      try {
        const { bookingId } = data;

        const booking = await Booking.findById(bookingId)
          .select('shipper transporter status');

        if (!booking) {
          return socket.emit('error', { message: 'Booking not found' });
        }

        // Verify user has access to this booking
        const isShipper = booking.shipper?.toString() === userId;
        const isTransporter = booking.transporter?.toString() === userId;

        if (!isShipper && !isTransporter) {
          return socket.emit('error', { message: 'Access denied' });
        }

        // Join tracking room
        socket.join(`tracking:${bookingId}`);

        // Send current transporter location if available
        if (booking.transporter) {
          const currentLocation = transporterLocations.get(booking.transporter.toString());
          if (currentLocation) {
            socket.emit('tracking:location', {
              bookingId,
              ...currentLocation
            });
          }
        }

        socket.emit('tracking:subscribed', { bookingId, status: booking.status });
      } catch (error) {
        console.error('Tracking subscribe error:', error);
        socket.emit('error', { message: 'Failed to subscribe to tracking' });
      }
    });

    socket.on('tracking:unsubscribe', (data) => {
      const { bookingId } = data;
      socket.leave(`tracking:${bookingId}`);
      socket.emit('tracking:unsubscribed', { bookingId });
    });

    // ============ BOOKING STATUS UPDATES ============
    socket.on('booking:statusUpdate', async (data) => {
      try {
        const { bookingId, status, notes } = data;

        const booking = await Booking.findById(bookingId);

        if (!booking) {
          return socket.emit('error', { message: 'Booking not found' });
        }

        // Verify transporter owns this booking
        if (booking.transporter?.toString() !== userId) {
          return socket.emit('error', { message: 'Not authorized' });
        }

        // Update booking status
        booking.status = status;
        if (notes) {
          booking.timeline = booking.timeline || [];
          booking.timeline.push({
            status,
            notes,
            timestamp: new Date(),
            updatedBy: userId
          });
        }
        await booking.save();

        // Notify shipper
        io.to(`user:${booking.shipper.toString()}`).emit('booking:statusChanged', {
          bookingId,
          status,
          notes,
          timestamp: new Date()
        });

        // Broadcast to tracking room
        io.to(`tracking:${bookingId}`).emit('booking:statusChanged', {
          bookingId,
          status,
          notes,
          timestamp: new Date()
        });

        socket.emit('booking:statusUpdated', { success: true, status });
      } catch (error) {
        console.error('Booking status update error:', error);
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // ============ NEW JOB NOTIFICATIONS ============
    socket.on('jobs:subscribe', () => {
      if (userRole === 'transporter') {
        socket.join('jobs:available');
        socket.emit('jobs:subscribed', { success: true });
      }
    });

    socket.on('jobs:unsubscribe', () => {
      socket.leave('jobs:available');
    });

    // ============ CHAT/MESSAGING ============
    socket.on('chat:join', (data) => {
      const { bookingId } = data;
      socket.join(`chat:${bookingId}`);
      socket.emit('chat:joined', { bookingId });
    });

    socket.on('chat:message', async (data) => {
      try {
        const { bookingId, message } = data;

        const chatMessage = {
          senderId: userId,
          senderName: socket.user.fullName,
          senderRole: userRole,
          message,
          timestamp: new Date()
        };

        // Broadcast to chat room
        io.to(`chat:${bookingId}`).emit('chat:newMessage', {
          bookingId,
          ...chatMessage
        });
      } catch (error) {
        console.error('Chat message error:', error);
      }
    });

    socket.on('chat:leave', (data) => {
      const { bookingId } = data;
      socket.leave(`chat:${bookingId}`);
    });

    // ============ SOS/EMERGENCY ============
    socket.on('sos:trigger', async (data) => {
      try {
        const { bookingId, latitude, longitude, type, description } = data;

        const sosAlert = {
          userId,
          userName: socket.user.fullName,
          userRole,
          bookingId,
          location: { latitude, longitude },
          type: type || 'emergency',
          description,
          timestamp: new Date()
        };

        // Notify admin room
        io.to('role:admin').emit('sos:alert', sosAlert);

        // If booking exists, notify the other party
        if (bookingId) {
          const booking = await Booking.findById(bookingId).select('shipper transporter');
          if (booking) {
            const otherPartyId = userRole === 'shipper'
              ? booking.transporter?.toString()
              : booking.shipper?.toString();

            if (otherPartyId) {
              io.to(`user:${otherPartyId}`).emit('sos:alert', sosAlert);
            }
          }
        }

        socket.emit('sos:triggered', { success: true, alertId: Date.now() });
      } catch (error) {
        console.error('SOS trigger error:', error);
        socket.emit('error', { message: 'Failed to trigger SOS' });
      }
    });

    // ============ TYPING INDICATORS ============
    socket.on('chat:typing', (data) => {
      const { bookingId, isTyping } = data;
      socket.to(`chat:${bookingId}`).emit('chat:userTyping', {
        userId,
        userName: socket.user.fullName,
        isTyping
      });
    });

    // ============ DISCONNECT ============
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      connections.delete(userId);

      // Clear transporter location on disconnect
      if (userRole === 'transporter') {
        transporterLocations.delete(userId);
      }
    });
  });

  return io;
};

// Helper functions for external use
const emitToUser = (io, userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

const emitToRole = (io, role, event, data) => {
  io.to(`role:${role}`).emit(event, data);
};

const emitNewJob = (io, booking) => {
  io.to('jobs:available').emit('jobs:new', {
    bookingId: booking._id,
    pickup: booking.route.pickup,
    delivery: booking.route.delivery,
    cargoType: booking.cargo.type,
    weight: booking.cargo.weight,
    price: booking.pricing.total,
    pickupDate: booking.route.pickup.scheduledDate
  });
};

const emitBookingUpdate = (io, bookingId, shipperId, data) => {
  io.to(`user:${shipperId}`).emit('booking:update', { bookingId, ...data });
  io.to(`tracking:${bookingId}`).emit('booking:update', { bookingId, ...data });
};

const getTransporterLocation = (transporterId) => {
  return transporterLocations.get(transporterId);
};

const isUserOnline = (userId) => {
  return connections.has(userId);
};

module.exports = {
  setupSocketHandler,
  emitToUser,
  emitToRole,
  emitNewJob,
  emitBookingUpdate,
  getTransporterLocation,
  isUserOnline
};

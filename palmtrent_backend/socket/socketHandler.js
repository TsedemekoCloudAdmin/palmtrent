// socket/socketHandler.js
// Socket.io handler for real-time features

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const Driver = require('../models/Driver');
const chatService = require('../services/chatService');
const notificationService = require('../services/notificationService');

// Store active connections
const connections = new Map();
const transporterLocations = new Map();

const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

// Resolve (and cache on the socket) the Driver record id for a 'driver' user.
const getSocketDriverId = async (socket) => {
  if (socket.user.userType !== 'driver') return null;
  if (socket.data.driverId !== undefined) return socket.data.driverId;
  const driver = await Driver.findOne({ user: socket.user._id }).select('_id');
  socket.data.driverId = driver?._id ? driver._id.toString() : null;
  return socket.data.driverId;
};

const trackingLookupFor = (identifier) => ({
  $or: [
    { bookingReference: identifier },
    ...(isObjectId(identifier) ? [{ _id: identifier }] : [])
  ]
});

const resolveTrackingTarget = async (identifier) => {
  let booking = await Booking.findOne(trackingLookupFor(identifier))
    .select('shipper transporter status bookingReference');

  const shipmentQuery = booking
    ? { bookingReference: booking.bookingReference }
    : {
        $or: [
          { bookingReference: identifier },
          ...(isObjectId(identifier) ? [{ _id: identifier }, { booking: identifier }] : [])
        ]
      };

  const shipment = await Shipment.findOne(shipmentQuery)
    .select('booking bookingReference shipper transporter assignedDriver status');

  if (!booking && shipment?.booking) {
    booking = await Booking.findById(shipment.booking)
      .select('shipper transporter status bookingReference');
  }

  if (!booking && shipment?.bookingReference) {
    booking = await Booking.findOne({ bookingReference: shipment.bookingReference })
      .select('shipper transporter status bookingReference');
  }

  return { booking, shipment };
};

const trackingRoomsFor = (identifier, booking, shipment) => {
  const rooms = [
    identifier,
    booking?._id?.toString(),
    booking?.bookingReference,
    shipment?._id?.toString(),
    shipment?.bookingReference
  ].filter(Boolean);

  return [...new Set(rooms)].map(room => `tracking:${room}`);
};

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
    const userRole = socket.user.userType;
    socket.data.trackingSubscriptions = new Map();

    console.log(`User connected: ${userId} (${userRole})`);

    // Store connection
    connections.set(userId, socket);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join role-specific room
    socket.join(`role:${userRole}`);

    // ============ LOCATION UPDATES (Transporter or assigned Driver) ============
    socket.on('location:update', async (data) => {
      try {
        const { latitude, longitude, bookingId, heading, speed } = data;

        if (userRole !== 'transporter' && userRole !== 'driver') {
          return socket.emit('error', { message: 'Only transporters or drivers can update location' });
        }

        // Resolve the booking/shipment up front so we can authorize drivers and
        // broadcast to the right rooms.
        let booking = null;
        let shipment = null;
        if (bookingId) {
          ({ booking, shipment } = await resolveTrackingTarget(bookingId));
        }

        // A driver may only push location for a shipment they are assigned to.
        if (userRole === 'driver') {
          const driverId = await getSocketDriverId(socket);
          const assignedDriverId = shipment?.assignedDriver?.toString();
          if (!driverId || !assignedDriverId || assignedDriverId !== driverId) {
            return socket.emit('error', { message: 'You are not assigned to this shipment' });
          }
        }

        // Key the location by the shipment's transporter so subscribers (who look
        // up the transporter's live position) see driver updates too.
        const locationKey = userRole === 'driver'
          ? (shipment?.transporter?.toString() || booking?.transporter?.toString() || userId)
          : userId;

        const locationData = {
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
          timestamp: new Date(),
          transporterId: locationKey
        };

        // Store latest location
        transporterLocations.set(locationKey, locationData);

        // Persist to the shipment (fire-and-forget) so tracking survives app
        // reloads and REST consumers see the latest position too.
        if (shipment?._id) {
          Shipment.updateOne(
            { _id: shipment._id },
            {
              currentLocation: { type: 'Point', coordinates: [longitude, latitude] },
              $push: {
                tracking: {
                  $each: [{
                    location: { type: 'Point', coordinates: [longitude, latitude] },
                    timestamp: new Date(),
                    event: 'location_updated',
                    note: 'Live location update'
                  }],
                  $slice: -200 // cap history growth from frequent live updates
                }
              }
            }
          ).catch(err => console.error('Persist live location error:', err.message));
        }

        // If tracking a specific booking or shipment reference, notify the shipper
        if (bookingId) {
          if (booking && booking.shipper) {
            io.to(`user:${booking.shipper.toString()}`).emit('tracking:location', {
              bookingId,
              ...locationData
            });
          }

          trackingRoomsFor(bookingId, booking, shipment).forEach(room => {
            io.to(room).emit('tracking:location', {
              bookingId,
              reference: booking?.bookingReference || shipment?.bookingReference || bookingId,
              bookingObjectId: booking?._id?.toString(),
              shipmentObjectId: shipment?._id?.toString(),
              ...locationData
            });
          });

          io.to(`user:${userId}`).emit('tracking:location', {
            bookingId,
            reference: booking?.bookingReference || shipment?.bookingReference || bookingId,
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

        const { booking, shipment } = await resolveTrackingTarget(bookingId);

        if (!booking && !shipment) {
          return socket.emit('error', { message: 'Tracking record not found' });
        }

        // Verify user has access to this booking
        const isShipper = booking?.shipper?.toString() === userId || shipment?.shipper?.toString() === userId;
        const isTransporter = booking?.transporter?.toString() === userId || shipment?.transporter?.toString() === userId;
        let isDriver = false;
        if (!isShipper && !isTransporter && userRole === 'driver') {
          const driverId = await getSocketDriverId(socket);
          isDriver = Boolean(driverId && shipment?.assignedDriver?.toString() === driverId);
        }

        if (!isShipper && !isTransporter && !isDriver) {
          return socket.emit('error', { message: 'Access denied' });
        }

        // Join every room alias clients may use: booking id, booking reference, shipment id.
        const rooms = trackingRoomsFor(bookingId, booking, shipment);
        rooms.forEach(room => socket.join(room));
        socket.data.trackingSubscriptions.set(bookingId, rooms);

        // Send current transporter location if available
        const transporterId = booking?.transporter || shipment?.transporter;
        if (transporterId) {
          const currentLocation = transporterLocations.get(transporterId.toString());
          if (currentLocation) {
            socket.emit('tracking:location', {
              bookingId,
              reference: booking?.bookingReference || shipment?.bookingReference || bookingId,
              bookingObjectId: booking?._id?.toString(),
              shipmentObjectId: shipment?._id?.toString(),
              ...currentLocation
            });
          }
        }

        socket.emit('tracking:subscribed', {
          bookingId,
          reference: booking?.bookingReference || shipment?.bookingReference || bookingId,
          bookingObjectId: booking?._id?.toString(),
          shipmentObjectId: shipment?._id?.toString(),
          status: shipment?.status || booking?.status
        });
      } catch (error) {
        console.error('Tracking subscribe error:', error);
        socket.emit('error', { message: 'Failed to subscribe to tracking' });
      }
    });

    socket.on('tracking:unsubscribe', (data) => {
      const { bookingId } = data;
      const rooms = socket.data.trackingSubscriptions?.get(bookingId) || [`tracking:${bookingId}`];
      rooms.forEach(room => socket.leave(room));
      socket.data.trackingSubscriptions?.delete(bookingId);
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

        // Push a lifecycle notification (fire-and-forget). booking.shipper/user is
        // the customer; reuse the shipment-status copy keyed on the same statuses.
        notificationService.notifyShipmentStatus(
          { _id: booking._id, booking: booking._id, shipper: booking.shipper || booking.user, transporter: booking.transporter },
          status
        ).catch((err) => console.error('Socket status notification failed:', err.message));

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
    // Chat rooms are always named by the canonical Booking _id so that clients holding
    // different identifiers (booking _id vs bookingReference) land in the same room.
    const chatRoomAliases = new Map(); // requested bookingId -> canonical room name

    const chatRoomFor = (bookingId) => chatRoomAliases.get(String(bookingId)) || `chat:${bookingId}`;

    socket.on('chat:join', async (data) => {
      try {
        const { bookingId } = data;
        const booking = await chatService.assertBookingChatAccess(bookingId, socket.user);
        const room = `chat:${booking._id}`;
        chatRoomAliases.set(String(bookingId), room);
        socket.join(room);
        socket.emit('chat:joined', { bookingId, canonicalBookingId: booking._id.toString() });
      } catch (error) {
        socket.emit('error', { message: error.message || 'Failed to join chat' });
      }
    });

    socket.on('chat:message', async (data) => {
      try {
        const { bookingId, message } = data;

        const chatMessage = await chatService.sendMessage({
          bookingId,
          user: socket.user,
          message
        });

        // Broadcast to the canonical chat room (serialized bookingId is the Booking _id)
        io.to(`chat:${chatMessage.bookingId}`).emit('chat:newMessage', {
          ...chatMessage,
          sender: undefined
        });
      } catch (error) {
        console.error('Chat message error:', error);
        socket.emit('error', { message: error.message || 'Failed to send chat message' });
      }
    });

    socket.on('chat:leave', (data) => {
      const { bookingId } = data;
      const room = chatRoomFor(bookingId);
      chatRoomAliases.delete(String(bookingId));
      socket.leave(room);
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
      socket.to(chatRoomFor(bookingId)).emit('chat:userTyping', {
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
  const cargo = booking.cargoDetails || booking.cargo || {};
  const total = booking.pricing?.totals?.total || booking.pricing?.total || booking.totalAmount || 0;

  io.to('jobs:available').emit('jobs:new', {
    bookingId: booking._id,
    pickup: booking.route.pickup,
    delivery: booking.route.delivery,
    cargoType: cargo.type,
    weight: cargo.weight,
    price: total,
    pickupDate: booking.route.pickup.date || booking.route.pickup.scheduledDate
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

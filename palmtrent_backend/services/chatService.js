const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const ChatMessage = require('../models/ChatMessage');
const Driver = require('../models/Driver');
const Shipment = require('../models/Shipment');

// Accepts either a Booking ObjectId or a bookingReference (e.g. "PT-mr56awe8-66TPLD"),
// so callers that only hold a reference (driver flows) can still open the conversation.
const resolveBooking = async (bookingIdOrRef) => {
  const value = String(bookingIdOrRef || '').trim();
  if (!value) return null;

  const select = 'shipper user transporter corporateAccount bookingReference';
  if (mongoose.Types.ObjectId.isValid(value)) {
    const byId = await Booking.findById(value).select(select);
    if (byId) return byId;
  }
  return Booking.findOne({ bookingReference: value }).select(select);
};

const isParticipant = (booking, user) => {
  const userId = (user.id || user._id).toString();
  return booking.shipper?.toString() === userId ||
    booking.user?.toString() === userId ||
    booking.transporter?.toString() === userId ||
    (user.corporateAccount && booking.corporateAccount?.toString() === user.corporateAccount.toString()) ||
    user.userType === 'admin';
};

// The driver assigned to carry a booking's shipment is also a chat participant,
// so the shipper/transporter and the driver share one booking conversation.
const isAssignedDriver = async (booking, user) => {
  if (user.userType !== 'driver') return false;
  const driver = await Driver.findOne({ user: user.id || user._id }).select('_id');
  if (!driver) return false;
  const shipment = await Shipment.findOne({
    $or: [{ booking: booking._id }, { bookingReference: booking.bookingReference }],
    assignedDriver: driver._id
  }).select('_id');
  return Boolean(shipment);
};

const assertBookingChatAccess = async (bookingId, user) => {
  const booking = await resolveBooking(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (!isParticipant(booking, user) && !(await isAssignedDriver(booking, user))) {
    const error = new Error('Not authorized to access this booking chat');
    error.statusCode = 403;
    throw error;
  }

  return booking;
};

const serializeMessage = (message, currentUserId) => {
  const sender = message.sender || {};
  const senderId = sender._id || sender;
  const senderIdString = senderId?.toString?.() || senderId;

  return {
    id: message._id.toString(),
    bookingId: message.booking.toString(),
    text: message.message,
    message: message.message,
    senderId: senderIdString,
    senderName: sender.fullName || sender.name || 'User',
    senderRole: message.senderRole,
    sender: senderIdString === currentUserId?.toString() ? 'me' : 'other',
    timestamp: message.createdAt,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  };
};

const listMessages = async ({ bookingId, user, limit = 50, before }) => {
  const booking = await assertBookingChatAccess(bookingId, user);

  const query = { booking: booking._id };
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await ChatMessage.find(query)
    .populate('sender', 'fullName name userType')
    .sort({ createdAt: -1 })
    .limit(Math.min(parseInt(limit, 10) || 50, 100));

  return messages
    .reverse()
    .map(message => serializeMessage(message, user.id || user._id));
};

const sendMessage = async ({ bookingId, user, message }) => {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    const error = new Error('Message is required');
    error.statusCode = 400;
    throw error;
  }

  const booking = await assertBookingChatAccess(bookingId, user);

  const chatMessage = await ChatMessage.create({
    booking: booking._id,
    sender: user.id || user._id,
    senderRole: user.userType,
    message: trimmed,
    readBy: [{ user: user.id || user._id }]
  });

  await chatMessage.populate('sender', 'fullName name userType');
  return serializeMessage(chatMessage, user.id || user._id);
};

const markRead = async ({ bookingId, user }) => {
  const booking = await assertBookingChatAccess(bookingId, user);

  await ChatMessage.updateMany(
    {
      booking: booking._id,
      sender: { $ne: user.id || user._id },
      'readBy.user': { $ne: user.id || user._id }
    },
    {
      $addToSet: {
        readBy: { user: user.id || user._id, readAt: new Date() }
      }
    }
  );

  return { success: true };
};

module.exports = {
  assertBookingChatAccess,
  listMessages,
  sendMessage,
  markRead,
  serializeMessage
};

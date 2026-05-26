const Booking = require('../models/Booking');
const ChatMessage = require('../models/ChatMessage');

const isParticipant = (booking, user) => {
  const userId = (user.id || user._id).toString();
  return booking.shipper?.toString() === userId ||
    booking.user?.toString() === userId ||
    booking.transporter?.toString() === userId ||
    (user.corporateAccount && booking.corporateAccount?.toString() === user.corporateAccount.toString()) ||
    user.userType === 'admin';
};

const assertBookingChatAccess = async (bookingId, user) => {
  const booking = await Booking.findById(bookingId).select('shipper user transporter corporateAccount bookingReference');
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (!isParticipant(booking, user)) {
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
  await assertBookingChatAccess(bookingId, user);

  const query = { booking: bookingId };
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

  await assertBookingChatAccess(bookingId, user);

  const chatMessage = await ChatMessage.create({
    booking: bookingId,
    sender: user.id || user._id,
    senderRole: user.userType,
    message: trimmed,
    readBy: [{ user: user.id || user._id }]
  });

  await chatMessage.populate('sender', 'fullName name userType');
  return serializeMessage(chatMessage, user.id || user._id);
};

const markRead = async ({ bookingId, user }) => {
  await assertBookingChatAccess(bookingId, user);

  await ChatMessage.updateMany(
    {
      booking: bookingId,
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

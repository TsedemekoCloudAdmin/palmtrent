const chatService = require('../services/chatService');

exports.getMessages = async (req, res) => {
  try {
    const messages = await chatService.listMessages({
      bookingId: req.params.bookingId,
      user: req.user,
      limit: req.query.limit,
      before: req.query.before
    });

    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to load chat messages'
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const message = await chatService.sendMessage({
      bookingId: req.params.bookingId,
      user: req.user,
      message: req.body.message || req.body.text
    });

    const io = req.app.get('io');
    if (io) {
      // message.bookingId is the canonical Booking _id even when the route param
      // was a bookingReference, so this reaches everyone in the chat room.
      io.to(`chat:${message.bookingId}`).emit('chat:newMessage', {
        ...message,
        sender: undefined
      });
    }

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to send chat message'
    });
  }
};

exports.markRead = async (req, res) => {
  try {
    await chatService.markRead({
      bookingId: req.params.bookingId,
      user: req.user
    });

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to mark messages as read'
    });
  }
};

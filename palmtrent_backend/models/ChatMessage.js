const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderRole: {
    type: String,
    enum: ['shipper', 'transporter', 'trailer_owner', 'corporate', 'admin'],
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

chatMessageSchema.index({ booking: 1, createdAt: -1 });
chatMessageSchema.index({ sender: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);

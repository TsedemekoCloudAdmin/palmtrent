const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticketReference: {
    type: String,
    unique: true,
    index: true
  },
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  requesterRole: {
    type: String,
    enum: ['shipper', 'transporter', 'trailer_owner', 'corporate', 'admin'],
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'booking', 'payment', 'technical', 'account', 'safety', 'dispute', 'other'],
    default: 'general',
    index: true
  },
  subject: {
    type: String,
    trim: true,
    maxlength: 140,
    default: 'Support request'
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 4000
  },
  contact: {
    name: String,
    email: String,
    phone: String
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  source: {
    type: String,
    enum: ['mobile', 'web', 'admin', 'api'],
    default: 'mobile'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  status: {
    type: String,
    enum: ['open', 'pending', 'resolved', 'closed'],
    default: 'open',
    index: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  conversation: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorRole: String,
    message: { type: String, trim: true, maxlength: 4000 },
    internal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  resolvedAt: Date,
  closedAt: Date
}, {
  timestamps: true
});

supportTicketSchema.pre('validate', function(next) {
  if (!this.ticketReference) {
    const stamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    this.ticketReference = `SUP-${stamp}-${random}`;
  }
  next();
});

supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ requester: 1, createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);

const mongoose = require('mongoose');

const platformLedgerSchema = new mongoose.Schema({
  entryReference: {
    type: String,
    unique: true,
    default: () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).slice(2, 8).toUpperCase();
      return `LED-${timestamp}-${random}`;
    }
  },
  sourceType: {
    type: String,
    enum: ['booking', 'rental', 'subscription', 'emergency', 'manual_adjustment', 'payout'],
    required: true,
    index: true
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  direction: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  category: {
    type: String,
    enum: ['platform_fee', 'commission', 'subscription_fee', 'payout', 'refund', 'adjustment'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'posted', 'reversed'],
    default: 'posted',
    index: true
  },
  metadata: mongoose.Schema.Types.Mixed,
  postedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

platformLedgerSchema.index({ category: 1, status: 1, postedAt: -1 });
platformLedgerSchema.index({ user: 1, postedAt: -1 });

module.exports = mongoose.model('PlatformLedger', platformLedgerSchema);

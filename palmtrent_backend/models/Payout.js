const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  payoutReference: {
    type: String,
    unique: true,
    default: () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).slice(2, 8).toUpperCase();
      return `PO-${timestamp}-${random}`;
    }
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sourceType: {
    type: String,
    enum: ['booking', 'rental', 'manual'],
    required: true
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  method: {
    type: String,
    enum: ['bank_transfer', 'ecocash', 'onemoney', 'cash', 'openapi_africa'],
    default: 'bank_transfer'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'processing', 'paid', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  destination: {
    accountName: String,
    accountNumber: String,
    bankName: String,
    phone: String
  },
  gatewayReference: String,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  paidAt: Date,
  failureReason: String,
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

payoutSchema.index({ status: 1, createdAt: -1 });
payoutSchema.index({ sourceType: 1, sourceId: 1 });
payoutSchema.index(
  { recipient: 1, sourceType: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $exists: true } } }
);

module.exports = mongoose.model('Payout', payoutSchema);

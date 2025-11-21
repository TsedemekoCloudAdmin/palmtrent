const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  corporateAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateAccount',
    required: true
  },
  billingPeriod: {
    start: Date,
    end: Date
  },
  dueDate: Date,
  status: {
    type: String,
    enum: ['draft', 'sent', 'overdue', 'paid', 'cancelled'],
    default: 'draft'
  },
  items: [{
    description: String,
    bookingReference: String,
    shipmentId: String,
    quantity: Number,
    unitPrice: Number,
    amount: Number
  }],
  subtotal: Number,
  taxAmount: Number,
  total: Number,
  currency: {
    type: String,
    default: 'USD'
  },
  payments: [{
    amount: Number,
    method: String,
    reference: String,
    paidAt: Date
  }],
  notes: String
}, {
  timestamps: true
});

// Generate invoice number before save
invoiceSchema.pre('save', function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.invoiceNumber = `INV-${year}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
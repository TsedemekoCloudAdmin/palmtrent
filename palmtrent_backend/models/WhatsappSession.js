const mongoose = require('mongoose');

// Persists WhatsApp conversational-booking session state so it survives server
// restarts and works across multiple instances/workers (the in-memory Map alone
// would lose state on restart and not be shared between processes).
const whatsappSessionSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  state: {
    type: String,
    default: 'IDLE'
  },
  context: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.WhatsappSession
  || mongoose.model('WhatsappSession', whatsappSessionSchema);

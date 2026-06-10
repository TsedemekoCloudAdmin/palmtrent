const mongoose = require('mongoose');

// A PalmTrent depot / warehouse / bus-station counter where agents (clerks)
// accept and release courier goods.
const depotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  city: { type: String, required: true },
  address: String,
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  phone: String,
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

depotSchema.index({ city: 1, isActive: 1 });

module.exports = mongoose.models.Depot || mongoose.model('Depot', depotSchema);

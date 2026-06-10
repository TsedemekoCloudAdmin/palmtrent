const mongoose = require('mongoose');

// Bus/depot courier shipment: a PalmTrent agent accepts goods at an origin depot
// (bus station), they travel by bus to a destination depot, and are then either
// collected by the recipient or broadcast for last-mile delivery.
const COURIER_STATUSES = [
  'created',            // captured by agent, label generated
  'loaded',             // loaded onto the bus
  'in_transit',         // bus departed
  'arrived',            // scanned in at destination depot
  'awaiting_collection',// recipient will collect from depot
  'awaiting_delivery',  // queued for last-mile transporter
  'out_for_delivery',   // a transporter accepted the last-mile leg
  'collected',          // handed over to a collector at the depot
  'delivered',          // delivered to destination address
  'cancelled'
];

const partySchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  weight: { type: Number, default: 0 }, // kg
  value: { type: Number, default: 0 }
}, { _id: false });

const historySchema = new mongoose.Schema({
  status: String,
  at: { type: Date, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  location: String,
  note: String
}, { _id: false });

const courierShipmentSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, uppercase: true },
  // Locally-generated QR code (PNG data URI) — no external service needed.
  qrImage: String,

  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  originDepot: { type: mongoose.Schema.Types.ObjectId, ref: 'Depot' },
  destinationDepot: { type: mongoose.Schema.Types.ObjectId, ref: 'Depot' },
  // Denormalised names so labels/notifications never have to resolve refs.
  originName: String,
  destinationName: String,

  sender: { type: partySchema, required: true },
  recipient: { type: partySchema, required: true },
  // Extra people who receive SMS updates (no app required).
  alternateContacts: [partySchema],
  // Registered users the sender shared the shipment with (in-app tracking).
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  items: { type: [itemSchema], default: [] },
  packageCount: { type: Number, default: 1 },
  totalWeight: { type: Number, default: 0 },

  // How the recipient receives the goods at the destination.
  deliveryPreference: { type: String, enum: ['collection', 'delivery'], required: true },
  deliveryAddress: {
    address: String,
    city: String,
    coordinates: { latitude: Number, longitude: Number }
  },

  pricing: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    paymentMethod: { type: String, default: 'cash' },
    paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' }
  },

  bus: {
    operator: String,
    plateNumber: String,
    departureTime: Date,
    expectedArrival: Date
  },

  // Captured when goods are handed to a collector at the depot.
  handover: {
    name: String,
    idNumber: String,
    idPhotoUrl: String,
    facePhotoUrl: String,
    collectedAt: Date,
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },

  // Last-mile delivery leg (reuses the transporter booking/broadcast pipeline).
  deliveryBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },

  status: { type: String, enum: COURIER_STATUSES, default: 'created' },
  statusHistory: { type: [historySchema], default: [] },

  cancelledReason: String
}, { timestamps: true });

courierShipmentSchema.index({ agent: 1, status: 1 });
courierShipmentSchema.index({ 'sender.user': 1 });
courierShipmentSchema.index({ sharedWith: 1 });
courierShipmentSchema.index({ destinationDepot: 1, status: 1 });

courierShipmentSchema.statics.STATUSES = COURIER_STATUSES;

module.exports = mongoose.models.CourierShipment
  || mongoose.model('CourierShipment', courierShipmentSchema);

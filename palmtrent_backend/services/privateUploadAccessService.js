const Booking = require('../models/Booking');
const InsuranceClaim = require('../models/InsuranceClaim');
const Shipment = require('../models/Shipment');
const podService = require('./podService');
const {
  canReadBooking,
  isUploadOwnedByUser
} = require('./resourceAccessService');

const urlVariants = (type, filename) => [
  `/api/v1/uploads/${type}/${filename}`,
  `/uploads/${type}/${filename}`
];

const shipmentPartyQuery = (user) => ({
  $or: [
    { shipper: user._id },
    { transporter: user._id }
  ]
});

const bookingPartyQuery = (user) => ({
  $or: [
    { user: user._id },
    { shipper: user._id },
    { transporter: user._id }
  ]
});

const canReadShipmentUpload = async (user, type, filename) => {
  const variants = urlVariants(type, filename);
  const evidenceQuery = type === 'pod'
    ? {
      $or: [
        { 'pickupDetails.photos': { $in: variants } },
        { 'deliveryDetails.photos': { $in: variants } },
        { 'proofOfDelivery.photos': { $in: variants } }
      ]
    }
    : {
      $or: [
        { 'pickupDetails.signature': { $in: variants } },
        { 'deliveryDetails.signature': { $in: variants } },
        { 'proofOfDelivery.signature': { $in: variants } }
      ]
    };

  return Boolean(await Shipment.exists({
    $and: [
      shipmentPartyQuery(user),
      evidenceQuery
    ]
  }));
};

const canReadClaimUpload = async (user, filename) => {
  const claim = await InsuranceClaim.findOne({
    'documents.url': { $in: urlVariants('claims', filename) }
  }).populate('booking');

  if (!claim) return false;
  if (claim.claimant?.user?.toString() === user._id.toString()) return true;
  return canReadBooking(user, claim.booking);
};

const canReadBookingDocument = async (user, filename) => {
  return Boolean(await Booking.exists({
    $and: [
      bookingPartyQuery(user),
      { 'crossBorder.documents.url': { $in: urlVariants('documents', filename) } }
    ]
  }));
};

const canAccessPrivateUpload = async (user, type, filename) => {
  if (isUploadOwnedByUser(filename, user)) return true;

  if (type === 'pod' || type === 'signatures') {
    return canReadShipmentUpload(user, type, filename);
  }
  if (type === 'pod-documents') {
    return podService.canReadPDFUpload(user, filename);
  }
  if (type === 'claims') {
    return canReadClaimUpload(user, filename);
  }
  if (type === 'documents') {
    return canReadBookingDocument(user, filename);
  }

  return false;
};

module.exports = {
  canAccessPrivateUpload,
  urlVariants
};

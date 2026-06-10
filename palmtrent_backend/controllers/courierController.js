const mongoose = require('mongoose');
const net = require('net');
const QRCode = require('qrcode');
const CourierShipment = require('../models/CourierShipment');
const Depot = require('../models/Depot');
const Booking = require('../models/Booking');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const matchingService = require('../services/matchingService');
const { sendSMS } = require('../utils/sendSMS');

const PUBLIC_TRACKING_BASE = process.env.FRONTEND_URL || 'https://app.palmtrent.com';
const QR_ENDPOINT = process.env.QR_IMAGE_ENDPOINT || 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=';

// Weight-based courier pricing (configurable). Charge = base handling fee +
// per-kg rate × billable weight, plus a surcharge when last-mile delivery is
// required. Billable weight is rounded up to the nearest kg (minimum 1kg).
const COURIER_BASE_FEE = Number(process.env.COURIER_BASE_FEE) || 2;
const COURIER_RATE_PER_KG = Number(process.env.COURIER_RATE_PER_KG) || 0.5;
const COURIER_DELIVERY_SURCHARGE = Number(process.env.COURIER_DELIVERY_SURCHARGE) || 3;
const round2 = (n) => Math.round(n * 100) / 100;

function totalWeightOf(items = []) {
  return (items || []).reduce((sum, it) => sum + (Number(it.weight) || 0) * (Number(it.quantity) || 1), 0);
}

function quoteCourier({ totalWeight = 0, deliveryPreference = 'collection' }) {
  const billableWeight = Math.max(1, Math.ceil(Number(totalWeight) || 0));
  const weightCharge = round2(billableWeight * COURIER_RATE_PER_KG);
  const deliverySurcharge = deliveryPreference === 'delivery' ? COURIER_DELIVERY_SURCHARGE : 0;
  const amount = round2(COURIER_BASE_FEE + weightCharge + deliverySurcharge);
  return {
    currency: 'USD',
    baseFee: COURIER_BASE_FEE,
    ratePerKg: COURIER_RATE_PER_KG,
    billableWeight,
    weightCharge,
    deliverySurcharge,
    amount
  };
}

// ---- helpers ---------------------------------------------------------------

function generateReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0');
  return `CR-${stamp}${rand}`;
}

// Generate a QR PNG data URI locally (no external service).
async function generateQrDataUri(text) {
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 320, errorCorrectionLevel: 'Q' });
  } catch (error) {
    console.error('QR generation error:', error.message);
    return null;
  }
}

// Ensure the shipment has a locally-generated QR; backfill older records.
async function ensureQr(shipment) {
  if (!shipment.qrImage) {
    shipment.qrImage = await generateQrDataUri(`${PUBLIC_TRACKING_BASE}/track/${shipment.reference}`);
    if (shipment.qrImage && typeof shipment.save === 'function') {
      try { await shipment.save(); } catch (e) { /* non-fatal */ }
    }
  }
  return shipment.qrImage;
}

function buildLabel(shipment) {
  const trackingUrl = `${PUBLIC_TRACKING_BASE}/track/${shipment.reference}`;
  return {
    code: shipment.reference,
    trackingUrl,
    // Prefer the locally-generated QR; fall back to the external endpoint only
    // if generation was unavailable.
    qrImageUrl: shipment.qrImage || `${QR_ENDPOINT}${encodeURIComponent(shipment.reference)}`,
    sender: shipment.sender?.name,
    recipient: shipment.recipient?.name,
    recipientPhone: shipment.recipient?.phone,
    origin: shipment.originName,
    destination: shipment.destinationName,
    deliveryPreference: shipment.deliveryPreference,
    packageCount: shipment.packageCount,
    totalWeight: shipment.totalWeight,
    items: shipment.items,
    issuedAt: shipment.createdAt
  };
}

// ---- ZPL (Zebra label printers) -------------------------------------------

// Strip ZPL control chars and clamp length so field data can't break the format.
const zsafe = (v, max = 40) => String(v == null ? '' : v).replace(/[\^~]/g, ' ').slice(0, max);

// Build a ZPL II label (~100x150mm @ 203dpi). The QR is rendered natively by the
// printer via ^BQ, so no raster image is needed. `copies` prints one label per
// item/package via the ^PQ command.
function buildZpl(shipment, copies = 1) {
  const isDelivery = shipment.deliveryPreference === 'delivery';
  const tag = isDelivery ? 'DELIVER' : 'COLLECT';
  const trackingUrl = `${PUBLIC_TRACKING_BASE}/track/${shipment.reference}`;
  const qty = Math.max(1, Math.min(50, Number(copies) || 1));
  return [
    '^XA',
    '^CI28',
    `^PQ${qty},0,0,N`,
    '^PW812',
    '^LL1218',
    '^LH0,0',
    '^FO30,30^A0N,70,70^FDPALMTRENT^FS',
    '^FO520,25^GB260,80,80^FS',
    `^FO545,40^A0N,50,50^FR^FD${tag}^FS`,
    `^FO250,130^BQN,2,9^FDQA,${zsafe(trackingUrl, 120)}^FS`,
    `^FO30,510^A0N,95,95^FD${zsafe(shipment.reference, 18)}^FS`,
    `^FO30,625^A0N,42,42^FDFROM ${zsafe((shipment.originName || '').toUpperCase(), 28)}^FS`,
    `^FO30,680^A0N,60,60^FDTO ${zsafe((shipment.destinationName || '').toUpperCase(), 26)}^FS`,
    '^FO30,765^GB752,4,4^FS',
    '^FO30,785^A0N,36,36^FDRECIPIENT^FS',
    `^FO30,828^A0N,80,80^FD${zsafe(shipment.recipient?.name, 22)}^FS`,
    `^FO30,918^A0N,55,55^FD${zsafe(shipment.recipient?.phone, 20)}^FS`,
    '^FO30,995^GB752,4,4^FS',
    `^FO30,1010^A0N,44,44^FD${shipment.packageCount || 1} ITEMS   ${Number(shipment.totalWeight || 0)} KG   ${tag}^FS`,
    `^FO30,1070^A0N,34,34^FDFROM: ${zsafe(shipment.sender?.name, 30)}^FS`,
    '^XZ'
  ].join('\n');
}

// Send raw ZPL to a networked label printer (Zebra raw TCP port 9100).
function sendRawToPrinter(host, port, data) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 5000 }, () => {
      socket.write(data, () => socket.end());
    });
    socket.on('error', reject);
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Connection timed out')); });
    socket.on('close', () => resolve());
  });
}

function pushHistory(shipment, status, userId, note, location) {
  shipment.statusHistory.push({ status, by: userId, note, location, at: new Date() });
}

// In-app + push to the sender and any shared users; SMS to everyone without the app.
async function notifyCourierParties(shipment, title, body, extraData = {}) {
  const data = { reference: shipment.reference, courierShipmentId: String(shipment._id), ...extraData };

  const appUserIds = new Set();
  if (shipment.sender?.user) appUserIds.add(String(shipment.sender.user));
  (shipment.sharedWith || []).forEach(id => appUserIds.add(String(id)));

  await Promise.allSettled([...appUserIds].map(id =>
    notificationService.notify(id, 'courier_update', title, body, data)
  ));

  // SMS recipients: sender, recipient and any alternate contacts (deduped).
  const phones = new Set();
  [shipment.sender?.phone, shipment.recipient?.phone].forEach(p => p && phones.add(p));
  (shipment.alternateContacts || []).forEach(c => c?.phone && phones.add(c.phone));
  await Promise.allSettled([...phones].map(phone =>
    sendSMS(phone, `PalmTrent ${shipment.reference}: ${body}`)
  ));
}

function canAgentManage(user) {
  return ['clerk', 'admin'].includes(user.userType);
}

// Lazily reflect the last-mile booking's completion onto the courier shipment so
// we don't have to hook the transporter delivery flow.
async function syncFromDeliveryBooking(shipment) {
  if (!shipment.deliveryBooking || shipment.status === 'delivered') return shipment;
  const booking = await Booking.findById(shipment.deliveryBooking).select('status');
  if (!booking) return shipment;
  if (['matched', 'in_progress', 'picked_up', 'in_transit'].includes(booking.status) && shipment.status === 'awaiting_delivery') {
    shipment.status = 'out_for_delivery';
    pushHistory(shipment, 'out_for_delivery', null, 'Transporter assigned for last-mile delivery');
    await shipment.save();
    await notifyCourierParties(shipment, 'Out for delivery', `Your shipment ${shipment.reference} is out for delivery.`);
  } else if (['delivered', 'completed'].includes(booking.status)) {
    shipment.status = 'delivered';
    pushHistory(shipment, 'delivered', null, 'Last-mile delivery completed');
    await shipment.save();
    await notifyCourierParties(shipment, 'Delivered', `Your shipment ${shipment.reference} has been delivered.`);
  }
  return shipment;
}

// ---- depots ----------------------------------------------------------------

exports.listDepots = async (req, res) => {
  try {
    const depots = await Depot.find({ isActive: true }).sort({ city: 1, name: 1 });
    res.json({ success: true, data: depots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDepot = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can create depots' });
    }
    const depot = await Depot.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json({ success: true, data: depot });
  } catch (error) {
    res.status(error.code === 11000 ? 400 : 500).json({
      success: false,
      message: error.code === 11000 ? 'A depot with this code already exists' : error.message
    });
  }
};

// Live weight-based quote for the create form.
exports.quote = async (req, res) => {
  try {
    const totalWeight = req.body.totalWeight != null ? Number(req.body.totalWeight) : totalWeightOf(req.body.items);
    res.json({ success: true, data: quoteCourier({ totalWeight, deliveryPreference: req.body.deliveryPreference }) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---- shipment lifecycle ----------------------------------------------------

exports.createShipment = async (req, res) => {
  try {
    if (!canAgentManage(req.user)) {
      return res.status(403).json({ success: false, message: 'Only PalmTrent agents can create courier shipments' });
    }

    const {
      originDepot, destinationDepot, originName, destinationName,
      sender, recipient, alternateContacts = [], items = [],
      deliveryPreference, deliveryAddress, pricing = {}, bus = {}
    } = req.body;

    if (!sender?.name || !sender?.phone) {
      return res.status(400).json({ success: false, message: "Sender name and phone are required" });
    }
    if (!recipient?.name || !recipient?.phone) {
      return res.status(400).json({ success: false, message: "Recipient name and phone are required" });
    }
    if (!['collection', 'delivery'].includes(deliveryPreference)) {
      return res.status(400).json({ success: false, message: 'deliveryPreference must be collection or delivery' });
    }
    if (deliveryPreference === 'delivery' && !deliveryAddress?.address) {
      return res.status(400).json({ success: false, message: 'A delivery address is required for delivery shipments' });
    }
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    // Link a registered sender by phone so they can track in-app.
    let senderUser = null;
    if (sender.phone) senderUser = await User.findOne({ phone: sender.phone }).select('_id');

    const [originDepotDoc, destinationDepotDoc] = await Promise.all([
      originDepot ? Depot.findById(originDepot) : null,
      destinationDepot ? Depot.findById(destinationDepot) : null
    ]);

    const totalWeight = totalWeightOf(items);
    const packageCount = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);

    // Charge per weight. The agent may override the computed amount if needed.
    const quote = quoteCourier({ totalWeight, deliveryPreference });
    const chargeAmount = Number(pricing.amount) > 0 ? Number(pricing.amount) : quote.amount;

    const reference = generateReference();
    const qrImage = await generateQrDataUri(`${PUBLIC_TRACKING_BASE}/track/${reference}`);

    const shipment = await CourierShipment.create({
      reference,
      qrImage,
      agent: req.user.id,
      originDepot: originDepotDoc?._id,
      destinationDepot: destinationDepotDoc?._id,
      originName: originName || originDepotDoc?.name || originDepotDoc?.city,
      destinationName: destinationName || destinationDepotDoc?.name || destinationDepotDoc?.city,
      sender: { ...sender, user: senderUser?._id },
      recipient,
      alternateContacts,
      items,
      packageCount,
      totalWeight,
      deliveryPreference,
      deliveryAddress: deliveryPreference === 'delivery' ? deliveryAddress : undefined,
      pricing: {
        amount: chargeAmount,
        currency: pricing.currency || 'USD',
        paymentMethod: pricing.paymentMethod || 'cash',
        // Payment is taken at the booking/loading point (the depot counter).
        paymentStatus: pricing.paymentStatus === 'paid' ? 'paid' : 'unpaid'
      },
      bus,
      status: 'created',
      statusHistory: [{ status: 'created', by: req.user.id, note: 'Shipment captured at origin depot', location: originName || originDepotDoc?.name }]
    });

    await notifyCourierParties(shipment, 'Shipment created',
      `Your goods (${shipment.reference}) were received at ${shipment.originName || 'the depot'} for ${shipment.destinationName || 'destination'}.`);

    res.status(201).json({ success: true, data: shipment, label: buildLabel(shipment) });
  } catch (error) {
    console.error('createShipment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLabel = async (req, res) => {
  try {
    const shipment = await CourierShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    await ensureQr(shipment);
    res.json({ success: true, data: buildLabel(shipment) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Return ZPL for a shipment (download / pipe to a Zebra printer).
exports.getZpl = async (req, res) => {
  try {
    if (!canAgentManage(req.user)) return res.status(403).json({ success: false, message: 'Agents only' });
    const shipment = await CourierShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    // Default to one label per package; allow an explicit override.
    const copies = req.query.copies ? Number(req.query.copies) : (shipment.packageCount || 1);
    const zpl = buildZpl(shipment, copies);
    if (req.query.raw === '1') {
      res.set('Content-Type', 'text/plain');
      res.set('Content-Disposition', `attachment; filename="${shipment.reference}.zpl"`);
      return res.send(zpl);
    }
    res.json({ success: true, data: { reference: shipment.reference, zpl } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send the ZPL label directly to a networked Zebra printer (raw TCP 9100).
exports.printZpl = async (req, res) => {
  try {
    if (!canAgentManage(req.user)) return res.status(403).json({ success: false, message: 'Agents only' });
    const shipment = await CourierShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    const printerIp = req.body.printerIp;
    const port = Number(req.body.port) || 9100;
    if (!printerIp) return res.status(400).json({ success: false, message: 'printerIp is required' });
    const copies = req.body.copies ? Number(req.body.copies) : (shipment.packageCount || 1);
    try {
      await sendRawToPrinter(printerIp, port, buildZpl(shipment, copies));
      res.json({ success: true, message: `${Math.max(1, copies)} label(s) sent to printer ${printerIp}` });
    } catch (printError) {
      res.status(502).json({ success: false, message: `Could not reach printer: ${printError.message}` });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listShipments = async (req, res) => {
  try {
    if (!canAgentManage(req.user)) {
      return res.status(403).json({ success: false, message: 'Agents only' });
    }
    const { status, search, depot } = req.query;
    const query = {};
    if (status) query.status = status;
    // Arrivals view: shipments inbound to a destination depot.
    if (req.query.incoming === 'true') {
      query.status = { $in: ['in_transit', 'arrived', 'awaiting_collection', 'awaiting_delivery', 'out_for_delivery'] };
    }
    // A clerk's own bookings, optionally limited to today.
    if (req.query.mine === 'true') query.agent = req.user.id;
    if (req.query.today === 'true') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: start };
    }
    if (depot) query.$or = [{ originDepot: depot }, { destinationDepot: depot }];
    if (search) {
      query.$or = [
        { reference: new RegExp(search, 'i') },
        { 'recipient.phone': new RegExp(search, 'i') },
        { 'sender.phone': new RegExp(search, 'i') }
      ];
    }
    const shipments = await CourierShipment.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('originDepot destinationDepot', 'name city code');

    const summary = {
      count: shipments.length,
      totalCollected: shipments.reduce((sum, s) => sum + (s.pricing?.paymentStatus === 'paid' ? (s.pricing?.amount || 0) : 0), 0),
      outstanding: shipments.reduce((sum, s) => sum + (s.pricing?.paymentStatus !== 'paid' ? (s.pricing?.amount || 0) : 0), 0)
    };
    res.json({ success: true, data: shipments, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getShipment = async (req, res) => {
  try {
    const byRef = req.params.id && req.params.id.startsWith('CR-');
    let shipment = await CourierShipment.findOne(byRef ? { reference: req.params.id.toUpperCase() } : { _id: req.params.id })
      .populate('originDepot destinationDepot', 'name city code phone')
      .populate('agent', 'fullName phone');
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });

    await ensureQr(shipment);
    await syncFromDeliveryBooking(shipment);

    // Access: agents/admin, the sender, or a shared user.
    const uid = String(req.user.id);
    const allowed = canAgentManage(req.user)
      || String(shipment.sender?.user || '') === uid
      || (shipment.sharedWith || []).some(id => String(id) === uid);
    if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized to view this shipment' });

    res.json({ success: true, data: shipment, label: buildLabel(shipment) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Agent transitions ----------------------------------------------------------

async function transition(req, res, { from, to, statusNote, buildBody, mutate }) {
  if (!canAgentManage(req.user)) {
    return res.status(403).json({ success: false, message: 'Agents only' });
  }
  const shipment = await CourierShipment.findById(req.params.id);
  if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
  if (from && !from.includes(shipment.status)) {
    return res.status(400).json({ success: false, message: `Cannot move from '${shipment.status}'` });
  }
  if (mutate) await mutate(shipment);
  if (to) {
    shipment.status = to;
    pushHistory(shipment, to, req.user.id, statusNote);
  }
  await shipment.save();
  await notifyCourierParties(shipment, statusNote || 'Update', buildBody(shipment));
  return shipment;
}

exports.markLoaded = async (req, res) => {
  try {
    const shipment = await transition(req, res, {
      from: ['created'],
      to: 'loaded',
      statusNote: 'Loaded on bus',
      buildBody: (s) => `Your goods ${s.reference} have been loaded onto the bus${s.bus?.plateNumber ? ` (${s.bus.plateNumber})` : ''}.`,
      mutate: async (s) => { if (req.body.bus) s.bus = { ...s.bus?.toObject?.() || s.bus, ...req.body.bus }; }
    });
    if (shipment) res.json({ success: true, data: shipment });
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ success: false, message: error.message });
  }
};

exports.markDeparted = async (req, res) => {
  try {
    const shipment = await transition(req, res, {
      from: ['loaded'],
      to: 'in_transit',
      statusNote: 'In transit',
      buildBody: (s) => `Your shipment ${s.reference} is now in transit to ${s.destinationName || 'destination'}.`,
      mutate: async (s) => { if (req.body.departureTime) s.bus = { ...(s.bus?.toObject?.() || s.bus || {}), departureTime: req.body.departureTime }; }
    });
    if (shipment) res.json({ success: true, data: shipment });
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ success: false, message: error.message });
  }
};

// Arrival scan at the destination depot. Branches into collection or delivery.
exports.markArrived = async (req, res) => {
  try {
    if (!canAgentManage(req.user)) return res.status(403).json({ success: false, message: 'Agents only' });
    const shipment = await CourierShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    if (!['in_transit', 'loaded'].includes(shipment.status)) {
      return res.status(400).json({ success: false, message: `Cannot arrive from '${shipment.status}'` });
    }

    shipment.status = 'arrived';
    pushHistory(shipment, 'arrived', req.user.id, 'Scanned in at destination depot', shipment.destinationName);

    if (shipment.deliveryPreference === 'collection') {
      shipment.status = 'awaiting_collection';
      pushHistory(shipment, 'awaiting_collection', req.user.id, 'Ready for collection');
      await shipment.save();
      await notifyCourierParties(shipment, 'Ready for collection',
        `Your shipment ${shipment.reference} has arrived at ${shipment.destinationName || 'the depot'} and is ready for collection.`);
    } else {
      shipment.status = 'awaiting_delivery';
      pushHistory(shipment, 'awaiting_delivery', req.user.id, 'Queued for last-mile delivery');
      await shipment.save();
      await broadcastLastMile(shipment, req.user.id);
      await notifyCourierParties(shipment, 'Arrived — arranging delivery',
        `Your shipment ${shipment.reference} arrived at ${shipment.destinationName || 'the depot'}. We are arranging delivery to ${shipment.deliveryAddress?.address || 'the destination'}.`);
    }

    res.json({ success: true, data: shipment });
  } catch (error) {
    console.error('markArrived error:', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: error.message });
  }
};

// Create the last-mile transporter booking and broadcast it to available jobs.
async function broadcastLastMile(shipment, agentId) {
  try {
    const ownerId = shipment.sender?.user || agentId;
    const lastMileFee = Math.max(5, Math.round((shipment.pricing?.amount || 0) * 0.4 * 100) / 100);

    const booking = await Booking.create({
      bookingReference: `${shipment.reference}-D`,
      user: ownerId,
      shipper: ownerId,
      serviceType: 'courier_delivery',
      courierShipment: shipment._id,
      route: {
        pickup: {
          address: shipment.destinationName || 'PalmTrent Depot',
          coordinates: shipment.destinationDepot ? undefined : undefined
        },
        delivery: {
          address: shipment.deliveryAddress?.address,
          city: shipment.deliveryAddress?.city
        }
      },
      origin: shipment.destinationName || 'PalmTrent Depot',
      destination: shipment.deliveryAddress?.address,
      cargoDetails: {
        type: 'Courier parcel',
        weight: shipment.totalWeight,
        description: `Last-mile delivery of courier shipment ${shipment.reference}`
      },
      pricing: {
        totals: { subtotal: lastMileFee, total: lastMileFee, transporterTotal: lastMileFee, platformTotal: 0 },
        currency: shipment.pricing?.currency || 'USD'
      },
      totalAmount: lastMileFee,
      paymentStatus: 'confirmed',
      paymentConfirmedAt: new Date(),
      payment: { status: 'confirmed', method: 'platform' },
      status: 'finding_transporter'
    });

    shipment.deliveryBooking = booking._id;
    await shipment.save();

    // Best-effort: push to eligible transporters. The job is already visible on
    // the available-jobs board via its finding_transporter status regardless.
    try {
      await matchingService.findAndNotifyTransporters(booking._id);
    } catch (matchError) {
      console.error('Courier last-mile broadcast notify error:', matchError.message);
    }
  } catch (error) {
    console.error('broadcastLastMile error:', error.message);
  }
}

// Capture the collector's identity when goods are handed over at the depot.
exports.markCollected = async (req, res) => {
  try {
    if (!canAgentManage(req.user)) return res.status(403).json({ success: false, message: 'Agents only' });
    const shipment = await CourierShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    if (shipment.status !== 'awaiting_collection') {
      return res.status(400).json({ success: false, message: `Cannot collect from '${shipment.status}'` });
    }

    const { name, idNumber, idPhotoUrl, facePhotoUrl } = req.body;
    if (!name || (!idNumber && !idPhotoUrl && !facePhotoUrl)) {
      return res.status(400).json({ success: false, message: "Collector name and at least an ID number or photo are required for records" });
    }

    shipment.handover = {
      name, idNumber, idPhotoUrl, facePhotoUrl,
      collectedAt: new Date(),
      releasedBy: req.user.id
    };
    shipment.status = 'collected';
    pushHistory(shipment, 'collected', req.user.id, `Collected by ${name}${idNumber ? ` (ID ${idNumber})` : ''}`);
    // Collection is the terminal delivery for collection-preference shipments.
    shipment.status = 'delivered';
    pushHistory(shipment, 'delivered', req.user.id, 'Handed over to collector');
    await shipment.save();

    await notifyCourierParties(shipment, 'Collected',
      `Your shipment ${shipment.reference} was collected by ${name} at ${shipment.destinationName || 'the depot'}.`);

    res.json({ success: true, data: shipment });
  } catch (error) {
    console.error('markCollected error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelShipment = async (req, res) => {
  try {
    if (!canAgentManage(req.user)) return res.status(403).json({ success: false, message: 'Agents only' });
    const shipment = await CourierShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    if (['delivered', 'collected', 'cancelled'].includes(shipment.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a ${shipment.status} shipment` });
    }
    shipment.status = 'cancelled';
    shipment.cancelledReason = req.body.reason || 'Cancelled by agent';
    pushHistory(shipment, 'cancelled', req.user.id, shipment.cancelledReason);
    await shipment.save();
    await notifyCourierParties(shipment, 'Shipment cancelled', `Shipment ${shipment.reference} was cancelled.`);
    res.json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Sender / shared-user facing ------------------------------------------------

exports.myShipments = async (req, res) => {
  try {
    const uid = req.user.id;
    const shipments = await CourierShipment.find({
      $or: [{ 'sender.user': uid }, { sharedWith: uid }]
    }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: shipments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Sender adds an extra SMS contact (someone without the app).
exports.addContact = async (req, res) => {
  try {
    const shipment = await CourierShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    const uid = String(req.user.id);
    if (String(shipment.sender?.user || '') !== uid && !canAgentManage(req.user)) {
      return res.status(403).json({ success: false, message: 'Only the sender can add contacts' });
    }
    const { name, phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'A phone number is required' });
    shipment.alternateContacts.push({ name, phone });
    await shipment.save();
    await Promise.allSettled([sendSMS(phone, `You'll now receive PalmTrent updates for shipment ${shipment.reference}.`)]);
    res.json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Sender shares the shipment with another registered user for in-app tracking.
exports.shareShipment = async (req, res) => {
  try {
    const shipment = await CourierShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    const uid = String(req.user.id);
    if (String(shipment.sender?.user || '') !== uid && !canAgentManage(req.user)) {
      return res.status(403).json({ success: false, message: 'Only the sender can share this shipment' });
    }
    const { phone, email } = req.body;
    const target = await User.findOne(phone ? { phone } : { email });
    if (!target) return res.status(404).json({ success: false, message: 'No PalmTrent user found with those details' });
    if (!shipment.sharedWith.some(id => String(id) === String(target._id))) {
      shipment.sharedWith.push(target._id);
      await shipment.save();
    }
    await notificationService.notify(target._id, 'courier_update', 'Shipment shared with you',
      `${shipment.sender?.name || 'Someone'} shared shipment ${shipment.reference} with you. You can now track it.`,
      { reference: shipment.reference, courierShipmentId: String(shipment._id) });
    res.json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

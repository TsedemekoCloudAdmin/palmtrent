// controllers/whatsappController.js
// WhatsApp Business API Controller

const whatsappService = require('../services/whatsappService');
const User = require('../models/User');
const Booking = require('../models/Booking');
const CargoType = require('../models/CargoType');
const VehicleType = require('../models/VehicleType');
const pricingService = require('../services/pricingService');
const monetizationService = require('../services/monetizationService');
const distanceService = require('../services/distanceService');
const Shipment = require('../models/Shipment');
const matchingService = require('../services/matchingService');
const notificationService = require('../services/notificationService');
const { assertTransporterEligible, isPaymentConfirmed, assertBookingTransition } = require('../services/flowControlService');
const { recordAudit } = require('../services/auditService');

// Conversation states
const STATES = {
  IDLE: 'IDLE',
  AWAITING_ACTION: 'AWAITING_ACTION',
  BOOKING_CARGO_TYPE: 'BOOKING_CARGO_TYPE',
  BOOKING_CARGO_WEIGHT: 'BOOKING_CARGO_WEIGHT',
  BOOKING_PICKUP_LOCATION: 'BOOKING_PICKUP_LOCATION',
  BOOKING_DELIVERY_LOCATION: 'BOOKING_DELIVERY_LOCATION',
  BOOKING_PICKUP_DATE: 'BOOKING_PICKUP_DATE',
  BOOKING_CONFIRM: 'BOOKING_CONFIRM',
  TRACKING_BOOKING_ID: 'TRACKING_BOOKING_ID'
};

// Verify webhook (GET)
exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const result = whatsappService.verifyWebhook(mode, token, challenge);

  if (result) {
    console.log('WhatsApp webhook verified');
    res.status(200).send(result);
  } else {
    console.log('WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
};

// Handle incoming webhook (POST)
exports.handleWebhook = async (req, res) => {
  try {
    const validSignature = await whatsappService.verifyWebhookSignature(
      req.rawBody,
      req.get('x-hub-signature-256')
    );
    if (!validSignature) {
      console.warn('WhatsApp webhook rejected due to invalid signature');
      return res.sendStatus(401);
    }

    // Always respond immediately to avoid timeout
    res.sendStatus(200);

    const message = whatsappService.parseWebhookMessage(req.body);

    if (!message) {
      return;
    }

    console.log('Incoming WhatsApp message:', message);

    // Mark message as read
    await whatsappService.markAsRead(message.messageId);

    // Get or create session
    const session = whatsappService.getSession(message.from);

    // Find or create user
    let user = await User.findOne({ phone: formatPhoneForDB(message.from) });

    // Process message based on type and session state
    await processMessage(message, session, user);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
  }
};

// Main message processor
async function processMessage(message, session, user) {
  const from = message.from;

  // Handle button/list replies
  if (message.buttonReply) {
    return handleButtonReply(from, message.buttonReply, session, user);
  }

  if (message.listReply) {
    return handleListReply(from, message.listReply, session, user);
  }

  // Handle location messages
  if (message.location) {
    return handleLocation(from, message.location, session, user);
  }

  // Handle text messages
  if (message.text) {
    return handleText(from, message.text, session, user);
  }

  // Handle images (for proof of delivery)
  if (message.image) {
    return handleImage(from, message.image, session, user);
  }
}

// Handle text messages
async function handleText(from, text, session, user) {
  const normalizedText = text.toLowerCase().trim();

  // Check for main menu keywords when idle
  if (session.state === STATES.IDLE || session.state === STATES.AWAITING_ACTION) {
    if (['book', 'transport', 'ship', 'send', 'delivery'].some(kw => normalizedText.includes(kw))) {
      return startBookingFlow(from, session, user);
    }

    if (['track', 'status', 'where'].some(kw => normalizedText.includes(kw))) {
      return startTrackingFlow(from, session, user);
    }

    if (['help', 'menu', 'hi', 'hello', 'start'].some(kw => normalizedText.includes(kw))) {
      return sendMainMenu(from, session);
    }

    if (['cancel'].includes(normalizedText)) {
      whatsappService.clearSession(from);
      return whatsappService.sendTextMessage(from, 'Operation cancelled. Send "menu" to start over.');
    }
  }

  // Handle state-specific text input
  switch (session.state) {
    case STATES.BOOKING_CARGO_WEIGHT:
      return handleCargoWeight(from, text, session);

    case STATES.BOOKING_PICKUP_LOCATION:
      return handlePickupLocation(from, text, session);

    case STATES.BOOKING_DELIVERY_LOCATION:
      return handleDeliveryLocation(from, text, session);

    case STATES.BOOKING_PICKUP_DATE:
      return handlePickupDate(from, text, session);

    case STATES.TRACKING_BOOKING_ID:
      return handleTrackingInput(from, text, session, user);

    default:
      return sendMainMenu(from, session);
  }
}

// Handle button replies
async function handleButtonReply(from, buttonReply, session, user) {
  const buttonId = buttonReply.id;

  // Main menu actions
  if (buttonId === 'action_book') {
    return startBookingFlow(from, session, user);
  }

  if (buttonId === 'action_track') {
    return startTrackingFlow(from, session, user);
  }

  if (buttonId === 'action_support') {
    return whatsappService.sendTextMessage(from,
      'Need help? Contact our support team:\n\n📞 Phone: +263 77 123 4567\n📧 Email: support@palmtrent.co.zw\n\nOur team is available 24/7 to assist you.');
  }

  // Job acceptance (for transporters)
  if (buttonId.startsWith('accept_')) {
    const bookingId = buttonId.replace('accept_', '');
    return handleJobAcceptance(from, bookingId, true, user);
  }

  if (buttonId.startsWith('decline_')) {
    const bookingId = buttonId.replace('decline_', '');
    return handleJobAcceptance(from, bookingId, false, user);
  }

  if (buttonId.startsWith('details_')) {
    const bookingId = buttonId.replace('details_', '');
    return sendJobDetails(from, bookingId);
  }

  // Booking confirmation
  if (buttonId === 'confirm_booking') {
    return confirmBooking(from, session, user);
  }

  if (buttonId === 'cancel_booking') {
    whatsappService.clearSession(from);
    return whatsappService.sendTextMessage(from, 'Booking cancelled. Send "menu" to start a new booking.');
  }

  if (buttonId === 'modify_booking') {
    return startBookingFlow(from, session, user);
  }

  // Rating
  if (buttonId.startsWith('rate_')) {
    const bookingId = buttonId.replace('rate_', '');
    return whatsappService.sendTextMessage(from,
      `Thank you for choosing Palmtrent! 🌟\n\nPlease open our app to rate your experience for booking ${bookingId}.\n\nYour feedback helps us improve!`);
  }

  if (buttonId === 'book_again') {
    return startBookingFlow(from, session, user);
  }
}

// Handle list replies
async function handleListReply(from, listReply, session, user) {
  const itemId = listReply.id;

  // Cargo type selection
  if (itemId.startsWith('cargo_')) {
    const cargoType = itemId.replace('cargo_', '');
    whatsappService.updateSession(from, STATES.BOOKING_CARGO_WEIGHT, { cargoType });

    return whatsappService.sendTextMessage(from,
      `Great! You selected *${listReply.title}*.\n\nWhat is the estimated weight of your cargo in kilograms?\n\n(Example: 500)`);
  }

  // Date selection
  if (itemId.startsWith('date_')) {
    const dateOption = itemId.replace('date_', '');
    let pickupDate;

    switch (dateOption) {
      case 'today':
        pickupDate = new Date();
        break;
      case 'tomorrow':
        pickupDate = new Date();
        pickupDate.setDate(pickupDate.getDate() + 1);
        break;
      case 'in_2_days':
        pickupDate = new Date();
        pickupDate.setDate(pickupDate.getDate() + 2);
        break;
      case 'in_3_days':
        pickupDate = new Date();
        pickupDate.setDate(pickupDate.getDate() + 3);
        break;
    }

    whatsappService.updateSession(from, STATES.BOOKING_CONFIRM, { pickupDate });
    return showBookingSummary(from, session);
  }
}

// Handle location messages
async function handleLocation(from, location, session, user) {
  const locationData = {
    latitude: location.latitude,
    longitude: location.longitude,
    address: location.address || `${location.latitude}, ${location.longitude}`
  };

  if (session.state === STATES.BOOKING_PICKUP_LOCATION) {
    whatsappService.updateSession(from, STATES.BOOKING_DELIVERY_LOCATION, {
      pickup: locationData
    });

    await whatsappService.sendTextMessage(from,
      `📍 Pickup location set to:\n${locationData.address}\n\nNow, please share your *delivery location*.`);

    return whatsappService.sendLocationRequest(from,
      'Share the delivery location by tapping the button below, or type the address.');
  }

  if (session.state === STATES.BOOKING_DELIVERY_LOCATION) {
    whatsappService.updateSession(from, STATES.BOOKING_PICKUP_DATE, {
      delivery: locationData
    });

    return askPickupDate(from, session);
  }

  return whatsappService.sendTextMessage(from, 'Location received. Send "menu" to continue.');
}

// Handle image messages (for POD)
async function handleImage(from, image, session, user) {
  // Could be used for proof of delivery or cargo photos
  return whatsappService.sendTextMessage(from,
    'Image received! If you\'re uploading proof of delivery, please use our mobile app for verification.');
}

// Send main menu
async function sendMainMenu(from, session) {
  whatsappService.updateSession(from, STATES.AWAITING_ACTION);

  const bodyText = `Welcome to *Palmtrent* 🚚

Zimbabwe's trusted logistics platform connecting shippers with transporters.

What would you like to do today?`;

  const buttons = [
    { id: 'action_book', title: 'Book Transport' },
    { id: 'action_track', title: 'Track Shipment' },
    { id: 'action_support', title: 'Get Support' }
  ];

  return whatsappService.sendButtonsMessage(from, bodyText, buttons);
}

// Start booking flow
async function startBookingFlow(from, session, user) {
  whatsappService.updateSession(from, STATES.BOOKING_CARGO_TYPE, {});

  // Fetch cargo types
  let cargoTypes;
  try {
    cargoTypes = await CargoType.find({ isActive: true }).limit(10);
  } catch (error) {
    cargoTypes = [
      { _id: 'general', name: 'General Goods' },
      { _id: 'agricultural', name: 'Agricultural Products' },
      { _id: 'construction', name: 'Construction Materials' },
      { _id: 'furniture', name: 'Furniture & Appliances' },
      { _id: 'perishables', name: 'Perishables' },
      { _id: 'hazardous', name: 'Hazardous Materials' }
    ];
  }

  const sections = [{
    title: 'Cargo Types',
    rows: cargoTypes.map(ct => ({
      id: `cargo_${ct._id}`,
      title: ct.name,
      description: ct.description?.substring(0, 70) || ''
    }))
  }];

  return whatsappService.sendListMessage(
    from,
    'Let\'s book your transport! 📦\n\nFirst, what type of cargo are you shipping?',
    'Select Cargo Type',
    sections
  );
}

// Handle cargo weight input
async function handleCargoWeight(from, text, session) {
  const weight = parseFloat(text.replace(/[^0-9.]/g, ''));

  if (isNaN(weight) || weight <= 0 || weight > 50000) {
    return whatsappService.sendTextMessage(from,
      'Please enter a valid weight between 1 and 50,000 kg.\n\n(Example: 500)');
  }

  whatsappService.updateSession(from, STATES.BOOKING_PICKUP_LOCATION, { weight });

  await whatsappService.sendTextMessage(from,
    `Weight set to *${weight} kg*.\n\nNow, please share your *pickup location*.`);

  return whatsappService.sendLocationRequest(from,
    'Share the pickup location by tapping the button below, or type the address.');
}

// Handle pickup location text
async function handlePickupLocation(from, text, session) {
  const pickup = { address: text };

  whatsappService.updateSession(from, STATES.BOOKING_DELIVERY_LOCATION, { pickup });

  await whatsappService.sendTextMessage(from,
    `📍 Pickup location:\n${text}\n\nNow, please share your *delivery location*.`);

  return whatsappService.sendLocationRequest(from,
    'Share the delivery location by tapping the button below, or type the address.');
}

// Handle delivery location text
async function handleDeliveryLocation(from, text, session) {
  const delivery = { address: text };

  whatsappService.updateSession(from, STATES.BOOKING_PICKUP_DATE, { delivery });

  return askPickupDate(from, session);
}

// Ask for pickup date
async function askPickupDate(from, session) {
  const sections = [{
    title: 'Pickup Date',
    rows: [
      { id: 'date_today', title: 'Today', description: new Date().toLocaleDateString() },
      { id: 'date_tomorrow', title: 'Tomorrow', description: new Date(Date.now() + 86400000).toLocaleDateString() },
      { id: 'date_in_2_days', title: 'In 2 Days', description: new Date(Date.now() + 172800000).toLocaleDateString() },
      { id: 'date_in_3_days', title: 'In 3 Days', description: new Date(Date.now() + 259200000).toLocaleDateString() }
    ]
  }];

  return whatsappService.sendListMessage(
    from,
    'When would you like the cargo to be picked up?',
    'Select Date',
    sections
  );
}

// Handle pickup date text
async function handlePickupDate(from, text, session) {
  // Try to parse date from text
  const pickupDate = new Date(text);

  if (isNaN(pickupDate.getTime())) {
    return askPickupDate(from, session);
  }

  whatsappService.updateSession(from, STATES.BOOKING_CONFIRM, { pickupDate });
  return showBookingSummary(from, session);
}

// Show booking summary
async function showBookingSummary(from, session) {
  const ctx = session.context;

  // Calculate distance and price (simplified)
  let distance = 100; // Default distance
  let price = 50; // Default price

  try {
    if (ctx.pickup?.latitude && ctx.delivery?.latitude) {
      const distResult = await distanceService.calculateDistance(
        ctx.pickup.latitude, ctx.pickup.longitude,
        ctx.delivery.latitude, ctx.delivery.longitude
      );
      distance = distResult.distance || 100;
    }

    // Simple pricing calculation
    const baseRate = 0.5; // $0.50 per km
    const weightFactor = ctx.weight > 1000 ? 1.5 : 1;
    price = Math.max(30, distance * baseRate * weightFactor);
  } catch (error) {
    console.error('Price calculation error:', error);
  }

  // Update context with price
  whatsappService.updateSession(from, STATES.BOOKING_CONFIRM, { distance, price });

  const summary = `📋 *Booking Summary*

📦 *Cargo:* ${ctx.cargoType || 'General'}
⚖️ *Weight:* ${ctx.weight} kg
📍 *Pickup:* ${ctx.pickup?.address || 'Not set'}
📍 *Delivery:* ${ctx.delivery?.address || 'Not set'}
📅 *Date:* ${ctx.pickupDate ? new Date(ctx.pickupDate).toLocaleDateString() : 'Not set'}
📏 *Distance:* ~${distance.toFixed(0)} km

💰 *Estimated Price:* $${price.toFixed(2)}

Please confirm your booking:`;

  const buttons = [
    { id: 'confirm_booking', title: 'Confirm Booking' },
    { id: 'modify_booking', title: 'Modify' },
    { id: 'cancel_booking', title: 'Cancel' }
  ];

  return whatsappService.sendButtonsMessage(from, summary, buttons);
}

// Confirm booking
async function confirmBooking(from, session, user) {
  const ctx = session.context;

  if (!user) {
    whatsappService.clearSession(from);
    return whatsappService.sendTextMessage(from,
      'To complete your booking, please register or login through our mobile app.\n\nDownload Palmtrent from the App Store or Google Play.\n\nYour booking details have been saved.');
  }

  try {
    // Create booking
    const bookingReference = `PT${Date.now().toString(36).toUpperCase()}`;
    const pickupCoordinates = ctx.pickup?.latitude ? {
      type: 'Point',
      coordinates: [ctx.pickup.longitude, ctx.pickup.latitude]
    } : undefined;
    const deliveryCoordinates = ctx.delivery?.latitude ? {
      type: 'Point',
      coordinates: [ctx.delivery.longitude, ctx.delivery.latitude]
    } : undefined;

    const fees = await monetizationService.calculateShipmentFees(ctx.price, ctx.price, {
      audience: 'all',
      paymentMethod: 'openapi_africa'
    });
    const platformCommission = Math.round((fees.platformFee + fees.transporterCommission) * 100) / 100;
    const transporterTotal = Math.max(0, Math.round((ctx.price - platformCommission) * 100) / 100);

    const booking = new Booking({
      user: user._id,
      shipper: user._id,
      bookingReference,
      cargoDetails: {
        type: ctx.cargoType,
        weight: ctx.weight,
        description: `WhatsApp booking - ${ctx.cargoType}`
      },
      route: {
        pickup: {
          address: ctx.pickup?.address,
          coordinates: pickupCoordinates,
          date: ctx.pickupDate
        },
        delivery: {
          address: ctx.delivery?.address,
          coordinates: deliveryCoordinates
        },
        distance: ctx.distance
      },
      pricing: {
        breakdown: {
          baseRate: ctx.price * 0.7,
          distanceCharge: ctx.price * 0.3
        },
        totals: {
          subtotal: ctx.price,
          total: ctx.price,
          transporterTotal,
          platformTotal: platformCommission
        },
        currency: 'USD'
      },
      payment: {
        method: 'digital',
        status: 'pending'
      },
      paymentStatus: 'pending',
      status: 'pending_payment',
      origin: ctx.pickup?.address,
      destination: ctx.delivery?.address,
      totalAmount: ctx.price
    });

    await booking.save();

    // Clear session
    whatsappService.clearSession(from);

    // Send confirmation
    const message = `✅ *Booking Created!*

📋 *Booking ID:* ${booking.bookingReference}
💰 *Amount:* $${ctx.price.toFixed(2)}

To complete your booking, please make payment through our mobile app or use the link below:

🔗 Pay Now: ${process.env.FRONTEND_URL}/pay/${booking._id}

Your booking will be confirmed once payment is received.

Thank you for choosing Palmtrent! 🚚`;

    return whatsappService.sendTextMessage(from, message);
  } catch (error) {
    console.error('Booking creation error:', error);
    return whatsappService.sendTextMessage(from,
      'Sorry, there was an error creating your booking. Please try again or contact support.');
  }
}

// Start tracking flow
async function startTrackingFlow(from, session, user) {
  if (!user) {
    return whatsappService.sendTextMessage(from,
      'Please enter your booking number to track your shipment.\n\n(Example: PT123ABC)');
  }

  // Find user's recent bookings
  const bookings = await Booking.find({
    $or: [{ shipper: user._id }, { transporter: user._id }],
    status: { $nin: ['completed', 'cancelled'] }
  }).sort({ createdAt: -1 }).limit(5);

  if (bookings.length === 0) {
    whatsappService.updateSession(from, STATES.TRACKING_BOOKING_ID);
    return whatsappService.sendTextMessage(from,
      'No active bookings found. Please enter a booking number to track.\n\n(Example: PT123ABC)');
  }

  const sections = [{
    title: 'Active Bookings',
    rows: bookings.map(b => ({
      id: `track_${b._id}`,
      title: b.bookingReference || b.bookingNumber || b._id.toString(),
      description: `${b.status} - ${b.route.pickup.address?.substring(0, 40)}`
    }))
  }];

  whatsappService.updateSession(from, STATES.TRACKING_BOOKING_ID);

  return whatsappService.sendListMessage(
    from,
    'Select a booking to track, or enter a booking number:',
    'Select Booking',
    sections
  );
}

// Handle tracking input
async function handleTrackingInput(from, text, session, user) {
  const bookingNumber = text.toUpperCase().trim();

  const booking = await Booking.findOne({
    $or: [
      { bookingReference: bookingNumber },
      { bookingNumber },
      { _id: bookingNumber.length === 24 ? bookingNumber : null }
    ]
  }).populate('transporter', 'fullName phone');

  if (!booking) {
    return whatsappService.sendTextMessage(from,
      `Booking *${bookingNumber}* not found.\n\nPlease check the booking number and try again, or send "menu" to go back.`);
  }

  whatsappService.clearSession(from);

  const statusEmoji = {
    'pending': '⏳',
    'pending_payment': '💳',
    'payment_confirmed': '✅',
    'finding_transporter': '🔍',
    'matched': '🤝',
    'in_progress': '🚚',
    'picked_up': '📦',
    'in_transit': '🛣️',
    'delivered': '📬',
    'completed': '✅',
    'cancelled': '❌'
  };

  const message = `📋 *Booking Status*

📌 *Booking:* ${booking.bookingReference || booking.bookingNumber}
${statusEmoji[booking.status] || '📋'} *Status:* ${booking.status.replace(/_/g, ' ').toUpperCase()}

📍 *From:* ${booking.route.pickup.address}
📍 *To:* ${booking.route.delivery.address}

${booking.transporter ? `👤 *Transporter:* ${booking.transporter.fullName}\n📞 *Phone:* ${booking.transporter.phone}` : 'Waiting for transporter assignment...'}

${booking.status === 'in_transit' ? '🔴 Live tracking available in the Palmtrent app.' : ''}

Send "menu" for more options.`;

  return whatsappService.sendTextMessage(from, message);
}

// Handle job acceptance (for transporters)
async function handleJobAcceptance(from, bookingId, accepted, user) {
  if (!user || user.userType !== 'transporter') {
    return whatsappService.sendTextMessage(from,
      'You must be a registered transporter to accept jobs. Please register through our app.');
  }

  try {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return whatsappService.sendTextMessage(from, 'This job is no longer available.');
    }

    if (booking.status !== 'finding_transporter') {
      return whatsappService.sendTextMessage(from,
        'This job has already been assigned to another transporter.');
    }

    if (accepted) {
      if (!isPaymentConfirmed(booking)) {
        return whatsappService.sendTextMessage(from, 'This job is not ready yet because payment has not been confirmed.');
      }
      await assertTransporterEligible(user._id);
      assertBookingTransition(booking.status, 'transporter_assigned');
      booking.transporter = user._id;
      booking.status = 'transporter_assigned';
      booking.matchedAt = new Date();
      await booking.save();

      const shipment = await Shipment.create({
        bookingReference: booking.bookingReference,
        booking: booking._id,
        shipper: booking.user,
        transporter: user._id,
        status: 'assigned',
        cargoDetails: booking.cargoDetails,
        route: booking.route,
        pricing: {
          total: booking.pricing?.totals?.total,
          platformFee: booking.pricing?.totals?.platformTotal,
          insurance: booking.pricing?.totals?.insuranceTotal,
          currency: booking.pricing?.currency || 'USD'
        },
        insurance: booking.insurance,
        origin: booking.origin,
        destination: booking.destination,
        amount: booking.totalAmount,
        transporterEarnings: booking.pricing?.totals?.transporterTotal,
        schedule: {
          pickupDate: booking.route?.pickup?.date,
          deliveryDate: booking.route?.delivery?.date
        }
      });

      booking.shipments = [...(booking.shipments || []), shipment._id];
      await booking.save();
      await matchingService.recordTransporterOfferResponse(user._id, 'accepted');
      await notificationService.notifyTransporterAssigned(booking, user);

      await recordAudit({
        actor: user,
        action: 'whatsapp.job_accepted',
        entityType: 'Booking',
        entityId: booking._id,
        entityRef: booking.bookingReference,
        after: { status: booking.status, shipment: shipment._id }
      });

      return whatsappService.sendTextMessage(from,
        `✅ *Job Accepted!*\n\n📋 *Booking:* ${booking.bookingReference || booking.bookingNumber}\n📍 *Pickup:* ${booking.route.pickup.address}\n📅 *Date:* ${new Date(booking.route.pickup.date || booking.route.pickup.scheduledDate).toLocaleDateString()}\n\nPlease proceed to the pickup location. The shipper has been notified.\n\nUse the Palmtrent app to update status and navigate.`);
    } else {
      const alreadyDeclined = (booking.declines || []).some(decline =>
        decline.transporter?.toString() === user._id.toString()
      );
      if (!alreadyDeclined) {
        booking.declines = [
          ...(booking.declines || []),
          { transporter: user._id, reason: 'Declined via WhatsApp', declinedAt: new Date() }
        ];
        await booking.save();
        await matchingService.recordTransporterOfferResponse(user._id, 'declined');
      }
      return whatsappService.sendTextMessage(from,
        'Job declined. We\'ll notify you of other available jobs.');
    }
  } catch (error) {
    console.error('Job acceptance error:', error);
    return whatsappService.sendTextMessage(from,
      'Error processing your request. Please try again.');
  }
}

// Send job details
async function sendJobDetails(from, bookingId) {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('shipper', 'fullName rating');

    if (!booking) {
      return whatsappService.sendTextMessage(from, 'Job not found.');
    }

    const cargo = booking.cargoDetails || booking.cargo || {};
    const pickupDate = booking.route.pickup.date || booking.route.pickup.scheduledDate;
    const total = booking.pricing?.totals?.total || booking.pricing?.total || booking.totalAmount || 0;

    const message = `📋 *Job Details*

📦 *Cargo:* ${cargo.type || 'General'}
⚖️ *Weight:* ${cargo.weight || 0} kg
${cargo.description ? `📝 *Description:* ${cargo.description}` : ''}

📍 *Pickup:*
${booking.route.pickup.address}
📅 ${pickupDate ? new Date(pickupDate).toLocaleString() : 'TBD'}

📍 *Delivery:*
${booking.route.delivery.address}
${booking.route.delivery.deadline ? `⏰ Deadline: ${new Date(booking.route.delivery.deadline).toLocaleString()}` : ''}

📏 *Distance:* ~${booking.route.distance || 'TBD'} km
💰 *Your Earnings:* $${(total * 0.85).toFixed(2)}

👤 *Shipper:* ${booking.shipper?.fullName || 'N/A'}
⭐ *Rating:* ${booking.shipper?.rating || 'New'}

${cargo.specialRequirements ? `⚠️ *Special Requirements:*\n${cargo.specialRequirements}` : ''}`;

    const buttons = [
      { id: `accept_${bookingId}`, title: 'Accept Job' },
      { id: `decline_${bookingId}`, title: 'Decline' }
    ];

    return whatsappService.sendButtonsMessage(from, message, buttons);
  } catch (error) {
    console.error('Job details error:', error);
    return whatsappService.sendTextMessage(from, 'Error fetching job details.');
  }
}

// Helper function to format phone for database lookup
function formatPhoneForDB(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('263')) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('0')) {
    return `+263${cleaned.substring(1)}`;
  }
  if (cleaned.length === 9) {
    return `+263${cleaned}`;
  }
  return phone;
}

// ============ NOTIFICATION EXPORTS ============

// Send booking status update
exports.sendBookingStatusUpdate = async (booking, status) => {
  try {
    const user = await User.findById(booking.shipper);
    if (!user?.phone) return;

    switch (status) {
      case 'payment_confirmed':
        await whatsappService.sendBookingConfirmation(user.phone, booking);
        break;
      case 'matched':
        const transporter = await User.findById(booking.transporter);
        await whatsappService.sendTransporterAssigned(user.phone, booking, transporter);
        break;
      case 'picked_up':
        await whatsappService.sendPickupStarted(user.phone, booking);
        break;
      case 'delivered':
      case 'completed':
        await whatsappService.sendDeliveryCompleted(user.phone, booking);
        break;
    }
  } catch (error) {
    console.error('Send booking status update error:', error);
  }
};

// Send new job notification to transporters
exports.sendNewJobNotification = async (booking, transporterIds) => {
  try {
    const transporters = await User.find({
      _id: { $in: transporterIds },
      userType: 'transporter'
    });

    for (const transporter of transporters) {
      if (transporter.phone) {
        await whatsappService.sendNewJobAlert(transporter.phone, booking);
      }
    }
  } catch (error) {
    console.error('Send job notification error:', error);
  }
};

// Send payment notification
exports.sendPaymentNotification = async (booking, amount) => {
  try {
    const transporter = await User.findById(booking.transporter);
    if (transporter?.phone) {
      await whatsappService.sendPaymentReleased(transporter.phone, booking, amount);
    }
  } catch (error) {
    console.error('Send payment notification error:', error);
  }
};

// Send SOS alert
exports.sendSOSAlert = async (emergency, recipients) => {
  try {
    for (const phone of recipients) {
      await whatsappService.sendSOSAlert(phone, emergency);
    }
  } catch (error) {
    console.error('Send SOS alert error:', error);
  }
};

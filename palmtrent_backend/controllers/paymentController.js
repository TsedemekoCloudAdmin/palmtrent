// controllers/paymentController.js
const { Paynow } = require("paynow");
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Rental = require('../models/Rental');
const Subscription = require('../models/Subscription');
const paymentService = require('../services/paymentService');
const escrowService = require('../services/escrowService');
const openApiAfricaService = require('../services/openApiAfricaService');
const payoutService = require('../services/payoutService');
const { getIntegrationConfig } = require('../services/integrationSettingsService');
const {
  canCancelEscrow,
  canConfirmEscrowDelivery,
  canManageBookingPayment,
  canManagePayment,
  canReadEscrow,
  canReadPayment,
  canRecordEscrowCashCollection,
  isAdmin
} = require('../services/resourceAccessService');

const notAuthorized = (res, message = 'Not authorized to access this resource') => {
  return res.status(403).json({ success: false, message });
};

const loadPaymentWithAccessContext = (paymentReference) => {
  return Payment.findOne({ paymentReference })
    .populate('booking')
    .populate('rental')
    .populate({ path: 'subscription', populate: { path: 'plan user' } });
};

const getCurrentUserId = (user) => user?._id || user?.id;

// List payments visible to the current user.
exports.getPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentMethod,
      gateway
    } = req.query;

    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const query = {};

    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (gateway) query.gateway = gateway;

    if (!isAdmin(req.user)) {
      const userId = getCurrentUserId(req.user);
      const canQuerySubscriptions = /^[a-f\d]{24}$/i.test(String(userId || ''));

      const [bookings, rentals, subscriptions] = await Promise.all([
        Booking.find({
          $or: [
            { user: userId },
            { shipper: userId },
            { transporter: userId }
          ]
        }).select('_id'),
        Rental.find({
          $or: [
            { owner: userId },
            { renter: userId }
          ]
        }).select('_id'),
        canQuerySubscriptions
          ? Subscription.find({ user: userId }).select('_id')
          : Promise.resolve([])
      ]);

      query.$or = [
        { booking: { $in: bookings.map(item => item._id) } },
        { rental: { $in: rentals.map(item => item._id) } }
      ];
      if (subscriptions.length) {
        query.$or.push({ subscription: { $in: subscriptions.map(item => item._id) } });
      }
    }

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('booking', 'bookingId bookingReference status route')
        .populate('rental', 'rentalReference status itemType')
        .populate({ path: 'subscription', select: 'status amount currency payment plan', populate: { path: 'plan', select: 'name code audience billingCycle' } })
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Payment.countDocuments(query)
    ]);

    res.json({
      success: true,
      count: payments.length,
      data: payments.map(payment => ({
        ...payment,
        method: payment.paymentMethod
      })),
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('Error listing payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments'
    });
  }
};

const getPaynowClient = async () => {
  const config = await getIntegrationConfig('paynow');
  if (!config.integrationId || !config.integrationKey) {
    throw new Error('Paynow mobile-money rail is not configured. Add credentials before using Paynow-backed EcoCash/OneMoney flows.');
  }

  const client = new Paynow(config.integrationId, config.integrationKey);
  client.resultUrl = config.resultUrl || process.env.PAYNOW_RESULT_URL || "http://localhost:3000/api/payments/webhook";
  client.returnUrl = config.returnUrl || process.env.PAYNOW_RETURN_URL || "http://localhost:3000/payment/return";

  if (process.env.NODE_ENV === 'development') {
    client.debug = true;
  }

  return client;
};

// NEW: Create payment for any method
exports.createPayment = async (req, res) => {
  try {
    const { 
      bookingId, 
      amount, 
      paymentMethod,
      customer = {} 
    } = req.body;

    console.log('Creating payment:', { bookingId, amount, paymentMethod });

    // Validate required fields
    if (!bookingId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment information'
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!canManageBookingPayment(req.user, booking)) {
      return notAuthorized(res, 'Only the booking shipper can create this payment');
    }

    const payment = await paymentService.createPayment(bookingId, amount, paymentMethod, customer);

    res.status(201).json({
      success: true,
      data: {
        paymentId: payment._id,
        paymentReference: payment.paymentReference,
        status: payment.status,
        gateway: payment.gateway,
        expiresAt: payment.expiresAt
      }
    });

  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment'
    });
  }
};

// Initiate the configured hosted checkout for a payment.
const initiatePayment = async (req, res) => {
  try {
    const { 
      paymentReference,
      customer 
    } = req.body;

    console.log('Initiating hosted payment for:', paymentReference);

    // Find payment record
    const payment = await loadPaymentWithAccessContext(paymentReference);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (!canManagePayment(req.user, payment)) {
      return notAuthorized(res, 'Only the payer can initiate this payment');
    }

    // Update payment status to initiated
    payment.status = 'initiated';
    payment.initiatedAt = new Date();
    await payment.save();

    if (payment.gateway === 'openapi_africa') {
      const result = await openApiAfricaService.createOrder(paymentReference, customer);
      return res.status(200).json({
        success: true,
        data: {
          paymentId: payment._id,
          redirectUrl: result.redirectUrl,
          gatewayReference: result.gatewayReference,
          paymentReference: payment.paymentReference
        }
      });
    }

    if (payment.gateway !== 'paynow') {
      return res.status(400).json({
        success: false,
        message: 'This payment method does not use a hosted payment gateway'
      });
    }

    // Existing Paynow payment records can still be completed while checkout moves to ClicknPay.
    const paynow = await getPaynowClient();

    // Create Paynow payment
    const paynowPayment = paynow.createPayment(paymentReference, customer.email);

    // Add items to payment
    paynowPayment.add(`Freight Booking Payment`, payment.amount);

    // Set payment method if specified
    if (payment.paymentMethod === 'ecocash' && customer.phone) {
      let phone = customer.phone;
      if (phone.startsWith('0')) {
        phone = `+263${phone.substring(1)}`;
      } else if (!phone.startsWith('+')) {
        phone = `+263${phone}`;
      }
      
      paynowPayment.method = 'ecocash';
      console.log('Setting EcoCash phone:', phone);
    }

    // Send payment to Paynow
    const response = await paynow.send(paynowPayment);

    console.log('Paynow response:', response);

    if (response.success) {
      // Update payment with gateway details
      payment.gatewayReference = response.id;
      payment.pollUrl = response.pollUrl;
      payment.metadata = {
        ...payment.metadata,
        paynowResponse: response
      };
      await payment.save();

      return res.status(200).json({
        success: true,
        data: {
          paymentId: payment._id,
          redirectUrl: response.redirectUrl,
          pollUrl: response.pollUrl,
          instructions: response.instructions,
          gatewayReference: response.id,
          paymentReference: payment.paymentReference
        }
      });
    } else {
      console.error('Paynow initiation failed:', response);
      
      // Update payment status to failed
      payment.status = 'failed';
      payment.failedAt = new Date();
      await payment.save();

      throw new Error(response.error || 'Payment initiation failed with Paynow');
    }

  } catch (error) {
    console.error('Hosted payment initiation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment initiation failed'
    });
  }
};

exports.initiatePayment = initiatePayment;
exports.initiatePaynowPayment = initiatePayment;

// NEW: Confirm cash payment (for agent, pickup, delivery)
exports.confirmCashPayment = async (req, res) => {
  try {
    const { paymentReference } = req.body;

    console.log('Confirming cash payment for:', paymentReference);

    if (!isAdmin(req.user)) {
      return notAuthorized(res, 'Only an admin can manually confirm cash payments');
    }

    const payment = await paymentService.confirmPayment(paymentReference, {
      gateway: 'cash',
      metadata: { confirmedBy: req.user.id, confirmedAt: new Date() }
    });

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        paymentReference: payment.paymentReference,
        status: payment.status,
        confirmedAt: payment.confirmedAt
      },
      message: 'Cash payment confirmed successfully'
    });

  } catch (error) {
    console.error('Cash payment confirmation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm cash payment'
    });
  }
};

// UPDATED: Check payment status (for all methods)
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { paymentReference } = req.params;

    const payment = await loadPaymentWithAccessContext(paymentReference);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (!canReadPayment(req.user, payment)) {
      return notAuthorized(res);
    }

    // For Paynow payments, poll status if available
    if (payment.gateway === 'paynow' && payment.pollUrl && payment.status === 'initiated') {
      try {
        const paynow = await getPaynowClient();
        const status = await paynow.pollTransaction(payment.pollUrl);
        console.log('Paynow poll status:', status);

        if (status.paid()) {
          await paymentService.confirmPayment(paymentReference, {
            gatewayReference: status.reference,
            metadata: { pollStatus: status }
          });
        } else if (status.cancelled()) {
          await paymentService.updatePaymentStatus(paymentReference, 'cancelled', {
            pollStatus: status
          });
        } else if (status.failed()) {
          await paymentService.updatePaymentStatus(paymentReference, 'failed', {
            pollStatus: status
          });
        }
      } catch (pollError) {
        console.error('Polling error:', pollError);
        // Continue with current status if polling fails
      }
    }

    if (payment.gateway === 'openapi_africa' && ['initiated', 'processing', 'pending'].includes(payment.status)) {
      try {
        await openApiAfricaService.checkAndUpdateStatus(paymentReference);
      } catch (pollError) {
        console.error('OpenAPI Africa polling error:', pollError);
      }
    }

    // Get updated payment
    const updatedPayment = await loadPaymentWithAccessContext(paymentReference);

    res.json({
      success: true,
      data: {
        status: updatedPayment.status,
        paymentReference: updatedPayment.paymentReference,
        amount: updatedPayment.amount,
        paymentMethod: updatedPayment.paymentMethod,
        confirmedAt: updatedPayment.confirmedAt,
        expiresAt: updatedPayment.expiresAt
      }
    });

  } catch (error) {
    console.error('Payment status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
};

// UPDATED: Handle Paynow webhook
exports.handlePaynowWebhook = async (req, res) => {
  try {
    const { reference, paynowreference, amount, status, hash } = req.body;

    console.log('Paynow webhook received:', req.body);

    const paynow = await getPaynowClient();

    // Verify the hash
    const expectedHash = paynow.verifyHash(req.body);
    
    if (!expectedHash) {
      console.error('Invalid webhook hash received');
      return res.status(400).send('Invalid hash');
    }

    // Find payment by reference
    const payment = await Payment.findOne({ paymentReference: reference });
    if (!payment) {
      console.error('Payment not found for reference:', reference);
      return res.status(404).send('Payment not found');
    }

    const webhookAmount = Number(amount);
    if (amount !== undefined && (!Number.isFinite(webhookAmount) || Math.abs(webhookAmount - Number(payment.amount)) > 0.01)) {
      console.error('Paynow webhook amount mismatch:', { reference, expected: payment.amount, received: amount });
      return res.status(409).send('Payment amount mismatch');
    }

    // Update payment status based on webhook
    if (status.toLowerCase() === 'paid' && payment.status !== 'confirmed') {
      await paymentService.confirmPayment(reference, {
        gatewayReference: paynowreference,
        metadata: { webhookData: req.body }
      });
      console.log('Payment confirmed via webhook:', reference);
    } else if (status.toLowerCase() === 'cancelled') {
      await paymentService.updatePaymentStatus(reference, 'cancelled', {
        webhookData: req.body
      });
      console.log('Payment cancelled via webhook:', reference);
    } else if (status.toLowerCase() === 'disputed') {
      await paymentService.updatePaymentStatus(reference, 'failed', {
        webhookData: req.body
      });
      console.log('Payment disputed via webhook:', reference);
    }

    res.status(200).send('OK');

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Error processing webhook');
  }
};

// NEW: Get payment by reference
exports.getPaymentByReference = async (req, res) => {
  try {
    const { reference } = req.params;

    const payment = await loadPaymentWithAccessContext(reference);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (!canReadPayment(req.user, payment)) {
      return notAuthorized(res);
    }

    res.json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment details'
    });
  }
};

// NEW: Check payment expiry
exports.checkPaymentExpiry = async (req, res) => {
  try {
    const { paymentReference } = req.params;

    const payment = await loadPaymentWithAccessContext(paymentReference);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (!canManagePayment(req.user, payment)) {
      return notAuthorized(res, 'Only the payer can check payment expiry');
    }

    const result = await paymentService.checkPaymentExpiry(paymentReference);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error checking payment expiry:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error checking payment expiry'
    });
  }
};

// NEW: Generate EcoCash Agent payment reference and instructions
exports.initiateAgentPayment = async (req, res) => {
  try {
    const { bookingId, amount, customer = {} } = req.body;

    console.log('Initiating Agent payment for booking:', bookingId);

    // Create payment with cash_agent method
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!canManageBookingPayment(req.user, booking)) {
      return notAuthorized(res, 'Only the booking shipper can initiate an agent payment');
    }

    const payment = await paymentService.createPayment(bookingId, amount, 'cash_agent', customer);

    // Generate a shorter, agent-friendly reference (6 digits)
    const agentCode = generateAgentCode();

    // Update payment with agent code
    payment.metadata = {
      ...payment.metadata,
      agentCode,
      agentCodeGeneratedAt: new Date()
    };
    await payment.save();

    // Calculate expiry time (24 hours)
    const expiresAt = new Date(payment.expiresAt);

    res.status(201).json({
      success: true,
      data: {
        paymentId: payment._id,
        paymentReference: payment.paymentReference,
        agentCode, // Short code for agent payments
        amount: payment.amount,
        currency: payment.currency,
        expiresAt,
        instructions: {
          title: 'Pay at EcoCash Agent',
          steps: [
            'Visit any EcoCash Agent near you',
            `Quote reference: ${agentCode}`,
            `Pay USD $${payment.amount.toFixed(2)}`,
            'Keep your receipt',
            'Payment will be confirmed automatically'
          ],
          merchantCode: process.env.ECOCASH_MERCHANT_CODE || 'PALMTRENT',
          supportPhone: process.env.SUPPORT_PHONE || '+263 77 123 4567',
          validUntil: expiresAt.toISOString(),
          note: 'Please ensure you quote the exact reference number to the agent'
        }
      }
    });

  } catch (error) {
    console.error('Agent payment initiation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate agent payment'
    });
  }
};

// Helper to generate 6-digit agent code
function generateAgentCode() {
  const prefix = 'PT'; // PalmTrent prefix
  const numbers = Math.floor(100000 + Math.random() * 900000); // 6 random digits
  return `${prefix}${numbers}`;
}

// NEW: Verify agent payment by code (for admin/agent confirmation)
exports.verifyAgentPayment = async (req, res) => {
  try {
    const { agentCode, confirmedAmount } = req.body;

    if (!isAdmin(req.user)) {
      return notAuthorized(res, 'Only an admin can manually verify agent payments');
    }

    if (!agentCode) {
      return res.status(400).json({
        success: false,
        message: 'Agent code is required'
      });
    }

    // Find payment by agent code
    const payment = await Payment.findOne({
      'metadata.agentCode': agentCode,
      paymentMethod: 'cash_agent',
      status: { $in: ['pending', 'initiated'] }
    }).populate('booking');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found or already processed'
      });
    }

    // Check if expired
    if (payment.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This payment has expired'
      });
    }

    // Verify amount if provided
    if (confirmedAmount && Math.abs(confirmedAmount - payment.amount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Amount mismatch. Expected: $${payment.amount.toFixed(2)}, Received: $${confirmedAmount.toFixed(2)}`
      });
    }

    // Confirm the payment
    await paymentService.confirmPayment(payment.paymentReference, {
      gateway: 'cash_agent',
      metadata: {
        confirmedBy: req.user?.id || 'agent',
        confirmedAt: new Date(),
        confirmedAmount: confirmedAmount || payment.amount
      }
    });

    res.json({
      success: true,
      data: {
        paymentReference: payment.paymentReference,
        agentCode: payment.metadata.agentCode,
        amount: payment.amount,
        status: 'confirmed',
        bookingReference: payment.booking?.bookingReference
      },
      message: 'Payment confirmed successfully'
    });

  } catch (error) {
    console.error('Agent payment verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify payment'
    });
  }
};

// NEW: EcoCash Agent Webhook - Automatic payment confirmation
// This endpoint receives notifications from EcoCash when cash is deposited at an agent
exports.handleEcocashAgentWebhook = async (req, res) => {
  try {
    const {
      reference,        // Our agent code (e.g., PT123456)
      merchantCode,     // EcoCash merchant code
      amount,           // Amount deposited
      transactionId,    // EcoCash transaction ID
      phoneNumber,      // Customer phone (optional)
      timestamp,        // Transaction timestamp
      signature         // HMAC signature for verification
    } = req.body;

    console.log('EcoCash Agent Webhook received:', {
      reference,
      merchantCode,
      amount,
      transactionId,
      timestamp
    });

    // Step 1: Verify webhook signature whenever an EcoCash secret is configured.
    if (process.env.ECOCASH_WEBHOOK_SECRET) {
      if (!signature) {
        console.error('Missing EcoCash webhook signature');
        return res.status(401).json({
          success: false,
          message: 'Missing signature'
        });
      }
      const crypto = require('crypto');
      const payload = `${reference}${amount}${transactionId}${timestamp}`;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.ECOCASH_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('Invalid EcoCash webhook signature');
        return res.status(401).json({
          success: false,
          message: 'Invalid signature'
        });
      }
    }

    // Step 2: Find payment by agent code
    const payment = await Payment.findOne({
      $or: [
        { 'metadata.agentCode': reference },
        { paymentReference: reference }
      ],
      paymentMethod: 'cash_agent',
      status: { $in: ['pending', 'initiated'] }
    }).populate('booking');

    if (!payment) {
      console.log('Payment not found for reference:', reference);
      // Return 200 to acknowledge receipt (avoid retries for unknown references)
      return res.status(200).json({
        success: false,
        message: 'Payment not found',
        acknowledged: true
      });
    }

    // Step 3: Verify amount matches (with small tolerance for rounding)
    const amountDiff = Math.abs(parseFloat(amount) - payment.amount);
    if (amountDiff > 0.50) {
      console.error('Amount mismatch:', { expected: payment.amount, received: amount });
      return res.status(400).json({
        success: false,
        message: `Amount mismatch. Expected: $${payment.amount.toFixed(2)}, Received: $${parseFloat(amount).toFixed(2)}`
      });
    }

    // Step 4: Check if already processed (idempotency)
    if (payment.status === 'confirmed') {
      console.log('Payment already confirmed:', reference);
      return res.status(200).json({
        success: true,
        message: 'Payment already confirmed',
        acknowledged: true
      });
    }

    // Step 5: Confirm the payment
    await paymentService.confirmPayment(payment.paymentReference, {
      gateway: 'ecocash_agent',
      gatewayReference: transactionId,
      metadata: {
        confirmedBy: 'webhook',
        confirmedAt: new Date(),
        ecocashTransactionId: transactionId,
        customerPhone: phoneNumber,
        webhookTimestamp: timestamp,
        confirmedAmount: parseFloat(amount)
      }
    });

    console.log('Payment confirmed via webhook:', {
      paymentReference: payment.paymentReference,
      agentCode: payment.metadata.agentCode,
      transactionId
    });

    // Step 6: Send notification to user (push + real-time socket)
    try {
      const notificationService = require('../services/notificationService');
      const booking = payment.booking;

      if (booking && booking.user) {
        // Send push notification
        await notificationService.notify(
          booking.user,
          'payment_received',
          'Payment Confirmed!',
          `Your payment of $${payment.amount.toFixed(2)} has been confirmed. Your booking is now being processed.`,
          {
            bookingId: booking._id,
            bookingReference: booking.bookingReference,
            paymentReference: payment.paymentReference,
            amount: payment.amount
          }
        );

        // Send real-time socket event for instant UI update
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${booking.user.toString()}`).emit('payment:confirmed', {
            bookingId: booking._id,
            bookingReference: booking.bookingReference,
            paymentReference: payment.paymentReference,
            agentCode: payment.metadata.agentCode,
            amount: payment.amount,
            status: 'confirmed',
            confirmedAt: new Date()
          });
        }
      }
    } catch (notifyError) {
      console.error('Failed to send payment notification:', notifyError);
      // Don't fail the webhook for notification errors
    }

    // Step 7: Return success
    res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully',
      data: {
        paymentReference: payment.paymentReference,
        agentCode: payment.metadata.agentCode,
        status: 'confirmed',
        bookingReference: payment.booking?.bookingReference
      }
    });

  } catch (error) {
    console.error('EcoCash agent webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
};

// NEW: Webhook health check / test endpoint
exports.testAgentWebhook = async (req, res) => {
  res.json({
    success: true,
    message: 'EcoCash agent webhook endpoint is active',
    merchantCode: process.env.ECOCASH_MERCHANT_CODE || 'PALMTRENT',
    timestamp: new Date().toISOString()
  });
};

// ============ ESCROW ENDPOINTS ============

// Get escrow status for a booking
exports.getEscrowStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const escrow = await escrowService.getEscrowByBooking(bookingId);
    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found for this booking'
      });
    }

    if (!canReadEscrow(req.user, escrow)) {
      return notAuthorized(res);
    }

    res.json({
      success: true,
      data: {
        escrowReference: escrow.escrowReference,
        status: escrow.status,
        amount: escrow.amount,
        platformFee: escrow.platformFee,
        transporterPayout: escrow.transporterPayout,
        commissionRate: escrow.commissionRate,
        heldAt: escrow.heldAt,
        gracePeriodEndsAt: escrow.gracePeriodEndsAt,
        releasedAt: escrow.releasedAt,
        releaseConditions: escrow.releaseConditions,
        dispute: escrow.dispute
      }
    });

  } catch (error) {
    console.error('Error fetching escrow:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching escrow status'
    });
  }
};

// Confirm delivery and start grace period
exports.confirmDeliveryForEscrow = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const escrowToConfirm = await escrowService.getEscrowByBooking(bookingId);
    if (!escrowToConfirm) {
      return res.status(404).json({ success: false, message: 'Escrow not found for this booking' });
    }

    if (!canConfirmEscrowDelivery(req.user, escrowToConfirm)) {
      return notAuthorized(res, 'Only the shipper can confirm escrow delivery');
    }

    const escrow = await escrowService.confirmDelivery(bookingId);

    res.json({
      success: true,
      data: {
        escrowReference: escrow.escrowReference,
        status: escrow.status,
        gracePeriodEndsAt: escrow.gracePeriodEndsAt,
        releaseScheduledAt: escrow.releaseScheduledAt
      },
      message: 'Delivery confirmed. Funds will be released after 24-hour grace period.'
    });

  } catch (error) {
    console.error('Error confirming delivery for escrow:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error confirming delivery'
    });
  }
};

// Raise dispute on escrow
exports.raiseEscrowDispute = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason, description } = req.body;
    const userId = req.user.id;

    if (!reason || !description) {
      return res.status(400).json({
        success: false,
        message: 'Reason and description are required'
      });
    }

    const escrowToDispute = await escrowService.getEscrowByBooking(bookingId);
    if (!escrowToDispute) {
      return res.status(404).json({ success: false, message: 'Escrow not found for this booking' });
    }

    if (!canReadEscrow(req.user, escrowToDispute)) {
      return notAuthorized(res, 'Only shipment parties can dispute this escrow');
    }

    const escrow = await escrowService.raiseDispute(bookingId, userId, reason, description);

    res.json({
      success: true,
      data: {
        escrowReference: escrow.escrowReference,
        status: escrow.status,
        dispute: escrow.dispute
      },
      message: 'Dispute raised successfully. Fund release has been paused.'
    });

  } catch (error) {
    console.error('Error raising escrow dispute:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error raising dispute'
    });
  }
};

// Cancel booking and process refund (before transporter match)
exports.cancelAndRefund = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const escrowToCancel = await escrowService.getEscrowByBooking(bookingId);
    if (!escrowToCancel) {
      return res.status(404).json({ success: false, message: 'Escrow not found for this booking' });
    }

    if (!canCancelEscrow(req.user, escrowToCancel)) {
      return notAuthorized(res, 'Only the shipper can cancel this escrow');
    }

    const escrow = await escrowService.cancelBeforeMatch(bookingId);

    res.json({
      success: true,
      data: {
        escrowReference: escrow.escrowReference,
        status: escrow.status,
        refund: escrow.refund
      },
      message: 'Booking cancelled. Full refund will be processed.'
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling booking'
    });
  }
};

// Record cash collection by transporter
exports.recordCashCollection = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { collectedAmount, collectionType } = req.body;

    if (!collectedAmount || !collectionType) {
      return res.status(400).json({
        success: false,
        message: 'Collected amount and collection type are required'
      });
    }

    const escrowToRecord = await escrowService.getEscrowByBooking(bookingId);
    if (!escrowToRecord) {
      return res.status(404).json({ success: false, message: 'Escrow not found for this booking' });
    }

    if (!canRecordEscrowCashCollection(req.user, escrowToRecord)) {
      return notAuthorized(res, 'Only the assigned transporter can record cash collection');
    }

    const escrow = await escrowService.recordCashCollection(bookingId, collectedAmount, collectionType);

    res.json({
      success: true,
      data: {
        escrowReference: escrow.escrowReference,
        metadata: escrow.metadata
      },
      message: 'Cash collection recorded successfully'
    });

  } catch (error) {
    console.error('Error recording cash collection:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error recording cash collection'
    });
  }
};

// Admin: Release funds manually
exports.adminReleaseFunds = async (req, res) => {
  try {
    const { escrowId } = req.params;

    // Check admin role
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const escrow = await escrowService.releaseFunds(escrowId);

    res.json({
      success: true,
      data: {
        escrowReference: escrow.escrowReference,
        status: escrow.status,
        releasedAt: escrow.releasedAt,
        transporterPayout: escrow.transporterPayout
      },
      message: 'Funds released successfully'
    });

  } catch (error) {
    console.error('Error releasing funds:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error releasing funds'
    });
  }
};

// Admin: Process all escrow releases whose grace periods have elapsed
exports.adminProcessScheduledReleases = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const results = await escrowService.processScheduledReleases();
    const releasedCount = results.filter(result => result.status === 'released').length;

    res.json({
      success: true,
      data: {
        processed: results.length,
        released: releasedCount,
        results
      },
      message: `Processed ${results.length} scheduled escrow release(s)`
    });
  } catch (error) {
    console.error('Error processing scheduled escrow releases:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error processing scheduled escrow releases'
    });
  }
};

// Admin: Resolve dispute
exports.adminResolveDispute = async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { resolution, resolvedInFavorOf, splitPercentage } = req.body;

    // Check admin role
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    if (!resolution || !resolvedInFavorOf) {
      return res.status(400).json({
        success: false,
        message: 'Resolution and resolvedInFavorOf are required'
      });
    }

    if (!['shipper', 'transporter', 'split'].includes(resolvedInFavorOf)) {
      return res.status(400).json({
        success: false,
        message: 'resolvedInFavorOf must be shipper, transporter, or split'
      });
    }

    const escrow = await escrowService.resolveDispute(escrowId, resolution, resolvedInFavorOf, splitPercentage);

    res.json({
      success: true,
      data: {
        escrowReference: escrow.escrowReference,
        status: escrow.status,
        dispute: escrow.dispute
      },
      message: 'Dispute resolved successfully'
    });

  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error resolving dispute'
    });
  }
};

// Admin: Get escrow summary
exports.adminGetEscrowSummary = async (req, res) => {
  try {
    // Check admin role
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const summary = await escrowService.getEscrowSummary();

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error fetching escrow summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching escrow summary'
    });
  }
};

// ============ TRANSPORTER WITHDRAWAL ENDPOINTS ============

const Escrow = require('../models/Escrow');
const Payout = require('../models/Payout');
const User = require('../models/User');

// Get transporter's available balance (funds ready for withdrawal)
exports.getTransporterBalance = async (req, res) => {
  try {
    const transporterId = req.user.id;

    const [availablePayouts, withdrawalPayouts, paidPayouts, pendingEscrows] = await Promise.all([
      payoutService.listWithdrawablePayouts(transporterId),
      Payout.find({
        recipient: transporterId,
        status: { $in: payoutService.WITHDRAWAL_STATUSES },
        'metadata.withdrawalReference': { $exists: true }
      }),
      Payout.find({ recipient: transporterId, status: 'paid' }),
      Escrow.find({
        transporter: transporterId,
        status: { $in: ['held', 'pending_release'] },
        'releaseConditions.deliveryConfirmed': true,
        'releaseConditions.noActiveDispute': true
      })
    ]);

    const availableBalance = payoutService.amountTotal(availablePayouts);
    const pendingBalance = pendingEscrows.reduce((sum, escrow) => sum + Number(escrow.transporterPayout || 0), 0);
    const pendingWithdrawalBalance = payoutService.amountTotal(withdrawalPayouts);
    const totalWithdrawn = payoutService.amountTotal(paidPayouts);

    res.json({
      success: true,
      data: {
        availableBalance,
        pendingBalance,
        pendingWithdrawalBalance,
        totalWithdrawn,
        releasedCount: availablePayouts.length,
        pendingCount: pendingEscrows.length,
        recentReleased: availablePayouts.slice(0, 5).map(payout => ({
          payoutReference: payout.payoutReference,
          amount: payout.amount,
          sourceType: payout.sourceType,
          createdAt: payout.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching transporter balance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching balance'
    });
  }
};

// Request withdrawal of available funds
exports.requestWithdrawal = async (req, res) => {
  try {
    const transporterId = req.user.id;
    const { amount, payoutMethod, accountNumber } = req.body;

    if (!payoutMethod || !accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Payout method and account number are required'
      });
    }

    // Validate payout method
    if (!['ecocash', 'onemoney', 'bank_transfer'].includes(payoutMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payout method. Use ecocash, onemoney, or bank_transfer'
      });
    }

    const withdrawal = await payoutService.reserveWithdrawal({
      recipient: transporterId,
      amount,
      payoutMethod,
      accountNumber,
      accountName: req.body.accountName,
      bankName: req.body.bankName
    });

    res.json({
      success: true,
      data: {
        withdrawalReference: withdrawal.withdrawalReference,
        amount: withdrawal.amount,
        payoutMethod,
        accountNumber: payoutService.maskAccountNumber(accountNumber),
        payoutCount: withdrawal.payoutCount,
        status: 'pending',
        estimatedArrival: payoutMethod === 'bank_transfer' ? '1-3 business days' : 'Within 24 hours'
      },
      message: `Withdrawal request for $${withdrawal.amount.toFixed(2)} has been queued`
    });

  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error processing withdrawal'
    });
  }
};

// Get withdrawal history
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const transporterId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // Withdrawal references live on payout reservations and are updated through admin payout status.
    const reservedPayouts = await Payout.find({
      recipient: transporterId,
      'metadata.withdrawalReference': { $exists: true }
    })
      .sort({ 'metadata.withdrawalRequestedAt': -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Group by withdrawal reference
    const withdrawalMap = new Map();

    for (const payout of reservedPayouts) {
      const ref = payout.metadata.withdrawalReference;
      if (!withdrawalMap.has(ref)) {
        withdrawalMap.set(ref, {
          reference: ref,
          payoutMethod: payout.method,
          accountNumber: payoutService.maskAccountNumber(payout.destination?.accountNumber),
          requestedAt: payout.metadata.withdrawalRequestedAt,
          amount: 0,
          payoutCount: 0,
          statuses: new Set()
        });
      }
      const withdrawal = withdrawalMap.get(ref);
      withdrawal.amount += Number(payout.amount || 0);
      withdrawal.payoutCount += 1;
      withdrawal.statuses.add(payout.status);
    }

    const withdrawals = Array.from(withdrawalMap.values()).map((withdrawal) => ({
      ...withdrawal,
      status: withdrawal.statuses.size === 1
        ? Array.from(withdrawal.statuses)[0]
        : 'mixed',
      statuses: Array.from(withdrawal.statuses)
    }));

    res.json({
      success: true,
      data: {
        withdrawals,
        page: parseInt(page),
        limit: parseInt(limit),
        total: withdrawals.length
      }
    });

  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching withdrawal history'
    });
  }
};

// Update payout preferences
exports.updatePayoutPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { payoutMethod, accountNumber, accountName, bankName } = req.body;

    if (!payoutMethod || !accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Payout method and account number are required'
      });
    }

    if (!['ecocash', 'onemoney', 'bank_transfer'].includes(payoutMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payout method. Use ecocash, onemoney, or bank_transfer'
      });
    }

    const updateData = {
      'payoutPreferences.method': payoutMethod,
      'payoutPreferences.accountNumber': String(accountNumber).trim(),
      'payoutPreferences.accountName': accountName ? String(accountName).trim() : undefined,
      'payoutPreferences.bankName': bankName ? String(bankName).trim() : undefined,
      'payoutPreferences.updatedAt': new Date()
    };

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true })
      .select('payoutPreferences');

    res.json({
      success: true,
      data: user.payoutPreferences,
      message: 'Payout preferences updated successfully'
    });

  } catch (error) {
    console.error('Error updating payout preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating payout preferences'
    });
  }
};

// Get payout preferences
exports.getPayoutPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('payoutPreferences');

    res.json({
      success: true,
      data: user?.payoutPreferences || {
        method: null,
        accountNumber: null,
        accountName: null,
        bankName: null
      }
    });

  } catch (error) {
    console.error('Error fetching payout preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payout preferences'
    });
  }
};

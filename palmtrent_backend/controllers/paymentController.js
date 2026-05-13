// controllers/paymentController.js
const { Paynow } = require("paynow");
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const paymentService = require('../services/paymentService');
const escrowService = require('../services/escrowService');
const openApiAfricaService = require('../services/openApiAfricaService');
const { getIntegrationConfig } = require('../services/integrationSettingsService');

const getPaynowClient = async () => {
  const config = await getIntegrationConfig('paynow');
  if (!config.integrationId || !config.integrationKey) {
    throw new Error('Paynow is not configured. Add credentials in the admin integration settings.');
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

// UPDATED: Initiate Paynow payment (only for gateway methods)
exports.initiatePaynowPayment = async (req, res) => {
  try {
    const { 
      paymentReference,
      customer 
    } = req.body;

    console.log('Initiating Paynow payment for:', paymentReference);

    // Find payment record
    const payment = await Payment.findOne({ paymentReference });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
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
    console.error('Paynow initiation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment initiation failed'
    });
  }
};

// NEW: Confirm cash payment (for agent, pickup, delivery)
exports.confirmCashPayment = async (req, res) => {
  try {
    const { paymentReference } = req.body;

    console.log('Confirming cash payment for:', paymentReference);

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

    const payment = await paymentService.getPaymentByReference(paymentReference);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
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
    const updatedPayment = await paymentService.getPaymentByReference(paymentReference);

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

    const payment = await paymentService.getPaymentByReference(reference);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
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

    // Step 1: Verify webhook signature (if provided)
    if (process.env.ECOCASH_WEBHOOK_SECRET && signature) {
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
const User = require('../models/User');

// Get transporter's available balance (funds ready for withdrawal)
exports.getTransporterBalance = async (req, res) => {
  try {
    const transporterId = req.user.id;

    // Get all released escrows for this transporter
    const releasedEscrows = await Escrow.find({
      transporter: transporterId,
      status: 'released',
      'payoutDetails.processedAt': { $exists: false }
    });

    // Get pending release escrows
    const pendingEscrows = await Escrow.find({
      transporter: transporterId,
      status: 'held',
      'releaseConditions.deliveryConfirmed': true,
      'releaseConditions.noActiveDispute': true
    });

    // Calculate available balance
    const availableBalance = releasedEscrows.reduce((sum, e) => sum + e.transporterPayout, 0);
    const pendingBalance = pendingEscrows.reduce((sum, e) => sum + e.transporterPayout, 0);

    // Get total withdrawn
    const withdrawnEscrows = await Escrow.find({
      transporter: transporterId,
      status: 'released',
      'payoutDetails.processedAt': { $exists: true }
    });
    const totalWithdrawn = withdrawnEscrows.reduce((sum, e) => sum + e.transporterPayout, 0);

    res.json({
      success: true,
      data: {
        availableBalance,
        pendingBalance,
        totalWithdrawn,
        releasedCount: releasedEscrows.length,
        pendingCount: pendingEscrows.length,
        recentReleased: releasedEscrows.slice(0, 5).map(e => ({
          escrowReference: e.escrowReference,
          amount: e.transporterPayout,
          releasedAt: e.releasedAt
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

    // Get available escrows
    const availableEscrows = await Escrow.find({
      transporter: transporterId,
      status: 'released',
      'payoutDetails.processedAt': { $exists: false }
    }).sort({ releasedAt: 1 });

    const totalAvailable = availableEscrows.reduce((sum, e) => sum + e.transporterPayout, 0);

    // Default to full amount if not specified
    const withdrawalAmount = amount || totalAvailable;

    if (withdrawalAmount > totalAvailable) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: $${totalAvailable.toFixed(2)}`
      });
    }

    if (withdrawalAmount < 5) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is $5.00'
      });
    }

    // Generate withdrawal reference
    const withdrawalReference = `WTH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Process withdrawal - mark escrows as paid out
    let processedAmount = 0;
    const processedEscrows = [];

    for (const escrow of availableEscrows) {
      if (processedAmount >= withdrawalAmount) break;

      escrow.payoutDetails = {
        method: payoutMethod,
        accountNumber,
        reference: withdrawalReference,
        processedAt: new Date()
      };
      await escrow.save();

      processedAmount += escrow.transporterPayout;
      processedEscrows.push(escrow.escrowReference);
    }

    // In production, this would trigger actual payout via Paynow or bank API
    // For now, we mark as processed and would manually handle payout

    res.json({
      success: true,
      data: {
        withdrawalReference,
        amount: processedAmount,
        payoutMethod,
        accountNumber: accountNumber.substring(0, 4) + '****' + accountNumber.slice(-4),
        processedEscrows: processedEscrows.length,
        status: 'processing',
        estimatedArrival: payoutMethod === 'bank_transfer' ? '1-3 business days' : 'Within 24 hours'
      },
      message: `Withdrawal of $${processedAmount.toFixed(2)} has been initiated`
    });

  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({
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

    // Get processed escrows (grouped by withdrawal reference)
    const processedEscrows = await Escrow.find({
      transporter: transporterId,
      status: 'released',
      'payoutDetails.processedAt': { $exists: true }
    })
      .sort({ 'payoutDetails.processedAt': -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Group by withdrawal reference
    const withdrawalMap = new Map();

    for (const escrow of processedEscrows) {
      const ref = escrow.payoutDetails.reference;
      if (!withdrawalMap.has(ref)) {
        withdrawalMap.set(ref, {
          reference: ref,
          payoutMethod: escrow.payoutDetails.method,
          accountNumber: escrow.payoutDetails.accountNumber,
          processedAt: escrow.payoutDetails.processedAt,
          amount: 0,
          escrowCount: 0
        });
      }
      const withdrawal = withdrawalMap.get(ref);
      withdrawal.amount += escrow.transporterPayout;
      withdrawal.escrowCount += 1;
    }

    const withdrawals = Array.from(withdrawalMap.values());

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

    const updateData = {
      'payoutPreferences.method': payoutMethod,
      'payoutPreferences.accountNumber': accountNumber,
      'payoutPreferences.accountName': accountName,
      'payoutPreferences.bankName': bankName,
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

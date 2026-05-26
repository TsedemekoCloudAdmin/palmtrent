const SupportTicket = require('../models/SupportTicket');
const Booking = require('../models/Booking');
const { recordAudit } = require('../services/auditService');
const notificationService = require('../services/notificationService');

const VALID_CATEGORIES = new Set(['general', 'booking', 'payment', 'technical', 'account', 'safety', 'dispute', 'other']);
const VALID_STATUSES = new Set(['open', 'pending', 'resolved', 'closed']);
const VALID_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

function normalizeCategory(category) {
  const value = String(category || 'general').trim().toLowerCase();
  return VALID_CATEGORIES.has(value) ? value : 'other';
}

function normalizePriority(priority) {
  const value = String(priority || 'normal').trim().toLowerCase();
  return VALID_PRIORITIES.has(value) ? value : 'normal';
}

function canAccessTicket(ticket, user) {
  return user.userType === 'admin' || ticket.requester?.toString?.() === user.id || ticket.requester?._id?.toString?.() === user.id;
}

async function assertBookingAccess(bookingId, user) {
  if (!bookingId) return null;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  const userId = user.id;
  const canAccess = user.userType === 'admin' ||
    booking.user?.toString?.() === userId ||
    booking.user?._id?.toString?.() === userId ||
    booking.shipper?.toString?.() === userId ||
    booking.shipper?._id?.toString?.() === userId ||
    booking.transporter?.toString?.() === userId ||
    booking.transporter?._id?.toString?.() === userId;

  if (!canAccess) {
    const error = new Error('Not authorized for this booking');
    error.statusCode = 403;
    throw error;
  }

  return booking;
}

exports.createTicket = async (req, res) => {
  try {
    const {
      category,
      subject,
      message,
      bookingId,
      priority,
      source = 'mobile'
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Support message is required' });
    }

    await assertBookingAccess(bookingId, req.user);

    const ticket = await SupportTicket.create({
      requester: req.user.id,
      requesterRole: req.user.userType,
      category: normalizeCategory(category),
      subject: subject?.trim() || 'Support request',
      message: message.trim(),
      booking: bookingId || undefined,
      source,
      priority: normalizePriority(priority),
      contact: {
        name: req.user.fullName,
        email: req.user.email,
        phone: req.user.phone
      },
      conversation: [{
        author: req.user.id,
        authorRole: req.user.userType,
        message: message.trim()
      }]
    });

    await recordAudit({
      actor: req.user,
      action: 'support.ticket_created',
      entityType: 'SupportTicket',
      entityId: ticket._id,
      entityRef: ticket.ticketReference,
      after: { status: ticket.status, category: ticket.category, priority: ticket.priority },
      req
    });

    notificationService.notifyRole(
      'admin',
      'system_message',
      'New support ticket',
      `${req.user.fullName || 'A user'} submitted ${ticket.ticketReference}`,
      { ticketId: ticket._id.toString(), ticketReference: ticket.ticketReference }
    ).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Support ticket submitted',
      data: ticket
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to submit support ticket'
    });
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = req.user.userType === 'admin' ? {} : { requester: req.user.id };
    if (status && status !== 'all') query.status = status;

    const tickets = await SupportTicket.find(query)
      .populate('requester', 'fullName email phone userType')
      .populate('booking', 'bookingReference status')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await SupportTicket.countDocuments(query);

    res.json({
      success: true,
      data: tickets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch support tickets' });
  }
};

exports.getTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('requester', 'fullName email phone userType')
      .populate('booking', 'bookingReference status')
      .populate('conversation.author', 'fullName email userType');

    if (!ticket) return res.status(404).json({ success: false, message: 'Support ticket not found' });
    if (!canAccessTicket(ticket, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this ticket' });
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch support ticket' });
  }
};

exports.addReply = async (req, res) => {
  try {
    const { message, internal = false } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message is required' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Support ticket not found' });
    if (!canAccessTicket(ticket, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this ticket' });
    }
    if (internal && req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can add internal notes' });
    }

    ticket.conversation.push({
      author: req.user.id,
      authorRole: req.user.userType,
      message: message.trim(),
      internal: req.user.userType === 'admin' ? Boolean(internal) : false
    });
    ticket.status = req.user.userType === 'admin' ? 'pending' : 'open';
    await ticket.save();

    await recordAudit({
      actor: req.user,
      action: 'support.ticket_replied',
      entityType: 'SupportTicket',
      entityId: ticket._id,
      entityRef: ticket.ticketReference,
      after: { status: ticket.status, internal: Boolean(internal) },
      req
    });

    res.json({ success: true, message: 'Reply added', data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add reply' });
  }
};

exports.updateTicket = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const updates = {};
    if (req.body.status) {
      if (!VALID_STATUSES.has(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid ticket status' });
      updates.status = req.body.status;
      if (req.body.status === 'resolved') updates.resolvedAt = new Date();
      if (req.body.status === 'closed') updates.closedAt = new Date();
    }
    if (req.body.priority) updates.priority = normalizePriority(req.body.priority);
    if (req.body.assignedTo !== undefined) updates.assignedTo = req.body.assignedTo || undefined;

    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!ticket) return res.status(404).json({ success: false, message: 'Support ticket not found' });

    await recordAudit({
      actor: req.user,
      action: 'support.ticket_updated',
      entityType: 'SupportTicket',
      entityId: ticket._id,
      entityRef: ticket.ticketReference,
      after: updates,
      req
    });

    res.json({ success: true, message: 'Support ticket updated', data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update support ticket' });
  }
};

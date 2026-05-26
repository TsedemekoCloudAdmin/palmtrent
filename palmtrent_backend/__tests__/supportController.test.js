jest.mock('../models/SupportTicket', () => ({
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../models/Booking', () => ({
  findById: jest.fn()
}));

jest.mock('../services/auditService', () => ({
  recordAudit: jest.fn()
}));

jest.mock('../services/notificationService', () => ({
  notifyRole: jest.fn(() => Promise.resolve([]))
}));

const SupportTicket = require('../models/SupportTicket');
const Booking = require('../models/Booking');
const { recordAudit } = require('../services/auditService');
const notificationService = require('../services/notificationService');
const { createTicket } = require('../controllers/supportController');

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('supportController createTicket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates a support ticket and notifies admins', async () => {
    const ticket = {
      _id: 'ticket-1',
      ticketReference: 'SUP-1',
      status: 'open',
      category: 'payment',
      priority: 'normal'
    };
    SupportTicket.create.mockResolvedValue(ticket);
    const res = response();

    await createTicket({
      user: {
        id: 'user-1',
        userType: 'shipper',
        fullName: 'Tariro Moyo',
        email: 'tariro@example.com',
        phone: '+263771234567'
      },
      body: {
        category: 'payment',
        subject: 'Payment help',
        message: 'I need help with a payment',
        source: 'mobile'
      }
    }, res);

    expect(SupportTicket.create).toHaveBeenCalledWith(expect.objectContaining({
      requester: 'user-1',
      requesterRole: 'shipper',
      category: 'payment',
      subject: 'Payment help',
      message: 'I need help with a payment',
      source: 'mobile',
      contact: expect.objectContaining({ email: 'tariro@example.com' })
    }));
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'support.ticket_created',
      entityRef: 'SUP-1'
    }));
    expect(notificationService.notifyRole).toHaveBeenCalledWith(
      'admin',
      'system_message',
      'New support ticket',
      expect.stringContaining('SUP-1'),
      expect.objectContaining({ ticketReference: 'SUP-1' })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: ticket
    }));
  });

  test('rejects empty support messages', async () => {
    const res = response();

    await createTicket({
      user: { id: 'user-1', userType: 'shipper' },
      body: { message: '   ' }
    }, res);

    expect(SupportTicket.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Support message is required'
    }));
  });

  test('blocks tickets against bookings the user cannot access', async () => {
    Booking.findById.mockResolvedValue({
      _id: 'booking-1',
      user: 'other-user',
      transporter: 'transporter-1'
    });
    const res = response();

    await createTicket({
      user: { id: 'user-1', userType: 'shipper' },
      body: {
        bookingId: 'booking-1',
        message: 'I need booking help'
      }
    }, res);

    expect(SupportTicket.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Not authorized for this booking'
    }));
  });
});

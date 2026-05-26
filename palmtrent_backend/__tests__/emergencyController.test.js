jest.mock('../models/Emergency', () => ({
  create: jest.fn(),
  findById: jest.fn()
}));

jest.mock('../models/User', () => ({
  findById: jest.fn()
}));

jest.mock('../models/Booking', () => ({
  findById: jest.fn()
}));

jest.mock('../models/Shipment', () => ({}));

jest.mock('../services/notificationService', () => ({
  notifyRole: jest.fn(),
  notifyEmergency: jest.fn(),
  notify: jest.fn()
}));

jest.mock('../utils/sendSMS', () => ({
  sendSMS: jest.fn()
}));

const Emergency = require('../models/Emergency');
const User = require('../models/User');
const Booking = require('../models/Booking');
const notificationService = require('../services/notificationService');
const { sendSMS } = require('../utils/sendSMS');
const { triggerSOS, acknowledgeEmergency } = require('../controllers/emergencyController');

function populated(value) {
  return {
    populate: jest.fn().mockResolvedValue(value)
  };
}

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('emergencyController notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SUPPORT_PHONE;
  });

  test('routes SOS alerts to admins, emergency contacts, and the booking counterparty', async () => {
    const emergency = {
      _id: { toString: () => 'emergency-1' },
      emergencyType: 'breakdown',
      severity: 'high',
      location: { address: 'Harare Road', coordinates: [31.02, -17.82] },
      booking: { toString: () => 'booking-1' },
      shipment: null,
      contactPhone: '+263771111111',
      notifications: [],
      emergencyContactsNotified: [],
      status: 'triggered',
      save: jest.fn().mockResolvedValue()
    };
    const user = {
      _id: { toString: () => 'shipper-1' },
      fullName: 'Test Shipper',
      phone: '+263771111111',
      userType: 'shipper',
      emergencyContacts: [{
        name: 'Family Contact',
        phone: '+263772222222',
        relationship: 'family'
      }]
    };

    User.findById.mockResolvedValue(user);
    Emergency.create.mockResolvedValue(emergency);
    Booking.findById.mockReturnValue(populated({
      shipper: user,
      transporter: { _id: { toString: () => 'transporter-1' } }
    }));
    notificationService.notifyRole.mockResolvedValue([{ status: 'fulfilled', value: {} }]);
    notificationService.notifyEmergency.mockResolvedValue({});
    sendSMS.mockResolvedValue(true);
    const res = response();

    await triggerSOS({
      user: { id: 'shipper-1' },
      body: {
        emergencyType: 'breakdown',
        location: { coordinates: [31.02, -17.82], address: 'Harare Road' },
        bookingId: 'booking-1'
      }
    }, res);

    expect(notificationService.notifyRole).toHaveBeenCalledWith(
      'admin',
      'emergency_alert',
      'SOS: breakdown',
      expect.stringContaining('Harare Road'),
      expect.objectContaining({ emergencyId: 'emergency-1', bookingId: 'booking-1' })
    );
    expect(sendSMS).toHaveBeenCalledWith(
      '+263772222222',
      expect.stringContaining('Harare Road')
    );
    expect(notificationService.notifyEmergency).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ emergencyId: 'emergency-1', bookingId: 'booking-1' })
    );
    expect(emergency.notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientType: 'support_team', channel: 'push', status: 'sent' }),
      expect.objectContaining({ recipientType: 'emergency_contact', channel: 'sms', status: 'sent' }),
      expect.objectContaining({ recipientType: 'transporter', channel: 'push', status: 'sent' })
    ]));
    expect(emergency.emergencyContactsNotified).toEqual([
      expect.objectContaining({ phone: '+263772222222', relationship: 'family' })
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('notifies the triggering user when support acknowledges an SOS', async () => {
    const emergency = {
      _id: { toString: () => 'emergency-2' },
      triggeredBy: 'shipper-2',
      status: 'acknowledged',
      acknowledge: jest.fn().mockResolvedValue()
    };
    Emergency.findById.mockResolvedValue(emergency);
    notificationService.notify.mockResolvedValue({});
    const res = response();

    await acknowledgeEmergency({
      params: { id: 'emergency-2' },
      user: { id: 'admin-1' }
    }, res);

    expect(emergency.acknowledge).toHaveBeenCalledWith('admin-1');
    expect(notificationService.notify).toHaveBeenCalledWith(
      'shipper-2',
      'emergency_alert',
      'SOS Acknowledged',
      expect.stringContaining('acknowledged'),
      expect.objectContaining({ emergencyId: 'emergency-2' })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

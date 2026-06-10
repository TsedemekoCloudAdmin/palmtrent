// Unit tests for the bus/depot courier controller. Models and side-effecting
// services are mocked so we exercise the access gates, validation, label
// generation, and the collection vs delivery branching on arrival.

const created = [];

jest.mock('../models/CourierShipment', () => {
  const CourierShipment = jest.fn(function (doc) {
    Object.assign(this, doc);
  });
  CourierShipment.create = jest.fn(async (doc) => {
    const shipment = {
      _id: 'cs1',
      statusHistory: [],
      save: jest.fn().mockResolvedValue(true),
      ...doc
    };
    shipment.statusHistory = doc.statusHistory || [];
    return shipment;
  });
  CourierShipment.findById = jest.fn();
  CourierShipment.findOne = jest.fn();
  CourierShipment.find = jest.fn();
  return CourierShipment;
});

jest.mock('../models/Depot', () => ({ findById: jest.fn().mockResolvedValue(null), find: jest.fn() }));
jest.mock('../models/User', () => ({ findOne: jest.fn(() => ({ select: jest.fn().mockResolvedValue(null) })) }));
jest.mock('../models/Booking', () => ({ create: jest.fn().mockResolvedValue({ _id: 'b1' }), findById: jest.fn() }));

jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue(true) }));
jest.mock('../services/matchingService', () => ({ findAndNotifyTransporters: jest.fn().mockResolvedValue(true) }));
jest.mock('../utils/sendSMS', () => ({ sendSMS: jest.fn().mockResolvedValue(true) }));

const CourierShipment = require('../models/CourierShipment');
const Booking = require('../models/Booking');
const courier = require('../controllers/courierController');

function res() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

const agent = { id: 'agent1', userType: 'clerk' };

const validBody = {
  originName: 'Mbare',
  destinationName: 'Bulawayo Depot',
  sender: { name: 'Tariro', phone: '+263771111111' },
  recipient: { name: 'Rudo', phone: '+263772222222' },
  items: [{ description: 'Box of clothes', quantity: 1, weight: 5 }],
  deliveryPreference: 'collection'
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('courier createShipment', () => {
  test('rejects non-agent users', async () => {
    const r = res();
    await courier.createShipment({ user: { id: 'u1', userType: 'shipper' }, body: validBody }, r);
    expect(r.status).toHaveBeenCalledWith(403);
  });

  test('requires recipient details', async () => {
    const r = res();
    await courier.createShipment({ user: agent, body: { ...validBody, recipient: {} } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('requires a delivery address when preference is delivery', async () => {
    const r = res();
    await courier.createShipment({ user: agent, body: { ...validBody, deliveryPreference: 'delivery' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('creates a shipment and returns a label with a CR- reference', async () => {
    const r = res();
    await courier.createShipment({ user: agent, body: validBody }, r);
    expect(CourierShipment.create).toHaveBeenCalled();
    const createdDoc = CourierShipment.create.mock.calls[0][0];
    expect(createdDoc.reference).toMatch(/^CR-/);
    expect(createdDoc.status).toBe('created');
    expect(r.status).toHaveBeenCalledWith(201);
    const payload = r.json.mock.calls[0][0];
    expect(payload.label.code).toMatch(/^CR-/);
    // QR is generated locally on the platform (embedded PNG data URI).
    expect(payload.label.qrImageUrl).toMatch(/^data:image\/png;base64,/);
    expect(createdDoc.qrImage).toMatch(/^data:image\/png;base64,/);
  });
});

describe('courier markArrived branching', () => {
  function shipment(overrides = {}) {
    return {
      _id: 'cs1',
      reference: 'CR-TEST1',
      status: 'in_transit',
      deliveryPreference: 'collection',
      destinationName: 'Bulawayo',
      statusHistory: [],
      sender: {}, recipient: {},
      save: jest.fn().mockResolvedValue(true),
      ...overrides
    };
  }

  test('collection shipment becomes awaiting_collection', async () => {
    const s = shipment({ deliveryPreference: 'collection' });
    CourierShipment.findById.mockResolvedValue(s);
    const r = res();
    await courier.markArrived({ user: agent, params: { id: 'cs1' }, body: {} }, r);
    expect(s.status).toBe('awaiting_collection');
    expect(Booking.create).not.toHaveBeenCalled();
  });

  test('delivery shipment broadcasts a last-mile booking', async () => {
    const s = shipment({ deliveryPreference: 'delivery', deliveryAddress: { address: '5th Ave' } });
    CourierShipment.findById.mockResolvedValue(s);
    const r = res();
    await courier.markArrived({ user: agent, params: { id: 'cs1' }, body: {} }, r);
    expect(s.status).toBe('awaiting_delivery');
    expect(Booking.create).toHaveBeenCalled();
    const booking = Booking.create.mock.calls[0][0];
    expect(booking.serviceType).toBe('courier_delivery');
    expect(booking.status).toBe('finding_transporter');
    expect(booking.paymentStatus).toBe('confirmed');
  });
});

describe('courier ZPL', () => {
  test('getZpl returns a ZPL label with native QR and big reference', async () => {
    const ship = {
      _id: 'cs1', reference: 'CR-Z1', deliveryPreference: 'delivery',
      originName: 'Harare', destinationName: 'Bulawayo',
      recipient: { name: 'Rudo', phone: '+263772222222' }, sender: { name: 'Tariro' },
      packageCount: 2, totalWeight: 8
    };
    CourierShipment.findById.mockResolvedValue(ship);
    const r = res();
    await courier.getZpl({ user: agent, params: { id: 'cs1' }, query: {} }, r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.data.zpl).toContain('^XA');
    expect(payload.data.zpl).toContain('^BQ');
    expect(payload.data.zpl).toContain('CR-Z1');
    expect(payload.data.zpl).toContain('DELIVER');
  });

  test('getZpl rejects non-agents', async () => {
    const r = res();
    await courier.getZpl({ user: { id: 'u1', userType: 'shipper' }, params: { id: 'cs1' }, query: {} }, r);
    expect(r.status).toHaveBeenCalledWith(403);
  });
});

describe('courier markCollected', () => {
  test('requires collector identity', async () => {
    const s = { _id: 'cs1', status: 'awaiting_collection', statusHistory: [], sender: {}, recipient: {}, save: jest.fn() };
    CourierShipment.findById.mockResolvedValue(s);
    const r = res();
    await courier.markCollected({ user: agent, params: { id: 'cs1' }, body: { name: '' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('records handover and marks delivered', async () => {
    const s = { _id: 'cs1', reference: 'CR-X', status: 'awaiting_collection', statusHistory: [], sender: {}, recipient: {}, save: jest.fn().mockResolvedValue(true) };
    CourierShipment.findById.mockResolvedValue(s);
    const r = res();
    await courier.markCollected({ user: agent, params: { id: 'cs1' }, body: { name: 'Rudo', idNumber: '63-123456X00' } }, r);
    expect(s.handover.name).toBe('Rudo');
    expect(s.status).toBe('delivered');
  });
});

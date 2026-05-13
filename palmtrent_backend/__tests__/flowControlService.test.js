const {
  assertBookingTransition,
  assertShipmentTransition,
  getVehicleComplianceIssues,
  getDriverComplianceIssues,
  isPaymentConfirmed
} = require('../services/flowControlService');

describe('flowControlService', () => {
  test('allows the core booking lifecycle in order', () => {
    expect(() => assertBookingTransition('pending_payment', 'payment_confirmed')).not.toThrow();
    expect(() => assertBookingTransition('payment_confirmed', 'finding_transporter')).not.toThrow();
    expect(() => assertBookingTransition('finding_transporter', 'transporter_assigned')).not.toThrow();
    expect(() => assertBookingTransition('transporter_assigned', 'en_route_pickup')).not.toThrow();
    expect(() => assertBookingTransition('en_route_pickup', 'picked_up')).not.toThrow();
    expect(() => assertBookingTransition('picked_up', 'in_transit')).not.toThrow();
    expect(() => assertBookingTransition('in_transit', 'delivered')).not.toThrow();
  });

  test('blocks invalid booking transitions', () => {
    expect(() => assertBookingTransition('pending_payment', 'finding_transporter')).toThrow(/Invalid booking status transition/);
    expect(() => assertBookingTransition('delivered', 'in_transit')).toThrow(/Invalid booking status transition/);
  });

  test('allows shipment lifecycle milestones in order', () => {
    expect(() => assertShipmentTransition('assigned', 'en_route_pickup')).not.toThrow();
    expect(() => assertShipmentTransition('en_route_pickup', 'picked_up')).not.toThrow();
    expect(() => assertShipmentTransition('picked_up', 'in_transit')).not.toThrow();
    expect(() => assertShipmentTransition('in_transit', 'arrived_delivery')).not.toThrow();
    expect(() => assertShipmentTransition('arrived_delivery', 'delivered')).not.toThrow();
  });

  test('detects confirmed payment consistently', () => {
    expect(isPaymentConfirmed({ paymentStatus: 'confirmed' })).toBe(true);
    expect(isPaymentConfirmed({ payment: { status: 'escrowed' } })).toBe(true);
    expect(isPaymentConfirmed({ paymentConfirmedAt: new Date() })).toBe(true);
    expect(isPaymentConfirmed({ paymentStatus: 'pending' })).toBe(false);
  });

  test('flags expired vehicle and driver compliance', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const vehicleIssues = getVehicleComplianceIssues({
      status: 'available',
      verification: { status: 'approved' },
      insurance: { expiryDate: yesterday },
      documents: { license: { expiryDate: yesterday }, permits: [] }
    });
    expect(vehicleIssues).toEqual(expect.arrayContaining(['Vehicle insurance has expired', 'Vehicle license has expired']));

    const driverIssues = getDriverComplianceIssues({
      status: 'available',
      availability: { isAvailable: true },
      licenseExpiry: yesterday
    });
    expect(driverIssues).toContain('Driver license has expired');
  });
});

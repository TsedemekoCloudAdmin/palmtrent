const {
  assertPaymentTransition,
  assertRentalTransition,
  canConfirmRentalPayment,
  canCompleteRoadsideAssistance,
  isTerminalPaymentStatus
} = require('../services/paymentStateMachine');

describe('paymentStateMachine', () => {
  test('allows normal payment progressions and blocks downgrades from terminal states', () => {
    expect(assertPaymentTransition('pending', 'initiated')).toBe(true);
    expect(assertPaymentTransition('initiated', 'processing')).toBe(true);
    expect(assertPaymentTransition('processing', 'confirmed')).toBe(true);
    expect(isTerminalPaymentStatus('confirmed')).toBe(true);
    expect(() => assertPaymentTransition('confirmed', 'processing')).toThrow('Invalid payment transition');
  });

  test('allows rental handover lifecycle transitions', () => {
    expect(assertRentalTransition('pending', 'approved')).toBe(true);
    expect(assertRentalTransition('approved', 'confirmed')).toBe(true);
    expect(assertRentalTransition('confirmed', 'active')).toBe(true);
    expect(assertRentalTransition('active', 'completed')).toBe(true);
    expect(() => assertRentalTransition('completed', 'active')).toThrow('Invalid rental transition');
  });

  test('identifies rentals that can be confirmed by payment', () => {
    expect(canConfirmRentalPayment({ status: 'pending' })).toBe(true);
    expect(canConfirmRentalPayment({ status: 'payment_pending' })).toBe(true);
    expect(canConfirmRentalPayment({ status: 'active' })).toBe(false);
  });

  test('requires paid or waived roadside assistance before completion', () => {
    expect(canCompleteRoadsideAssistance(
      { billing: { amount: 75, paymentStatus: 'pending' } },
      { status: 'on_scene', quote: { total: 75 } }
    )).toEqual(expect.objectContaining({
      allowed: false,
      paymentRequired: true
    }));

    expect(canCompleteRoadsideAssistance(
      { billing: { amount: 75, paymentStatus: 'paid' } },
      { status: 'on_scene', quote: { total: 75 } }
    )).toEqual(expect.objectContaining({
      allowed: true,
      paymentRequired: false
    }));
  });
});

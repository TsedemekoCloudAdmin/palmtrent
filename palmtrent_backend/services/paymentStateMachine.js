const PAYMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  INITIATED: 'initiated',
  PROCESSING: 'processing',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
});

const TERMINAL_PAYMENT_STATUSES = new Set([
  PAYMENT_STATUSES.CONFIRMED,
  PAYMENT_STATUSES.FAILED,
  PAYMENT_STATUSES.CANCELLED,
  PAYMENT_STATUSES.REFUNDED
]);

const PAYMENT_TRANSITIONS = Object.freeze({
  [PAYMENT_STATUSES.PENDING]: [
    PAYMENT_STATUSES.INITIATED,
    PAYMENT_STATUSES.PROCESSING,
    PAYMENT_STATUSES.CONFIRMED,
    PAYMENT_STATUSES.FAILED,
    PAYMENT_STATUSES.CANCELLED
  ],
  [PAYMENT_STATUSES.INITIATED]: [
    PAYMENT_STATUSES.PROCESSING,
    PAYMENT_STATUSES.CONFIRMED,
    PAYMENT_STATUSES.FAILED,
    PAYMENT_STATUSES.CANCELLED
  ],
  [PAYMENT_STATUSES.PROCESSING]: [
    PAYMENT_STATUSES.CONFIRMED,
    PAYMENT_STATUSES.FAILED,
    PAYMENT_STATUSES.CANCELLED
  ],
  [PAYMENT_STATUSES.CONFIRMED]: [
    PAYMENT_STATUSES.REFUNDED
  ],
  [PAYMENT_STATUSES.FAILED]: [],
  [PAYMENT_STATUSES.CANCELLED]: [],
  [PAYMENT_STATUSES.REFUNDED]: []
});

const RENTAL_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  PAYMENT_PENDING: 'payment_pending',
  CONFIRMED: 'confirmed',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
  OVERDUE: 'overdue'
});

const RENTAL_TRANSITIONS = Object.freeze({
  [RENTAL_STATUSES.PENDING]: [
    RENTAL_STATUSES.APPROVED,
    RENTAL_STATUSES.CONFIRMED,
    RENTAL_STATUSES.CANCELLED,
    RENTAL_STATUSES.DISPUTED
  ],
  [RENTAL_STATUSES.APPROVED]: [
    RENTAL_STATUSES.PAYMENT_PENDING,
    RENTAL_STATUSES.CONFIRMED,
    RENTAL_STATUSES.CANCELLED,
    RENTAL_STATUSES.DISPUTED
  ],
  [RENTAL_STATUSES.PAYMENT_PENDING]: [
    RENTAL_STATUSES.CONFIRMED,
    RENTAL_STATUSES.CANCELLED,
    RENTAL_STATUSES.DISPUTED
  ],
  [RENTAL_STATUSES.CONFIRMED]: [
    RENTAL_STATUSES.ACTIVE,
    RENTAL_STATUSES.CANCELLED,
    RENTAL_STATUSES.DISPUTED,
    RENTAL_STATUSES.OVERDUE
  ],
  [RENTAL_STATUSES.ACTIVE]: [
    RENTAL_STATUSES.COMPLETED,
    RENTAL_STATUSES.DISPUTED,
    RENTAL_STATUSES.OVERDUE
  ],
  [RENTAL_STATUSES.OVERDUE]: [
    RENTAL_STATUSES.COMPLETED,
    RENTAL_STATUSES.DISPUTED,
    RENTAL_STATUSES.CANCELLED
  ],
  [RENTAL_STATUSES.DISPUTED]: [
    RENTAL_STATUSES.COMPLETED,
    RENTAL_STATUSES.CANCELLED
  ],
  [RENTAL_STATUSES.COMPLETED]: [],
  [RENTAL_STATUSES.CANCELLED]: []
});

const EMERGENCY_STATUSES = Object.freeze({
  TRIGGERED: 'triggered',
  ACKNOWLEDGED: 'acknowledged',
  RESPONDING: 'responding',
  ON_SCENE: 'on_scene',
  RESOLVED: 'resolved',
  FALSE_ALARM: 'false_alarm',
  CANCELLED: 'cancelled'
});

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function canTransition(map, currentStatus, nextStatus) {
  const current = normalizeStatus(currentStatus);
  const next = normalizeStatus(nextStatus);
  if (!current || current === next) return true;
  return (map[current] || []).includes(next);
}

function assertTransition(map, currentStatus, nextStatus, label = 'state') {
  if (canTransition(map, currentStatus, nextStatus)) return true;
  const error = new Error(`Invalid ${label} transition from ${currentStatus || 'unknown'} to ${nextStatus}.`);
  error.statusCode = 409;
  throw error;
}

function assertPaymentTransition(currentStatus, nextStatus) {
  return assertTransition(PAYMENT_TRANSITIONS, currentStatus, nextStatus, 'payment');
}

function assertRentalTransition(currentStatus, nextStatus) {
  return assertTransition(RENTAL_TRANSITIONS, currentStatus, nextStatus, 'rental');
}

function isTerminalPaymentStatus(status) {
  return TERMINAL_PAYMENT_STATUSES.has(normalizeStatus(status));
}

function canConfirmRentalPayment(rental) {
  return [
    RENTAL_STATUSES.PENDING,
    RENTAL_STATUSES.APPROVED,
    RENTAL_STATUSES.PAYMENT_PENDING
  ].includes(normalizeStatus(rental?.status));
}

function canCompleteRoadsideAssistance(emergency, responseItem) {
  const paymentStatus = normalizeStatus(emergency?.billing?.paymentStatus);
  const amount = Number(emergency?.billing?.amount || responseItem?.quote?.total || 0);
  const responderStatus = normalizeStatus(responseItem?.status);
  return {
    allowed: ['accepted', 'on_scene'].includes(responderStatus) && (amount <= 0 || ['paid', 'waived'].includes(paymentStatus)),
    paymentRequired: amount > 0 && !['paid', 'waived'].includes(paymentStatus),
    amount,
    paymentStatus,
    responderStatus
  };
}

module.exports = {
  PAYMENT_STATUSES,
  RENTAL_STATUSES,
  EMERGENCY_STATUSES,
  PAYMENT_TRANSITIONS,
  RENTAL_TRANSITIONS,
  canTransition,
  assertPaymentTransition,
  assertRentalTransition,
  isTerminalPaymentStatus,
  canConfirmRentalPayment,
  canCompleteRoadsideAssistance
};

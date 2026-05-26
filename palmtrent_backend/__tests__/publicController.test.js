jest.mock('../models/Booking', () => ({}));
jest.mock('../models/Plan', () => ({}));
jest.mock('../models/Rating', () => ({}));
jest.mock('../models/Subscription', () => ({}));
jest.mock('../services/monetizationService', () => ({}));

const { isPlanCompatibleWithUser } = require('../controllers/publicController');

test('fleet owner plans are compatible with transporter accounts', () => {
  expect(isPlanCompatibleWithUser('trailer_owner', 'transporter')).toBe(true);
});

test('plan compatibility rejects unrelated account types', () => {
  expect(isPlanCompatibleWithUser('corporate', 'transporter')).toBe(false);
  expect(isPlanCompatibleWithUser('transporter', 'shipper')).toBe(false);
});

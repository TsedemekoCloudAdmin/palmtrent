jest.mock('../models/Payment', () => ({
  find: jest.fn()
}));

jest.mock('../services/openApiAfricaService', () => ({
  checkAndUpdateStatus: jest.fn()
}));

jest.mock('../services/ecocashOpenApiService', () => ({
  reconcilePendingCashAgentPayments: jest.fn()
}));

const Payment = require('../models/Payment');
const openApiAfricaService = require('../services/openApiAfricaService');
const ecocashOpenApiService = require('../services/ecocashOpenApiService');
const reconciliationService = require('../services/paymentReconciliationService');

function mockPaymentQuery(payments) {
  const query = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(payments)
  };
  Payment.find.mockReturnValue(query);
  return query;
}

describe('paymentReconciliationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('checks pending OpenAPI Africa payments and summarizes statuses', async () => {
    mockPaymentQuery([
      { paymentReference: 'PAY-1' },
      { paymentReference: 'PAY-2' }
    ]);
    openApiAfricaService.checkAndUpdateStatus
      .mockResolvedValueOnce({ status: 'confirmed', rawStatus: 'PAID' })
      .mockResolvedValueOnce({ status: 'processing', rawStatus: 'PENDING' });

    const result = await reconciliationService.reconcilePendingOpenApiPayments({ limit: 10, minAgeMs: 1 });

    expect(Payment.find).toHaveBeenCalledWith(expect.objectContaining({
      gateway: 'openapi_africa',
      status: { $in: ['pending', 'initiated', 'processing'] }
    }));
    expect(openApiAfricaService.checkAndUpdateStatus).toHaveBeenCalledTimes(2);
    expect(result.checked).toBe(2);
    expect(result.summary).toEqual({ confirmed: 1, processing: 1 });
  });

  test('runs OpenAPI Africa and EcoCash reconciliation together', async () => {
    mockPaymentQuery([]);
    ecocashOpenApiService.reconcilePendingCashAgentPayments.mockResolvedValue({ checked: 0 });

    const result = await reconciliationService.reconcileAllPendingPayments({ limit: 5 });

    expect(result.openApiAfrica).toEqual(expect.objectContaining({ checked: 0 }));
    expect(result.ecocashAgent).toEqual({ checked: 0 });
  });
});

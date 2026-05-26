jest.mock('../models/User', () => ({}));

jest.mock('../models/CorporateAccount', () => ({
  findOne: jest.fn()
}));

const CorporateAccount = require('../models/CorporateAccount');
const { requireCorporatePermission } = require('../middleware/auth');

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('requireCorporatePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('allows the corporate owner all permissions', async () => {
    CorporateAccount.findOne.mockResolvedValue({
      user: { toString: () => 'owner-1' },
      settings: { allowedUsers: [] }
    });
    const next = jest.fn();
    const res = response();

    await requireCorporatePermission('manage_team')({
      user: { _id: 'owner-1', id: 'owner-1', userType: 'corporate' }
    }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('denies members without the required permission', async () => {
    CorporateAccount.findOne.mockResolvedValue({
      user: { toString: () => 'owner-1' },
      settings: {
        allowedUsers: [{
          user: { toString: () => 'member-1' },
          role: 'viewer',
          permissions: ['view_all_bookings']
        }]
      }
    });
    const next = jest.fn();
    const res = response();

    await requireCorporatePermission('manage_team')({
      user: { _id: 'member-1', id: 'member-1', userType: 'corporate' }
    }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Corporate permission manage_team is required'
    });
  });

  test('uses legacy role defaults when member permissions are not populated yet', async () => {
    CorporateAccount.findOne.mockResolvedValue({
      user: { toString: () => 'owner-1' },
      settings: {
        allowedUsers: [{
          user: { toString: () => 'member-1' },
          role: 'manager'
        }]
      }
    });
    const next = jest.fn();
    const res = response();

    await requireCorporatePermission('view_reports')({
      user: { _id: 'member-1', id: 'member-1', userType: 'corporate' }
    }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn()
}));

jest.mock('../models/Booking', () => ({}));
jest.mock('../models/CorporateReportSchedule', () => ({}));
jest.mock('../models/Invoice', () => ({}));

jest.mock('../models/CorporateAccount', () => ({
  findOne: jest.fn()
}));

jest.mock('../services/auditService', () => ({
  recordAudit: jest.fn()
}));

jest.mock('../services/uploadFinalizationService', () => ({
  finalizeUploadedFile: jest.fn()
}));

const User = require('../models/User');
const CorporateAccount = require('../models/CorporateAccount');
const { inviteUser, updateUser } = require('../controllers/corporateController');

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('corporateController team permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('inviteUser stores sanitized permissions with the invited member', async () => {
    const corporateAccount = {
      _id: 'corp-1',
      settings: { allowedUsers: [] },
      save: jest.fn().mockResolvedValue()
    };
    const user = {
      _id: 'user-2',
      userType: 'shipper',
      save: jest.fn().mockResolvedValue()
    };
    CorporateAccount.findOne.mockResolvedValue(corporateAccount);
    User.findOne.mockResolvedValue(user);
    const res = response();

    await inviteUser({
      user: { id: 'admin-1' },
      body: {
        email: 'member@example.com',
        role: 'manager',
        permissions: ['create_bookings', 'view_reports', 'not_real']
      }
    }, res);

    expect(corporateAccount.settings.allowedUsers).toEqual([{
      user: 'user-2',
      role: 'manager',
      permissions: ['create_bookings', 'view_reports']
    }]);
    expect(user.userType).toBe('corporate');
    expect(user.corporateAccount).toBe('corp-1');
    expect(corporateAccount.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        role: 'manager',
        permissions: ['create_bookings', 'view_reports']
      })
    }));
  });

  test('updateUser updates role and permission set', async () => {
    const allowedUser = {
      user: { toString: () => 'user-2' },
      role: 'viewer',
      permissions: ['view_all_bookings']
    };
    const corporateAccount = {
      settings: { allowedUsers: [allowedUser] },
      save: jest.fn().mockResolvedValue()
    };
    CorporateAccount.findOne.mockResolvedValue(corporateAccount);
    const res = response();

    await updateUser({
      user: { id: 'admin-1' },
      params: { userId: 'user-2' },
      body: {
        role: 'admin',
        permissions: ['manage_team', 'view_all_bookings']
      }
    }, res);

    expect(allowedUser.role).toBe('admin');
    expect(allowedUser.permissions).toEqual(['manage_team', 'view_all_bookings']);
    expect(corporateAccount.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        role: 'admin',
        permissions: ['manage_team', 'view_all_bookings']
      })
    }));
  });
});

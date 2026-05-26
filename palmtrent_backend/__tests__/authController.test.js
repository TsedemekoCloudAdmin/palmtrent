jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn()
}));

jest.mock('../models/VerificationCode', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/PasswordReset', () => ({
  create: jest.fn(),
  findOne: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  generateToken: jest.fn(() => 'jwt-token')
}));

jest.mock('../utils/generateCode', () => ({
  generateVerificationCode: jest.fn(),
  generateRandomToken: jest.fn(() => 'reset-token')
}));

jest.mock('../utils/sendSMS', () => ({
  sendVerificationSMS: jest.fn()
}));

jest.mock('../utils/sendEmail', () => ({
  sendPasswordResetEmail: jest.fn()
}));

const User = require('../models/User');
const { register, login, updateProfile } = require('../controllers/authController');

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
});

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.DISABLE_SMS_DELIVERY;
});

test('register bypasses phone verification when SMS delivery is disabled for testing', async () => {
  process.env.DISABLE_SMS_DELIVERY = 'true';
  User.findOne.mockResolvedValue(null);
  const user = {
    _id: 'user-1',
    fullName: 'Test Shipper',
    email: 'shipper@example.com',
    phone: '+263771234567',
    userType: 'shipper',
    isPhoneVerified: true
  };
  User.create.mockResolvedValue(user);

  const res = createRes();

  await register({
    body: {
      fullName: 'Test Shipper',
      email: 'shipper@example.com',
      phone: '+263771234567',
      password: 'password123',
      userType: 'shipper'
    }
  }, res);

  expect(User.create).toHaveBeenCalledWith({
    fullName: 'Test Shipper',
    email: 'shipper@example.com',
    phone: '+263771234567',
    password: 'password123',
    userType: 'shipper',
    isPhoneVerified: true
  });
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: true,
    token: 'jwt-token'
  }));
});

test('register returns a validation response for invalid model data', async () => {
  process.env.DISABLE_SMS_DELIVERY = 'true';
  User.findOne.mockResolvedValue(null);
  const validationError = new Error('User validation failed');
  validationError.name = 'ValidationError';
  validationError.errors = {
    email: {
      path: 'email',
      message: 'Please enter a valid email'
    }
  };
  User.create.mockRejectedValue(validationError);

  const res = createRes();

  await register({
    body: {
      fullName: 'Test Shipper',
      email: 'not-an-email',
      phone: '+263771234567',
      password: 'password123',
      userType: 'shipper'
    }
  }, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({
    success: false,
    message: 'Please enter a valid email',
    errors: [{
      field: 'email',
      message: 'Please enter a valid email'
    }]
  });
});

test('login accepts email credentials and returns top-level auth fields for web clients', async () => {
  const user = {
    _id: 'user-1',
    email: 'shipper@example.com',
    status: 'active',
    comparePassword: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockResolvedValue()
  };

  User.findOne.mockReturnValue({
    select: jest.fn().mockResolvedValue(user)
  });

  const req = {
    body: {
      email: 'SHIPPER@example.com',
      password: 'password123'
    }
  };
  const res = createRes();

  await login(req, res);

  expect(User.findOne).toHaveBeenCalledWith({ email: 'shipper@example.com' });
  expect(user.comparePassword).toHaveBeenCalledWith('password123');
  expect(user.save).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    message: 'Login successful',
    user,
    token: 'jwt-token',
    data: {
      user,
      token: 'jwt-token'
    }
  });
});

test('login still accepts phone credentials for mobile clients', async () => {
  const user = {
    _id: 'user-1',
    phone: '+263771234567',
    status: 'active',
    comparePassword: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockResolvedValue()
  };

  User.findOne.mockReturnValue({
    select: jest.fn().mockResolvedValue(user)
  });

  const req = {
    body: {
      phone: '+263771234567',
      password: 'password123'
    }
  };
  const res = createRes();

  await login(req, res);

  expect(User.findOne).toHaveBeenCalledWith({ phone: '+263771234567' });
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: true,
    token: 'jwt-token'
  }));
});

test('updateProfile persists normalized phone and only provided fields', async () => {
  const updatedUser = {
    _id: 'user-1',
    email: 'shipper@example.com',
    phone: '+263771234567',
    fullName: 'Updated User'
  };
  User.findOne.mockResolvedValue(null);
  User.findByIdAndUpdate.mockResolvedValue(updatedUser);
  const res = createRes();

  await updateProfile({
    user: { id: 'user-1' },
    body: {
      phone: '0771234567',
      preferences: { notifications: { push: false } }
    }
  }, res);

  expect(User.findOne).toHaveBeenCalledWith({
    phone: '+263771234567',
    _id: { $ne: 'user-1' }
  });
  expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
    'user-1',
    {
      $set: {
        phone: '+263771234567',
        preferences: { notifications: { push: false } },
        profileCompleted: true
      }
    },
    { new: true, runValidators: true }
  );
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    message: 'Profile updated successfully',
    data: { user: updatedUser }
  });
});

test('updateProfile rejects duplicate phone numbers', async () => {
  User.findOne.mockResolvedValue({ _id: 'other-user' });
  const res = createRes();

  await updateProfile({
    user: { id: 'user-1' },
    body: { phone: '+263771234567' }
  }, res);

  expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith({
    success: false,
    message: 'Phone number is already in use'
  });
});

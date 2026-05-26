const {
  getMissingEnv,
  paynowDirectRailRequired
} = require('../config/validateEnv');

describe('production environment validation', () => {
  const originalEnv = process.env;

  const baseProductionEnv = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(40),
    MONGODB_URI: 'mongodb://mongo:27017/palmtrent',
    INTEGRATION_SECRET_KEY: 'b'.repeat(40),
    FRONTEND_URL: 'https://app.palmtrent.example',
    API_BASE_URL: 'https://api.palmtrent.example',
    CORS_ORIGINS: 'https://app.palmtrent.example',
    INTERNAL_JOB_KEY: 'job-key',
    MAPBOX_ACCESS_TOKEN: 'mapbox-token',
    OPENAPI_AFRICA_PUBLIC_UNIQUE_ID: 'clicknpay-public-id',
    OPENAPI_AFRICA_RETURN_URL: 'https://app.palmtrent.example/payment/return',
    WHATSAPP_PHONE_NUMBER_ID: 'phone-number-id',
    WHATSAPP_ACCESS_TOKEN: 'whatsapp-access-token',
    WHATSAPP_VERIFY_TOKEN: 'whatsapp-verify-token',
    WHATSAPP_APP_SECRET: 'whatsapp-app-secret',
    TWILIO_ACCOUNT_SID: 'twilio-sid',
    TWILIO_AUTH_TOKEN: 'twilio-auth-token',
    TWILIO_PHONE_NUMBER: '+263000000000',
    FIREBASE_SERVICE_ACCOUNT: '{"project_id":"palmtrent"}',
    EMAIL_HOST: 'smtp.example.com',
    EMAIL_USER: 'mailer@example.com',
    EMAIL_PASS: 'email-password',
    EMAIL_FROM: 'Palmtrent <mailer@example.com>',
    STORAGE_DRIVER: 's3',
    STORAGE_BUCKET: 'palmtrent',
    STORAGE_REGION: 'af-south-1',
    STORAGE_ACCESS_KEY_ID: 'storage-key',
    STORAGE_SECRET_ACCESS_KEY: 'storage-secret',
    UPLOAD_SCAN_COMMAND: 'clamscan'
  };

  beforeEach(() => {
    process.env = { ...baseProductionEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('does not require Paynow direct rail when ClicknPay/OpenAPI Africa is configured', () => {
    const missing = getMissingEnv({ production: true });

    expect(missing).toEqual([]);
    paynowDirectRailRequired.forEach(key => {
      expect(missing).not.toContain(key);
    });
  });

  test('requires Paynow credentials only when direct rail is explicitly enabled', () => {
    process.env.ENABLE_PAYNOW_DIRECT_RAIL = 'true';

    const missing = getMissingEnv({ production: true });

    expect(missing).toEqual(expect.arrayContaining(paynowDirectRailRequired));
  });
});

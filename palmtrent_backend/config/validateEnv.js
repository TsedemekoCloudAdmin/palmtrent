const requiredAlways = ['JWT_SECRET', 'MONGODB_URI'];
const requiredInProduction = [
  'FRONTEND_URL',
  'API_BASE_URL'
];

const recommendedInProduction = [
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'PAYNOW_INTEGRATION_ID',
  'PAYNOW_INTEGRATION_KEY'
];

function validateEnv() {
  const missing = requiredAlways.filter(key => !process.env[key]);
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    missing.push(...requiredInProduction.filter(key => !process.env[key]));
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (isProduction) {
    const missingRecommended = recommendedInProduction.filter(key => !process.env[key]);
    if (missingRecommended.length > 0) {
      console.warn(`Production warning: missing integration variables: ${missingRecommended.join(', ')}`);
    }
  }
}

module.exports = validateEnv;

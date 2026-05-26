const { isSmsDeliveryDisabled } = require('./smsSettings');

const sendSMS = async (phone, body) => {
  try {
    if (isSmsDeliveryDisabled()) {
      console.log(`SMS delivery disabled. SMS for ${phone}: ${body}`);
      return true;
    }

    const {
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER
    } = process.env;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      if (process.env.NODE_ENV === 'production') {
        console.error('SMS provider is not configured for production delivery');
        return false;
      }

      console.log(`SMS for ${phone}: ${body}`);
      return true;
    }

    const client = require('twilio')(
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN
    );

    await client.messages.create({
      body,
      from: TWILIO_PHONE_NUMBER,
      to: phone
    });

    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
};

const sendVerificationSMS = async (phone, code) => {
  return sendSMS(phone, `Your Palmtrent verification code is: ${code}`);
};

module.exports = {
  sendSMS,
  sendVerificationSMS
};

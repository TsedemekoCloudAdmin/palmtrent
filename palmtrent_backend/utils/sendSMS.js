// For production, you would use Twilio or similar service
// This is a mock implementation for development

const sendVerificationSMS = async (phone, code) => {
  try {
    // In development, log the code to console
    console.log(`SMS Verification Code for ${phone}: ${code}`);
    
    // For production with Twilio:
    /*
    const client = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    await client.messages.create({
      body: `Your Palmtrent verification code is: ${code}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    */
    
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
};

module.exports = {
  sendVerificationSMS
};
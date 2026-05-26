function isSmsDeliveryDisabled() {
  return process.env.DISABLE_SMS_DELIVERY === 'true';
}

module.exports = {
  isSmsDeliveryDisabled
};

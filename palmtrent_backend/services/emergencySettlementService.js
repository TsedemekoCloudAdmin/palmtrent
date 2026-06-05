const monetizationService = require('./monetizationService');
const { canCompleteRoadsideAssistance } = require('./paymentStateMachine');

function getEmergencyAssistanceAmounts(emergency, responseItem) {
  const amount = Number(emergency.billing?.amount || responseItem.quote?.total || 0);
  const providerEarnings = Number(
    emergency.billing?.providerEarnings ||
    Math.max(0, amount - Number(emergency.billing?.platformFee || 0))
  );
  const platformFee = Number(emergency.billing?.platformFee || Math.max(0, amount - providerEarnings));

  return {
    amount,
    providerEarnings,
    platformFee,
    currency: emergency.billing?.currency || responseItem.quote?.currency || 'USD'
  };
}

async function settleCompletedRoadsideAssistance(emergency, responseItem, responder, actorId) {
  const completionCheck = canCompleteRoadsideAssistance(emergency, responseItem);
  if (completionCheck.paymentRequired) {
    const error = new Error('SOS assistance must be paid or waived before it can be completed.');
    error.statusCode = 402;
    throw error;
  }

  if (!completionCheck.allowed) {
    const error = new Error('Responder must accept and arrive before completing assistance.');
    error.statusCode = 409;
    throw error;
  }

  const { amount, providerEarnings, platformFee, currency } = getEmergencyAssistanceAmounts(emergency, responseItem);

  if (platformFee > 0) {
    await monetizationService.recordLedgerEntryOnce(
      { sourceType: 'emergency', sourceId: emergency._id, category: 'commission', status: 'posted' },
      {
        sourceType: 'emergency',
        sourceId: emergency._id,
        user: responder.user,
        direction: 'credit',
        category: 'commission',
        amount: platformFee,
        currency,
        status: 'posted',
        metadata: {
          emergencyType: emergency.emergencyType,
          responder: responder._id,
          quoteReference: responseItem.quote?.quoteReference,
          paymentReference: emergency.billing?.paymentReference,
          paymentSource: emergency.billing?.paymentSource || 'separate_payment'
        }
      }
    );
  }

  if (providerEarnings > 0) {
    const payout = await monetizationService.createPayoutOnce(
      { sourceType: 'emergency', sourceId: emergency._id, recipient: responder.user },
      {
        recipient: responder.user,
        sourceType: 'emergency',
        sourceId: emergency._id,
        amount: providerEarnings,
        currency,
        method: 'openapi_africa',
        status: 'pending',
        metadata: {
          emergencyType: emergency.emergencyType,
          responder: responder._id,
          quoteReference: responseItem.quote?.quoteReference,
          paymentReference: emergency.billing?.paymentReference,
          completedBy: actorId,
          assistanceAmount: amount
        }
      }
    );

    await monetizationService.recordLedgerEntryOnce(
      { sourceType: 'payout', sourceId: payout._id, category: 'payout', status: 'posted' },
      {
        sourceType: 'payout',
        sourceId: payout._id,
        user: responder.user,
        direction: 'debit',
        category: 'payout',
        amount: payout.amount,
        currency: payout.currency,
        status: 'posted',
        metadata: {
          sourceType: 'emergency',
          emergency: emergency._id,
          responder: responder._id
        }
      }
    );
  }

  emergency.billing = {
    ...(emergency.billing || {}),
    settlementStatus: providerEarnings > 0 ? 'payout_pending' : 'settled',
    settledAt: new Date()
  };

  return emergency;
}

module.exports = {
  getEmergencyAssistanceAmounts,
  settleCompletedRoadsideAssistance
};

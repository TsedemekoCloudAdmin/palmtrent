const Payout = require('../models/Payout');

const WITHDRAWAL_STATUSES = ['pending', 'approved', 'processing'];
const MINIMUM_WITHDRAWAL = 5;

function amountTotal(payouts) {
  return payouts.reduce((total, payout) => total + Number(payout.amount || 0), 0);
}

function maskAccountNumber(accountNumber = '') {
  const value = String(accountNumber);
  if (value.length <= 4) return '****';
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function createWithdrawalReference() {
  return `WTH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function selectWholePayoutsForWithdrawal(payouts, requestedAmount) {
  const target = Number(requestedAmount);
  const selected = [];
  let selectedAmount = 0;

  for (const payout of payouts) {
    const payoutAmount = Number(payout.amount || 0);
    if (selectedAmount + payoutAmount <= target + 0.005) {
      selected.push(payout);
      selectedAmount += payoutAmount;
    }
    if (Math.abs(selectedAmount - target) < 0.01) break;
  }

  return {
    payouts: selected,
    amount: selectedAmount,
    exact: Math.abs(selectedAmount - target) < 0.01
  };
}

function withdrawablePayoutQuery(recipient) {
  return {
    recipient,
    status: 'pending',
    'metadata.withdrawalReference': { $exists: false }
  };
}

async function listWithdrawablePayouts(recipient) {
  return Payout.find(withdrawablePayoutQuery(recipient)).sort({ createdAt: 1 });
}

async function reserveWithdrawal({ recipient, amount, payoutMethod, accountNumber, accountName, bankName }) {
  const availablePayouts = await listWithdrawablePayouts(recipient);
  const availableAmount = amountTotal(availablePayouts);
  const requestedAmount = amount === undefined || amount === null || amount === ''
    ? availableAmount
    : Number(amount);

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    const error = new Error('Withdrawal amount must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  if (requestedAmount > availableAmount + 0.005) {
    const error = new Error(`Insufficient balance. Available: $${availableAmount.toFixed(2)}`);
    error.statusCode = 400;
    throw error;
  }

  if (requestedAmount < MINIMUM_WITHDRAWAL) {
    const error = new Error('Minimum withdrawal amount is $5.00');
    error.statusCode = 400;
    throw error;
  }

  const selection = selectWholePayoutsForWithdrawal(availablePayouts, requestedAmount);
  if (!selection.exact) {
    const error = new Error('Withdrawal amount must match one or more available settlement payouts');
    error.statusCode = 400;
    error.availableAmount = availableAmount;
    throw error;
  }

  const withdrawalReference = createWithdrawalReference();
  const selectedIds = selection.payouts.map(payout => payout._id);
  const destination = payoutMethod === 'bank_transfer'
    ? { accountNumber, accountName, bankName }
    : { accountNumber, phone: accountNumber, accountName };

  const result = await Payout.updateMany(
    {
      _id: { $in: selectedIds },
      ...withdrawablePayoutQuery(recipient)
    },
    {
      $set: {
        'metadata.withdrawalReference': withdrawalReference,
        'metadata.withdrawalRequestedAt': new Date()
      }
    }
  );

  const matchedCount = result.matchedCount ?? result.n ?? 0;
  if (matchedCount !== selectedIds.length) {
    await Payout.updateMany(
      { 'metadata.withdrawalReference': withdrawalReference },
      {
        $unset: {
          'metadata.withdrawalReference': '',
          'metadata.withdrawalRequestedAt': ''
        }
      }
    );
    const error = new Error('Available payout balance changed. Please retry the withdrawal request.');
    error.statusCode = 409;
    throw error;
  }

  await Payout.updateMany(
    { _id: { $in: selectedIds }, 'metadata.withdrawalReference': withdrawalReference },
    {
      $set: {
        method: payoutMethod,
        destination
      }
    }
  );

  return {
    withdrawalReference,
    amount: selection.amount,
    payoutCount: selectedIds.length,
    payoutIds: selectedIds
  };
}

module.exports = {
  MINIMUM_WITHDRAWAL,
  WITHDRAWAL_STATUSES,
  amountTotal,
  maskAccountNumber,
  selectWholePayoutsForWithdrawal,
  withdrawablePayoutQuery,
  listWithdrawablePayouts,
  reserveWithdrawal
};

import { paymentsAPI } from '../services/api';

const NAVY = '#0C2D48';
const ORANGE = '#F37021';

const prettyMethod = (method = '') => String(method)
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase());

const money = (amount, currency = 'USD') => {
  const n = Number(amount);
  return `${currency} ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
};

const row = (label, value) => value
  ? `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`
  : '';

export const buildProofOfPaymentHtml = (data = {}) => {
  const p = data.platform || {};
  const c = data.customer || {};
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Proof of Payment</title>
  <style>
    * { font-family: -apple-system, Roboto, Arial, sans-serif; }
    body { margin: 0; padding: 32px; color: #1f2937; }
    .header { border-bottom: 3px solid ${ORANGE}; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { color: ${NAVY}; font-size: 28px; font-weight: 800; }
    .subtitle { color: #6b7280; font-size: 13px; margin-top: 2px; }
    .title { color: ${NAVY}; font-size: 20px; font-weight: 700; margin: 24px 0 8px; }
    .paid-badge { display: inline-block; background: #dcfce7; color: #166534; font-weight: 700; padding: 6px 14px; border-radius: 999px; font-size: 13px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 10px 0; border-bottom: 1px solid #eef2f7; font-size: 14px; vertical-align: top; }
    td.label { color: #6b7280; width: 45%; }
    td.value { color: #111827; font-weight: 600; text-align: right; }
    .amount { color: ${NAVY}; font-size: 22px; font-weight: 800; }
    .footer { margin-top: 32px; color: #9ca3af; font-size: 12px; text-align: center; }
  </style></head><body>
  <div class="header"><div class="brand">${p.name || 'Palmtrent'}</div><div class="subtitle">${p.description || 'Logistics Marketplace'}</div></div>
  <div class="paid-badge">&#10003; Payment Received</div>
  <div class="title">Proof of Payment</div>
  <table>
    ${row('Amount Paid', `<span class="amount">${money(data.amountPaid, data.currency)}</span>`)}
    ${row('Payment Method', prettyMethod(data.paymentMethod))}
    ${row('Transaction Reference', data.transactionReference)}
    ${row('Invoice Number', data.invoiceNumber)}
    ${row('Booking Number', data.bookingNumber)}
    ${row('Date &amp; Time', data.dateTime ? new Date(data.dateTime).toLocaleString() : '')}
  </table>
  <div class="title">Customer</div>
  <table>${row('Name', c.name)}${row('Phone', c.phone)}${row('Email', c.email)}</table>
  <div class="footer">This is a system-generated receipt from ${p.name || 'Palmtrent'}.${p.supportEmail ? ` Questions? ${p.supportEmail}` : ''}</div>
  <script>window.onload = function () { window.print(); };</script>
  </body></html>`;
};

// Fetches proof-of-payment data for a booking and opens a printable receipt in a
// new window (the browser print dialog lets the user save it as a PDF).
export const downloadProofOfPayment = async (bookingId) => {
  if (!bookingId) {
    alert('This booking has no reference to generate a receipt.');
    return;
  }
  try {
    const response = await paymentsAPI.getProofOfPayment(bookingId);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Proof of payment is not available yet.');
    }
    const html = buildProofOfPaymentHtml(response.data);
    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow pop-ups to download your receipt.');
      return;
    }
    win.document.write(html);
    win.document.close();
  } catch (error) {
    alert(error.message || 'Unable to generate proof of payment right now.');
  }
};

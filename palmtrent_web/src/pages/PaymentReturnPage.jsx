import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentsAPI } from '../services/api';

const maxChecks = 36;

const PaymentReturnPage = () => {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking your ClicknPay payment status...');
  const [reference] = useState(() => sessionStorage.getItem('palmtrent_pending_payment_reference') || '');
  const [bookingReference] = useState(() => sessionStorage.getItem('palmtrent_pending_booking_reference') || '');

  useEffect(() => {
    if (!reference) {
      setStatus('missing');
      setMessage('No pending payment reference was found for this browser session.');
      return undefined;
    }

    let checks = 0;
    let timer;
    let stopped = false;

    const checkStatus = async () => {
      checks += 1;
      try {
        const response = await paymentsAPI.verify(reference);
        const paymentStatus = response.data?.status;

        if (paymentStatus === 'confirmed') {
          sessionStorage.removeItem('palmtrent_pending_payment_reference');
          sessionStorage.removeItem('palmtrent_pending_booking_reference');
          setStatus('confirmed');
          setMessage('Payment confirmed. Your booking can move to matching.');
          return;
        }

        if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
          setStatus(paymentStatus);
          setMessage(`Payment ${paymentStatus}. Return to the shipper dashboard to try again.`);
          return;
        }

        if (checks >= maxChecks) {
          setStatus('processing');
          setMessage('Payment is still processing. You can check it again from the dashboard.');
          return;
        }

        if (!stopped) timer = window.setTimeout(checkStatus, 5000);
      } catch (error) {
        setStatus('processing');
        setMessage(error.message || 'Unable to verify the payment right now.');
      }
    };

    checkStatus();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [reference]);

  return (
    <main className="payment-return-page">
      <section className="payment-return-panel">
        <h1>ClicknPay Payment</h1>
        {bookingReference && <p className="payment-return-reference">Booking {bookingReference}</p>}
        <p className={`payment-return-status status-${status}`}>{message}</p>
        <Link className="btn-primary" to="/shipper">Shipper Dashboard</Link>
      </section>
    </main>
  );
};

export default PaymentReturnPage;

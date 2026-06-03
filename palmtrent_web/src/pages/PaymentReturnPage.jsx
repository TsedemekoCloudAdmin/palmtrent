import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI, paymentsAPI } from '../services/api';

const maxChecks = 36;

const PaymentReturnPage = () => {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking your ClicknPay payment status...');
  const [reference] = useState(() => sessionStorage.getItem('palmtrent_pending_payment_reference') || '');
  const [bookingReference] = useState(() => sessionStorage.getItem('palmtrent_pending_booking_reference') || '');
  const [paymentContext] = useState(() => sessionStorage.getItem('palmtrent_pending_payment_context') || 'booking');
  const [subscriptionName] = useState(() => sessionStorage.getItem('palmtrent_pending_subscription_name') || 'Subscription');

  const dashboardPath = (() => {
    const user = authAPI.getCurrentUser();
    switch (user?.userType) {
      case 'admin':
        return '/admin';
      case 'corporate':
        return '/corp';
      case 'trailer_owner':
      case 'transporter':
        return '/fleet';
      case 'shipper':
      default:
        return '/shipper';
    }
  })();

  const clearPendingPayment = () => {
    sessionStorage.removeItem('palmtrent_pending_payment_reference');
    sessionStorage.removeItem('palmtrent_pending_booking_reference');
    sessionStorage.removeItem('palmtrent_pending_payment_context');
    sessionStorage.removeItem('palmtrent_pending_subscription_name');
  };

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
          clearPendingPayment();
          setStatus('confirmed');
          setMessage(paymentContext === 'subscription'
            ? 'Subscription payment confirmed. Your account access remains pending document verification where required.'
            : 'Payment confirmed. Your booking can move to matching.');
          return;
        }

        if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
          setStatus(paymentStatus);
          setMessage(paymentContext === 'subscription'
            ? `Payment ${paymentStatus}. Return to your dashboard to choose or pay for a subscription again.`
            : `Payment ${paymentStatus}. Return to the shipper dashboard to try again.`);
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
        {paymentContext === 'subscription' ? (
          <p className="payment-return-reference">{subscriptionName}</p>
        ) : (
          bookingReference && <p className="payment-return-reference">Booking {bookingReference}</p>
        )}
        <p className={`payment-return-status status-${status}`}>{message}</p>
        <Link className="btn-primary" to={dashboardPath}>Go to Dashboard</Link>
      </section>
    </main>
  );
};

export default PaymentReturnPage;

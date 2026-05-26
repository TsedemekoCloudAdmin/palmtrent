import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader, MapPin, Package, Truck } from 'lucide-react';
import { trackingAPI } from '../services/api';

const getAddress = (point) => point?.address || point?.city || point?.name || 'Not available';

const PublicTrackingPage = () => {
  const { trackingId } = useParams();
  const [tracking, setTracking] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadTracking = async () => {
      setStatus('loading');
      setError('');

      try {
        const response = await trackingAPI.trackPublic(trackingId);
        if (!isMounted) return;
        setTracking(response.data || response);
        setStatus('loaded');
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Tracking details are not available for this reference.');
        setStatus('error');
      }
    };

    loadTracking();

    return () => {
      isMounted = false;
    };
  }, [trackingId]);

  const events = useMemo(() => (
    tracking?.tracking ||
    tracking?.trackingHistory ||
    tracking?.events ||
    []
  ), [tracking]);

  const pickup = tracking?.pickupLocation || tracking?.route?.pickup || tracking?.origin;
  const delivery = tracking?.deliveryLocation || tracking?.route?.delivery || tracking?.destination;

  return (
    <main className="public-tracking-page">
      <section className="public-tracking-shell">
        <Link className="public-tracking-back" to="/home">
          <ArrowLeft size={18} />
          Back to Palmtrent
        </Link>

        <div className="public-tracking-header">
          <div>
            <p className="eyebrow">Shipment Tracking</p>
            <h1>{tracking?.bookingReference || trackingId}</h1>
          </div>
          {tracking?.status && (
            <span className="public-tracking-status">
              {String(tracking.status).replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {status === 'loading' && (
          <div className="public-tracking-state">
            <Loader className="spinning" size={28} />
            <span>Loading tracking details...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="public-tracking-state error">
            <AlertCircle size={28} />
            <span>{error}</span>
          </div>
        )}

        {status === 'loaded' && tracking && (
          <>
            <div className="public-tracking-route">
              <div className="route-summary-card">
                <MapPin size={22} />
                <div>
                  <span>Pickup</span>
                  <strong>{getAddress(pickup)}</strong>
                </div>
              </div>
              <div className="route-summary-card">
                <Package size={22} />
                <div>
                  <span>Delivery</span>
                  <strong>{getAddress(delivery)}</strong>
                </div>
              </div>
              {tracking.transporter && (
                <div className="route-summary-card">
                  <Truck size={22} />
                  <div>
                    <span>Transporter</span>
                    <strong>{tracking.transporter.fullName || tracking.transporter.name || 'Assigned'}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="public-tracking-events">
              <h2>Tracking Events</h2>
              {events.length > 0 ? (
                <ol>
                  {events.map((event, index) => (
                    <li key={event._id || event.id || index}>
                      <strong>{event.status || event.title || 'Update'}</strong>
                      <span>{event.location?.address || event.description || event.notes || 'Shipment update recorded'}</span>
                      {(event.timestamp || event.createdAt) && (
                        <time>{new Date(event.timestamp || event.createdAt).toLocaleString()}</time>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="public-tracking-empty">No tracking events have been published yet.</p>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
};

export default PublicTrackingPage;

// Maps a tapped push notification's data payload to an in-app screen and drives
// navigation via a container ref (works even before the tree is fully ready —
// cold-start taps are queued and flushed on NavigationContainer onReady).
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

let pendingRoute = null;

// Backend notify() sends data: { type, notificationId, ...extra } where extra
// carries ids like bookingId / shipmentId depending on the event.
const screenForNotification = (data = {}) => {
  const { type, bookingId, shipmentId } = data;
  switch (type) {
    case 'new_job':
      return ['JobDetails', { bookingId }];
    case 'booking_confirmed':
    case 'transporter_assigned':
    case 'pickup_started':
    case 'in_transit':
    case 'delivery_completed':
      return ['TrackShipment', { shipmentId, bookingId }];
    case 'payment_received':
    case 'payment_released':
      return ['MyBookings', {}];
    case 'rating_received':
      return bookingId ? ['JobDetails', { bookingId }] : ['Notifications', {}];
    default:
      return ['Notifications', {}];
  }
};

export const routeFromNotificationData = (data) => {
  if (!data) return;
  const [screen, params] = screenForNotification(data);
  if (navigationRef.isReady()) {
    navigationRef.navigate(screen, params);
  } else {
    pendingRoute = [screen, params];
  }
};

// Called from NavigationContainer onReady to deliver a cold-start tap.
export const flushPendingNotificationRoute = () => {
  if (pendingRoute && navigationRef.isReady()) {
    const [screen, params] = pendingRoute;
    pendingRoute = null;
    navigationRef.navigate(screen, params);
  }
};

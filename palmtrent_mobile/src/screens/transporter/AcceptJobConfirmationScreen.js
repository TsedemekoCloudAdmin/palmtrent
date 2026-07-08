import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';
import { cleanLabel } from '../../utils/labels';

const AcceptJobConfirmationScreen = ({ navigation, route }) => {
  const { job, jobId } = route.params || {};
  const [checklist, setChecklist] = useState({
    documents: false,
    vehicle: false,
    availability: false,
    route: false
  });
  const [loading, setLoading] = useState(!job && jobId);
  const [accepting, setAccepting] = useState(false);
  const [jobData, setJobData] = useState(job || null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [pairing, setPairing] = useState(null);
  const [linkedRental, setLinkedRental] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(false);

  useEffect(() => {
    if (!job && jobId) {
      fetchJobDetails();
    }
  }, [job, jobId]);

  const [commission, setCommission] = useState(null);
  const [remitting, setRemitting] = useState(false);

  useEffect(() => {
    if (jobData) {
      loadAcceptanceSupport();
      loadCommission();
    }
  }, [jobData?._id, jobData?.id]);

  const loadCommission = async () => {
    try {
      const id = jobData?._id || jobData?.id || jobId;
      if (!id) return;
      const response = await apiService.getBookingCommission(id);
      setCommission(response.data || null);
    } catch (error) {
      // Non-fatal: commission info just won't show.
    }
  };

  const commissionRequired = commission?.required && commission?.status !== 'paid';

  const handleRemitCommission = async () => {
    try {
      setRemitting(true);
      const id = jobData?._id || jobData?.id || jobId;
      const response = await apiService.payBookingCommission(id, 'cash_agent');
      if (!response.success) throw new Error(response.message || 'Could not start commission payment');
      navigation.navigate('MobileMoneyPayment', {
        bookingId: id,
        paymentReference: response.data?.paymentReference,
        amount: response.data?.amount,
        paymentMethod: response.data?.paymentMethod || 'cash_agent',
        paymentContext: 'commission'
      });
    } catch (error) {
      Alert.alert('Commission payment', error.message || 'Could not start the commission payment.');
    } finally {
      setRemitting(false);
    }
  };

  const fetchJobDetails = async () => {
    try {
      const response = await apiService.get(`/transporter/jobs/${jobId}`);
      if (response.success) {
        setJobData(response.data);
      } else {
        Alert.alert('Error', 'Failed to load job details');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load job details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const allChecked = Object.values(checklist).every(v => v);
  const currentJobId = jobData?._id || jobData?.id || jobId;
  const getItemId = (item) => item?._id || item?.id;
  const rentalBlocksAcceptance = linkedRental && !['confirmed', 'active'].includes(linkedRental.status);

  const isTractorCandidate = (vehicle) => {
    const text = [
      vehicle?.vehicleType?.name,
      vehicle?.vehicleType,
      vehicle?.category,
      vehicle?.description,
      vehicle?.hasTrailer === false ? 'tractor' : '',
      vehicle?.trailerOwned === false ? 'tractor' : ''
    ].filter(Boolean).join(' ').toLowerCase();
    return /tractor|horse|prime mover|truck tractor/.test(text);
  };

  const loadAcceptanceSupport = async () => {
    try {
      const [vehicleResponse, rentalResponse] = await Promise.all([
        apiService.getMyVehicles(),
        apiService.getMyRentals()
      ]);
      const vehicleList = vehicleResponse.data || vehicleResponse.vehicles || [];
      setVehicles(vehicleList);

      const linked = (rentalResponse.data || []).find(rental => {
        const bookingId = rental.linkedShipment?.booking?._id || rental.linkedShipment?.booking;
        return bookingId && String(bookingId) === String(currentJobId) && !['cancelled', 'completed'].includes(rental.status);
      });
      setLinkedRental(linked || null);

      const initialVehicle = vehicleList.find(isTractorCandidate) || vehicleList[0];
      if (initialVehicle) {
        const id = getItemId(initialVehicle);
        setSelectedVehicleId(id);
        await loadTrailerOptions(id);
      }
    } catch (error) {
      console.warn('Acceptance support load failed:', error.message);
    }
  };

  const loadTrailerOptions = async (vehicleId) => {
    if (!vehicleId || !currentJobId) return;
    try {
      setPairingLoading(true);
      const response = await apiService.getTrailerPairingOptions(currentJobId, vehicleId);
      setPairing(response.data || null);
    } catch (error) {
      setPairing(null);
    } finally {
      setPairingLoading(false);
    }
  };

  const selectVehicle = async (vehicleId) => {
    setSelectedVehicleId(vehicleId);
    await loadTrailerOptions(vehicleId);
  };

  const requestTrailer = async (trailerId) => {
    try {
      setPairingLoading(true);
      const response = await apiService.requestTrailerPairing(currentJobId, selectedVehicleId, trailerId);
      setLinkedRental(response.data);
      Alert.alert('Rental Requested', 'The trailer owner can approve this request. Once approved, pay the rental before accepting the job.');
    } catch (error) {
      Alert.alert('Trailer Rental', error.message || 'Could not request this trailer');
    } finally {
      setPairingLoading(false);
    }
  };

  const payLinkedRental = async () => {
    try {
      const response = await apiService.initiateRentalPayment(linkedRental._id);
      setLinkedRental(response.data?.rental || linkedRental);
      Alert.alert(
        'Payment Started',
        response.data?.redirectUrl
          ? `OpenAPI Africa payment link created:\n${response.data.redirectUrl}`
          : 'Payment has been initiated. Check status after completing payment.'
      );
    } catch (error) {
      Alert.alert('Payment Error', error.message || 'Could not start rental payment');
    }
  };

  const checkLinkedRentalPayment = async () => {
    try {
      const response = await apiService.checkRentalPaymentStatus(linkedRental._id);
      await loadAcceptanceSupport();
    } catch (error) {
      Alert.alert('Payment Status', error.message || 'Could not check payment status');
    }
  };

  const handleAcceptJob = async () => {
    if (!allChecked) {
      Alert.alert('Complete Checklist', 'Please confirm all checklist items before accepting the job.');
      return;
    }
    if (rentalBlocksAcceptance) {
      Alert.alert('Trailer Rental Required', 'Complete approval and payment for the linked trailer rental before accepting this job.');
      return;
    }
    if (commissionRequired) {
      Alert.alert(
        'Commission Required',
        'Remit Palmtrent\'s commission before accepting this cash job.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remit Commission', onPress: handleRemitCommission }
        ]
      );
      return;
    }

    setAccepting(true);
    try {
      const id = jobData?._id || jobData?.id || jobId;
      const response = await apiService.post(`/transporter/jobs/${id}/accept`, {
        vehicleAssignments: selectedVehicleId ? [{ vehicleId: selectedVehicleId }] : [],
        linkedRentalIds: linkedRental ? [linkedRental._id] : []
      });

      if (response.success) {
        navigation.navigate('JobAccepted', {
          job: jobData,
          shipmentId: response.data?.shipmentId,
          bookingReference: response.data?.bookingReference
        });
      } else {
        Alert.alert('Error', response.message || 'Failed to accept job');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to accept job. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  // Format job data for display
  const getDisplayData = () => {
    if (!jobData) return null;

    return {
      id: jobData.bookingReference || jobData._id,
      route: {
        from: jobData.route?.pickup?.city || jobData.originCity || jobData.origin || 'N/A',
        to: jobData.route?.delivery?.city || jobData.destinationCity || jobData.destination || 'N/A'
      },
      earnings: jobData.pricing?.totals?.transporterTotal || jobData.amount || 0,
      pickup: {
        date: formatDate(jobData.route?.pickup?.date || jobData.pickupDate),
        time: jobData.route?.pickup?.timeWindow || 'Flexible'
      },
      distance: jobData.route?.distance || jobData.distance,
      vehicleType: cleanLabel(jobData.vehicleTypeName)
        || cleanLabel(jobData.vehicleType?.name)
        || cleanLabel(jobData.vehicleType)
        || cleanLabel(jobData.vehicles?.[0]?.vehicleTypeName)
        || cleanLabel(jobData.vehicles?.[0]?.vehicleType),
      cargoDescription: jobData.cargoDetails?.description || 'General cargo'
    };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Accept Job</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading job details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayData = getDisplayData();

  if (!displayData) {
    return (
      <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Accept Job</Text>
        </View>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="error" size={48} color="#dc2626" />
          <Text style={styles.errorText}>Job data not available</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Accept Job</Text>
          <Text style={styles.headerSubtitle}>Confirm you're ready</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Job Summary */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Job Summary</Text>
              <Text style={styles.jobId}>{displayData.id}</Text>
            </View>
            <View style={styles.summaryList}>
              <DetailRow
                icon="route"
                label="Route"
                value={`${displayData.route.from} → ${displayData.route.to}`}
              />
              {displayData.distance && (
                <DetailRow
                  icon="straighten"
                  label="Distance"
                  value={`${displayData.distance} km`}
                />
              )}
              <DetailRow
                icon="schedule"
                label="Pickup"
                value={`${displayData.pickup.date}, ${displayData.pickup.time}`}
              />
              {displayData.vehicleType && (
                <DetailRow
                  icon="local-shipping"
                  label="Vehicle Type"
                  value={displayData.vehicleType}
                />
              )}
              <DetailRow
                icon="inventory"
                label="Cargo"
                value={displayData.cargoDescription}
              />
              <View style={styles.earningsRow}>
                <View style={styles.earningsLabel}>
                  <MaterialIcons name="attach-money" size={20} color="#16a34a" />
                  <Text style={styles.earningsLabelText}>Your Earnings</Text>
                </View>
                <Text style={styles.earningsValue}>${displayData.earnings}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pre-Acceptance Checklist */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vehicle And Trailer Pairing</Text>
            <Text style={styles.cardSubtitle}>
              Select the tractor or truck you will use for this load
            </Text>

            <View style={styles.vehicleList}>
              {vehicles.map(vehicle => {
                const id = getItemId(vehicle);
                const selected = id === selectedVehicleId;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.vehicleOption, selected && styles.vehicleOptionSelected]}
                    onPress={() => selectVehicle(id)}
                  >
                    <MaterialIcons name={isTractorCandidate(vehicle) ? 'rv-hookup' : 'local-shipping'} size={20} color={selected ? '#0C2D48' : '#6b7280'} />
                    <View style={styles.vehicleOptionText}>
                      <Text style={styles.vehicleTitle}>{vehicle.registrationNumber || vehicle.plateNumber || 'Vehicle'}</Text>
                      <Text style={styles.vehicleMeta}>{vehicle.vehicleType?.name || vehicle.category || 'Transport asset'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {!vehicles.length && (
                <Text style={styles.noVehicleText}>Add a verified tractor or truck in Fleet before accepting jobs.</Text>
              )}
            </View>

            {pairingLoading && <ActivityIndicator size="small" color="#0C2D48" style={styles.inlineLoader} />}

            {pairing?.trailerRequired && pairing?.tractorOnly && !linkedRental && (
              <View style={styles.trailerOptions}>
                <Text style={styles.trailerNotice}>This tractor-only setup needs a matching rental trailer.</Text>
                {(pairing.options || []).map(option => (
                  <View key={getItemId(option.trailer)} style={styles.trailerOption}>
                    <View>
                      <Text style={styles.trailerTitle}>{option.trailer.assetName || option.trailer.registrationNumber}</Text>
                      <Text style={styles.vehicleMeta}>
                        ${option.estimatedRentalCost || 0}/day • Capacity {option.compatibility?.capacity || 0}kg
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.smallPrimaryButton} onPress={() => requestTrailer(getItemId(option.trailer))}>
                      <Text style={styles.smallPrimaryText}>Request</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {!pairing.options?.length && <Text style={styles.noVehicleText}>No compatible rental trailers are available for this route yet.</Text>}
              </View>
            )}

            {linkedRental && (
              <View style={styles.linkedRentalBox}>
                <View>
                  <Text style={styles.trailerTitle}>Linked Trailer Rental</Text>
                  <Text style={styles.vehicleMeta}>{linkedRental.rentalReference} • {linkedRental.status}</Text>
                </View>
                <View style={styles.linkedRentalActions}>
                  {linkedRental.status === 'approved' && <ActionPill label="Pay" onPress={payLinkedRental} />}
                  {linkedRental.status === 'payment_pending' && <ActionPill label="Check" onPress={checkLinkedRentalPayment} />}
                  {['confirmed', 'active'].includes(linkedRental.status) && <MaterialIcons name="check-circle" size={24} color="#16a34a" />}
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pre-Acceptance Checklist</Text>
            <Text style={styles.cardSubtitle}>
              Confirm each item before accepting
            </Text>
            <View style={styles.checklist}>
              <ChecklistItem
                checked={checklist.documents}
                onChange={(val) => setChecklist({ ...checklist, documents: val })}
                label="All documents are valid and current"
                sublabel="License, VID, ZINARA, Insurance"
              />
              <ChecklistItem
                checked={checklist.vehicle}
                onChange={(val) => setChecklist({ ...checklist, vehicle: val })}
                label="Vehicle is roadworthy and fueled"
                sublabel={`Sufficient fuel for ${displayData.distance || 'the'} km journey`}
              />
              <ChecklistItem
                checked={checklist.availability}
                onChange={(val) => setChecklist({ ...checklist, availability: val })}
                label={`I'm available for pickup ${displayData.pickup.date}`}
                sublabel={`${displayData.pickup.time} window`}
              />
              <ChecklistItem
                checked={checklist.route}
                onChange={(val) => setChecklist({ ...checklist, route: val })}
                label="I understand the route and requirements"
                sublabel="Cargo handling instructions reviewed"
              />
            </View>
          </View>
        </View>

        {/* Terms */}
        <View style={styles.section}>
          <View style={styles.termsCard}>
            <MaterialIcons name="warning" size={20} color="#92400e" />
            <Text style={styles.termsText}>
              By accepting, you commit to this job. Cancellations may affect your rating and future opportunities.
            </Text>
          </View>
        </View>

        {/* Cash commission requirement */}
        {commissionRequired && (
          <View style={styles.section}>
            <View style={styles.commissionCard}>
              <MaterialIcons name="account-balance-wallet" size={22} color="#92400e" />
              <View style={{ flex: 1 }}>
                <Text style={styles.commissionTitle}>Commission required</Text>
                <Text style={styles.commissionText}>
                  This is a cash job. Remit Palmtrent's commission
                  {commission?.amount ? ` ($${Number(commission.amount).toFixed(2)})` : ''} before it can be assigned to you.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.commissionButton}
              onPress={handleRemitCommission}
              disabled={remitting}
            >
              {remitting
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={styles.commissionButtonText}>Remit Commission</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Confirm Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!allChecked || accepting || rentalBlocksAcceptance || commissionRequired) && styles.confirmButtonDisabled
            ]}
            onPress={handleAcceptJob}
            disabled={!allChecked || accepting || rentalBlocksAcceptance}
          >
            {accepting ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.confirmButtonText}>Accepting...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <MaterialIcons name="check-circle" size={20} color="white" />
                <Text style={styles.confirmButtonText}>Confirm & Accept Job</Text>
              </View>
            )}
          </TouchableOpacity>

          {!allChecked && (
            <Text style={styles.checklistHint}>
              Complete all checklist items to accept
            </Text>
          )}
          {rentalBlocksAcceptance && (
            <Text style={styles.checklistHint}>
              Complete the linked trailer rental before accepting this job
            </Text>
          )}
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Checklist Item Component
const ChecklistItem = ({ checked, onChange, label, sublabel }) => (
  <TouchableOpacity
    style={[styles.checklistItem, checked && styles.checklistItemChecked]}
    onPress={() => onChange(!checked)}
    activeOpacity={0.7}
  >
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <MaterialIcons name="check" size={16} color="white" />}
    </View>
    <View style={styles.checklistContent}>
      <Text style={styles.checklistLabel}>{label}</Text>
      <Text style={styles.checklistSublabel}>{sublabel}</Text>
    </View>
  </TouchableOpacity>
);

// Detail Row Component
const DetailRow = ({ icon, label, value }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailLeft}>
      <MaterialIcons name={icon} size={18} color="#6b7280" />
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const ActionPill = ({ label, onPress }) => (
  <TouchableOpacity style={styles.smallPrimaryButton} onPress={onPress}>
    <Text style={styles.smallPrimaryText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#dc2626',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0C2D48',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: -12,
    marginBottom: 16,
  },
  jobId: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  summaryList: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    maxWidth: '60%',
    textAlign: 'right',
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  earningsLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  earningsLabelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#16a34a',
  },
  earningsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  checklist: {
    gap: 12,
  },
  vehicleList: {
    gap: 10,
    marginTop: 14,
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
  },
  vehicleOptionSelected: {
    borderColor: '#0C2D48',
    backgroundColor: '#eef6fb',
  },
  vehicleOptionText: {
    flex: 1,
  },
  vehicleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  vehicleMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  noVehicleText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
  },
  inlineLoader: {
    marginTop: 12,
  },
  trailerOptions: {
    gap: 10,
    marginTop: 14,
  },
  trailerNotice: {
    fontSize: 13,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 10,
  },
  trailerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  trailerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  linkedRentalBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  linkedRentalActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  smallPrimaryButton: {
    backgroundColor: '#0C2D48',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  smallPrimaryText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    gap: 12,
  },
  checklistItemChecked: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  checklistContent: {
    flex: 1,
  },
  checklistLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  checklistSublabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  termsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  confirmButton: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  commissionCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  commissionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  commissionText: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  commissionButton: {
    backgroundColor: '#F37021',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commissionButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  checklistHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  bottomPadding: {
    height: 20,
  },
});

export default AcceptJobConfirmationScreen;

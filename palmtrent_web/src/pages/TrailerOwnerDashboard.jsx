import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle, Clock, DollarSign, Package, Plus, RefreshCw,
  Settings, Truck, Wrench, X, User, Users, LogOut, CreditCard, Trash2
} from 'lucide-react';
import { authAPI, driversAPI, fleetAPI, publicAPI, referenceAPI, subscriptionCheckoutAPI, vehiclesAPI } from '../services/api';
import logo from '../assets/logo3.png';
import './styles/TrailerOwnerDashboard.css';

const ASSET_TYPES = [
  { value: 'small_vehicle', label: 'Small Vehicle' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'tractor_unit', label: 'Tractor Unit' },
  { value: 'truck', label: 'Truck' },
  { value: 'full_rig', label: 'Full Rig' }
];

const emptyForm = {
  assetType: 'trailer',
  registrationNumber: '',
  assetName: '',
  year: '',
  capacityWeight: '',
  trailerType: '',
  vehicleType: '',
  make: '',
  model: '',
  dailyRate: '',
  weeklyRate: '',
  deposit: '',
  city: '',
  rentalMode: 'dry_rental',
  availableForRental: true,
  availableForShipmentWork: false,
  description: ''
};

const REFERENCE_CATEGORIES_BY_ASSET = {
  small_vehicle: ['car', 'suv', 'bakkie', 'van'],
  truck: ['truck', 'van', 'bakkie'],
  tractor_unit: ['tractor'],
  full_rig: ['tractor', 'truck']
};

const isObjectId = (value) => /^[0-9a-f]{24}$/i.test(String(value || ''));

const getRecordId = (record) => String(record?._id || record?.id || record?.value || '');

const getRecordLabel = (record) => record?.name || record?.label || record?.displayName || '';

const findById = (records, id) => records.find(item => getRecordId(item) === id);

const SMALL_VEHICLE_CATEGORIES = ['car', 'suv', 'bakkie', 'van'];

const isSmallVehicleRecord = (vehicle = {}) => SMALL_VEHICLE_CATEGORIES.includes(vehicle.vehicleType?.category);

const normalizeSmallVehicleAsset = (vehicle) => ({
  ...vehicle,
  assetType: 'small_vehicle',
  itemType: 'small_vehicle',
  assetName: vehicle.assetName || [getRecordLabel(vehicle.make), getRecordLabel(vehicle.model)]
    .filter(Boolean)
    .join(' ') || vehicle.registrationNumber,
  vehicleTypeLabel: getRecordLabel(vehicle.vehicleType),
  operatingAreas: vehicle.operatingAreas || [],
  rentalSettings: vehicle.rentalSettings || vehicle.pricing || {}
});

const assetDisplayName = (asset = {}) => (
  asset.assetName ||
  [asset.make, asset.model].map(value => typeof value === 'string' ? value : getRecordLabel(value)).filter(Boolean).join(' ') ||
  asset.registrationNumber ||
  'Fleet asset'
);

const assetRegistration = (asset = {}) => asset.registrationNumber || asset.trailer?.registrationNumber || asset.vehicle?.registrationNumber || 'Unregistered';

const assetTypeFor = (asset = {}) => asset.assetType || asset.itemType || 'vehicle';

const emptyDriverForm = {
  fullName: '',
  phone: '',
  email: '',
  licenseNumber: '',
  licenseClass: '',
  licenseExpiry: '',
  experience: '',
  employmentType: 'full_time',
  notes: ''
};

const emptyStaffForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  role: 'agent'
};

const emptyWalkInRentalForm = {
  assetId: '',
  assignedDriver: '',
  fullName: '',
  phone: '',
  email: '',
  nationalId: '',
  licenseNumber: '',
  licenseExpiry: '',
  startDate: '',
  endDate: '',
  pickupAddress: '',
  returnAddress: '',
  paymentMethod: 'cash',
  notes: ''
};

const emptyInspectionForm = {
  odometerReading: '',
  fuelLevel: 'full',
  notes: '',
  signature: '',
  photos: '',
  uploadedPhotos: [],
  damageDescription: '',
  damageFees: '',
  cleaningFees: '',
  lateFees: '',
  extraKmFees: ''
};

const formatDate = (value) => {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString();
};

const normalizeZimbabwePhone = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('263') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+263${digits.slice(1)}`;
  if (!digits.startsWith('0') && digits.length === 9) return `+263${digits}`;
  if (String(phone).trim().startsWith('+263') && digits.length === 12) return `+${digits}`;
  return String(phone || '').trim();
};

const hydrateProfileForm = (user = {}) => ({
  fullName: user.fullName || '',
  email: user.email || '',
  phone: user.phone || '',
  companyName: user.companyName || '',
  address: {
    street: user.address?.street || '',
    city: user.address?.city || '',
    state: user.address?.state || '',
    country: user.address?.country || 'Zimbabwe'
  }
});

const TrailerOwnerDashboard = () => {
  const currentUser = authAPI.getCurrentUser() || {};
  const isDriverAccount = currentUser.userType === 'driver';
  const [activeTab, setActiveTab] = useState('fleet');
  const [stats, setStats] = useState({});
  const [fleet, setFleet] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [listings, setListings] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [market, setMarket] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [driverProfile, setDriverProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [referenceData, setReferenceData] = useState({
    trailerTypes: [],
    vehicleTypes: [],
    vehicleMakes: []
  });
  const [vehicleModels, setVehicleModels] = useState([]);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [driverForm, setDriverForm] = useState(emptyDriverForm);
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [profileForm, setProfileForm] = useState(hydrateProfileForm(currentUser));
  const [requestForm, setRequestForm] = useState({
    startDate: '',
    endDate: '',
    pickupAddress: '',
    returnAddress: ''
  });
  const [assetFilter, setAssetFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [payingSubscription, setPayingSubscription] = useState(false);
  const [showAddFleetDialog, setShowAddFleetDialog] = useState(false);
  const [showDriverDialog, setShowDriverDialog] = useState(false);
  const [showStaffDialog, setShowStaffDialog] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState('');
  const [assignDriverTarget, setAssignDriverTarget] = useState(null);
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [showWalkInDialog, setShowWalkInDialog] = useState(false);
  const [walkInForm, setWalkInForm] = useState(emptyWalkInRentalForm);
  const [inspectionDialog, setInspectionDialog] = useState(null);
  const [inspectionForm, setInspectionForm] = useState(emptyInspectionForm);
  const [uploadingInspectionPhoto, setUploadingInspectionPhoto] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (isDriverAccount) {
        const [profileResponse, subscriptionResponse] = await Promise.all([
          driversAPI.getMyProfile(),
          publicAPI.getMySubscription()
        ]);
        setDriverProfile(profileResponse.data || null);
        setSubscription(subscriptionResponse.data || null);
        return;
      }
      const loadTrailerFleet = assetFilter !== 'small_vehicle';
      const loadSmallVehicles = assetFilter === 'all' || assetFilter === 'small_vehicle';
      const trailerParams = assetFilter === 'all' || assetFilter === 'small_vehicle' ? {} : { assetType: assetFilter };
      const marketParams = {
        ...(assetFilter === 'all' ? {} : { itemType: assetFilter }),
        ...(requestForm.startDate ? { startDate: requestForm.startDate } : {}),
        ...(requestForm.endDate ? { endDate: requestForm.endDate } : {}),
        ...(requestForm.pickupAddress ? { city: requestForm.pickupAddress } : {})
      };
      const [dashboard, fleetResponse, vehicleResponse, listingResponse, rentalResponse, driversResponse, subscriptionResponse, staffResponse] = await Promise.all([
        fleetAPI.getDashboard(),
        loadTrailerFleet ? fleetAPI.getFleet(trailerParams) : Promise.resolve({ data: [] }),
        loadSmallVehicles ? vehiclesAPI.getMine({ limit: 100 }) : Promise.resolve({ data: [] }),
        fleetAPI.getMyListings(),
        fleetAPI.getMyRentals(),
        driversAPI.getAll({ limit: 100 }),
        publicAPI.getMySubscription(),
        fleetAPI.getStaff()
      ]);
      const rawSmallVehicles = (vehicleResponse.data || []).filter(isSmallVehicleRecord);
      const smallVehicles = rawSmallVehicles.map(normalizeSmallVehicleAsset);
      setStats(dashboard.data || {});
      setVehicles(rawSmallVehicles);
      setFleet([...(fleetResponse.data || []), ...smallVehicles]);
      setListings(listingResponse.data || []);
      setRentals(rentalResponse.data || []);
      setDrivers(driversResponse.data || []);
      setSubscription(subscriptionResponse.data || null);
      setStaffUsers(staffResponse.data || []);
      if (activeTab === 'market') {
        const marketResponse = await fleetAPI.getAvailableRentals(marketParams);
        setMarket(marketResponse.data || []);
      }
    } catch (error) {
      setMessage(error.message || 'Could not load fleet data');
    } finally {
      setLoading(false);
    }
  }, [assetFilter, activeTab, requestForm.startDate, requestForm.endDate, requestForm.pickupAddress, isDriverAccount]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        setReferenceLoading(true);
        const response = await referenceAPI.getAll();
        const data = response.data || {};
        setReferenceData({
          trailerTypes: data.trailerTypes || [],
          vehicleTypes: data.vehicleTypes || [],
          vehicleMakes: data.vehicleMakes || []
        });
      } catch (error) {
        setMessage(error.message || 'Could not load fleet reference data');
      } finally {
        setReferenceLoading(false);
      }
    };

    loadReferenceData();
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      if (!isObjectId(form.make)) {
        setVehicleModels([]);
        return;
      }

      try {
        const response = await vehiclesAPI.getModels(form.make);
        setVehicleModels(response.data || []);
      } catch (error) {
        setVehicleModels([]);
        setMessage(error.message || 'Could not load vehicle models');
      }
    };

    loadModels();
  }, [form.make]);

  const totalRentalValue = useMemo(() => (
    listings.reduce((sum, rental) => sum + Number(rental.pricing?.total || 0), 0)
  ), [listings]);

  const updateForm = (field, value) => setForm((current) => {
    if (field === 'assetType') {
      return { ...current, assetType: value, trailerType: '', vehicleType: '' };
    }
    if (field === 'make') {
      return { ...current, make: value, model: '' };
    }
    return { ...current, [field]: value };
  });
  const updateDriverForm = (field, value) => setDriverForm((current) => ({ ...current, [field]: value }));
  const updateStaffForm = (field, value) => setStaffForm((current) => ({ ...current, [field]: value }));
  const updateProfileForm = (field, value) => setProfileForm((current) => ({ ...current, [field]: value }));
  const updateWalkInForm = (field, value) => setWalkInForm((current) => ({ ...current, [field]: value }));
  const updateInspectionForm = (field, value) => setInspectionForm((current) => ({ ...current, [field]: value }));
  const updateProfileAddress = (field, value) => setProfileForm((current) => ({
    ...current,
    address: {
      ...(current.address || {}),
      [field]: value
    }
  }));

  const rentalReadyAssets = useMemo(() => (
    fleet.filter(asset => asset.rentalSettings?.availableForRental !== false)
  ), [fleet]);

  const selectedWalkInAsset = useMemo(() => (
    rentalReadyAssets.find(asset => asset._id === walkInForm.assetId)
  ), [rentalReadyAssets, walkInForm.assetId]);

  const createAsset = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setMessage('');
      const selectedMake = findById(referenceData.vehicleMakes, form.make);
      const selectedModel = findById(vehicleModels, form.model);
      const selectedTrailerType = findById(referenceData.trailerTypes, form.trailerType);
      const selectedVehicleType = findById(referenceData.vehicleTypes, form.vehicleType);
      const vehicleDescriptor = selectedVehicleType ? `${getRecordLabel(selectedVehicleType)}. ` : '';

      if (form.assetType === 'small_vehicle') {
        if (!selectedVehicleType) throw new Error('Select a small vehicle type.');
        if (!selectedMake) throw new Error('Select a make.');
        if (!selectedModel) throw new Error('Select a model.');
        if (!form.year) throw new Error('Enter the vehicle year.');

        const vehiclePayload = {
          registrationNumber: form.registrationNumber,
          make: form.make,
          model: form.model,
          vehicleType: form.vehicleType,
          category: selectedVehicleType.category || 'car',
          subType: selectedVehicleType.subcategory || '',
          year: Number(form.year),
          ownerType: currentUser.companyName ? 'company' : 'individual',
          status: 'available',
          capacity: {
            weight: {
              value: Number(form.capacityWeight) || Number(selectedVehicleType.capacity?.weight?.max) || 0.5,
              unit: 'tonnes'
            }
          },
          specifications: {
            transmission: 'manual',
            engineType: 'petrol'
          },
          description: form.description,
          pricing: {
            availableForRental: form.availableForRental,
            dailyRate: Number(form.dailyRate) || 0,
            weeklyRate: Number(form.weeklyRate) || 0,
            deposit: Number(form.deposit) || 0,
            minimumRentalPeriod: 1
          },
          rentalSettings: {
            availableForRental: form.availableForRental,
            availableForShipmentWork: false,
            rentalMode: form.rentalMode,
            dailyRate: Number(form.dailyRate) || 0,
            weeklyRate: Number(form.weeklyRate) || 0,
            deposit: Number(form.deposit) || 0,
            pickupLocations: form.city ? [{ city: form.city, address: form.city }] : []
          },
          operatingAreas: form.city ? [{ city: form.city, country: 'Zimbabwe' }] : []
        };

        await vehiclesAPI.create(vehiclePayload);
        setForm(emptyForm);
        setMessage('Small vehicle added');
        await loadData();
        setShowAddFleetDialog(false);
        return;
      }

      const payload = {
        assetType: form.assetType,
        registrationNumber: form.registrationNumber,
        assetName: form.assetName || [getRecordLabel(selectedMake), getRecordLabel(selectedModel) || getRecordLabel(selectedTrailerType)].filter(Boolean).join(' '),
        year: Number(form.year) || undefined,
        description: `${vehicleDescriptor}${form.description || ''}`.trim(),
        trailerType: isObjectId(form.trailerType) ? form.trailerType : undefined,
        capacity: {
          weight: {
            value: Number(form.capacityWeight) || 1,
            unit: 'tonnes'
          }
        },
        tractorUnit: {
          make: getRecordLabel(selectedMake) || form.make,
          model: getRecordLabel(selectedModel) || form.model || getRecordLabel(selectedVehicleType)
        },
        rentalSettings: {
          availableForRental: form.availableForRental,
          availableForShipmentWork: form.availableForShipmentWork,
          rentalMode: form.rentalMode,
          dailyRate: Number(form.dailyRate) || 0,
          weeklyRate: Number(form.weeklyRate) || 0,
          deposit: Number(form.deposit) || 0,
          pickupLocations: form.city ? [{ city: form.city, address: form.city }] : []
        },
        operatingAreas: form.city ? [{ city: form.city, country: 'Zimbabwe' }] : []
      };

      await fleetAPI.createAsset(payload);
      setForm(emptyForm);
      setMessage('Fleet asset added');
      await loadData();
      setShowAddFleetDialog(false);
    } catch (error) {
      setMessage(error.message || 'Could not add fleet asset');
    } finally {
      setLoading(false);
    }
  };

  const openDriverDialog = (driver = null) => {
    if (driver) {
      setEditingDriverId(driver._id);
      setDriverForm({
        fullName: driver.fullName || '',
        phone: driver.phone || '',
        email: driver.email || '',
        licenseNumber: driver.licenseNumber || '',
        licenseClass: driver.licenseClass || '',
        licenseExpiry: driver.licenseExpiry ? String(driver.licenseExpiry).slice(0, 10) : '',
        experience: driver.experience || '',
        employmentType: driver.employmentType || 'full_time',
        notes: driver.notes || ''
      });
    } else {
      setEditingDriverId('');
      setDriverForm(emptyDriverForm);
    }
    setShowDriverDialog(true);
  };

  const saveStaffUser = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setMessage('');
      await fleetAPI.createStaff({
        ...staffForm,
        phone: normalizeZimbabwePhone(staffForm.phone)
      });
      setStaffForm(emptyStaffForm);
      setShowStaffDialog(false);
      setMessage('Staff user added');
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not add staff user');
    } finally {
      setLoading(false);
    }
  };

  const saveDriver = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setMessage('');
      const payload = {
        ...driverForm,
        experience: Number(driverForm.experience) || 0
      };
      if (editingDriverId) {
        await driversAPI.update(editingDriverId, payload);
        setMessage('Driver updated');
      } else {
        await driversAPI.create(payload);
        setMessage('Driver added');
      }
      setShowDriverDialog(false);
      setEditingDriverId('');
      setDriverForm(emptyDriverForm);
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not save driver');
    } finally {
      setLoading(false);
    }
  };

  const updateDriverStatus = async (driver, status) => {
    try {
      setLoading(true);
      await driversAPI.updateStatus(driver._id, status);
      setMessage(`${driver.fullName} moved to ${status.replace('_', ' ')}`);
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not update driver status');
    } finally {
      setLoading(false);
    }
  };

  const inviteDriver = async (driver) => {
    if (driver.user) {
      setMessage(`${driver.fullName} already has an app login.`);
      return;
    }
    if (!window.confirm(`Create an app login for ${driver.fullName} and send their credentials by SMS?`)) return;
    try {
      setLoading(true);
      setMessage('');
      const response = await driversAPI.invite(driver._id);
      if (response.createdAccount && response.credentials?.temporaryPassword) {
        setMessage(`Account created for ${driver.fullName}. Login: ${response.credentials.phone} · temporary password: ${response.credentials.temporaryPassword} (also sent by SMS).`);
      } else {
        setMessage(response.message || `${driver.fullName} can now sign in as a driver.`);
      }
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not invite driver');
    } finally {
      setLoading(false);
    }
  };

  const openAssignVehicleDialog = (driver) => {
    setAssignDriverTarget(driver);
    setAssignVehicleId(driver.assignedVehicle?._id || '');
  };

  const closeAssignVehicleDialog = () => {
    setAssignDriverTarget(null);
    setAssignVehicleId('');
  };

  const assignVehicleToDriver = async (event) => {
    event.preventDefault();
    if (!assignDriverTarget || !assignVehicleId) {
      setMessage('Select a vehicle to assign');
      return;
    }
    try {
      setLoading(true);
      setMessage('');
      await vehiclesAPI.assignDriver(assignVehicleId, assignDriverTarget._id);
      setMessage(`Vehicle assigned to ${assignDriverTarget.fullName}`);
      closeAssignVehicleDialog();
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not assign vehicle');
    } finally {
      setLoading(false);
    }
  };

  const unassignDriverVehicle = async (driver) => {
    const vehicleId = driver.assignedVehicle?._id;
    if (!vehicleId) return;
    if (!window.confirm(`Unassign ${driver.assignedVehicle?.registrationNumber || 'vehicle'} from ${driver.fullName}?`)) return;
    try {
      setLoading(true);
      await vehiclesAPI.assignDriver(vehicleId, null);
      setMessage(`Vehicle unassigned from ${driver.fullName}`);
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not unassign vehicle');
    } finally {
      setLoading(false);
    }
  };

  const deleteDriver = async (driver) => {
    if (!window.confirm(`Delete ${driver.fullName}?`)) return;
    try {
      setLoading(true);
      await driversAPI.delete(driver._id);
      setMessage('Driver deleted');
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not delete driver');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      const normalizedPhone = normalizeZimbabwePhone(profileForm.phone);
      const email = String(profileForm.email || '').trim().toLowerCase();
      if (!String(profileForm.fullName || '').trim()) throw new Error('Full name is required.');
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
      if (!/^\+263[0-9]{9}$/.test(normalizedPhone)) throw new Error('Enter a valid Zimbabwean mobile number in +263 format.');

      const response = await authAPI.updateProfile({
        fullName: String(profileForm.fullName || '').trim(),
        email,
        phone: normalizedPhone,
        companyName: String(profileForm.companyName || '').trim(),
        address: {
          street: String(profileForm.address?.street || '').trim(),
          city: String(profileForm.address?.city || '').trim(),
          state: String(profileForm.address?.state || '').trim(),
          country: String(profileForm.address?.country || 'Zimbabwe').trim()
        }
      });
      const user = response.data?.user || response.user || authAPI.getCurrentUser() || {};
      setProfileForm(hydrateProfileForm(user));
      setMessage('Profile updated');
    } catch (error) {
      setMessage(error.message || 'Could not update profile');
    } finally {
      setLoading(false);
    }
  };

  const paySubscription = async () => {
    if (!subscription) return;
    try {
      setPayingSubscription(true);
      setMessage('');
      const redirected = await subscriptionCheckoutAPI.start(subscription, {
        email: profileForm.email,
        phone: profileForm.phone
      });
      if (!redirected) setMessage('Subscription does not require payment or is already paid.');
    } catch (error) {
      setMessage(error.message || 'Could not start subscription payment');
    } finally {
      setPayingSubscription(false);
    }
  };

  const updateDriverAvailability = async (availability) => {
    try {
      setLoading(true);
      setMessage('');
      const response = await driversAPI.updateMyAvailability(availability);
      setDriverProfile(response.data || null);
      setMessage('Availability updated');
    } catch (error) {
      setMessage(error.message || 'Could not update availability');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (asset, status) => {
    try {
      if (assetTypeFor(asset) === 'small_vehicle') {
        await vehiclesAPI.updateStatus(asset._id, status);
      } else {
        await fleetAPI.updateStatus(asset._id, status);
      }
      setMessage(status === 'available'
        ? `${assetRegistration(asset)} is open for bookings.`
        : `${assetRegistration(asset)} moved to ${status}.`);
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not update status');
    }
  };

  const openInspectionDialog = (rental, type) => {
    setInspectionDialog({ rental, type });
    setInspectionForm({
      ...emptyInspectionForm,
      fuelLevel: type === 'return' ? (rental.pickup?.fuelLevel || 'full') : 'full',
      odometerReading: type === 'return' ? (rental.pickup?.odometerReading || '') : ''
    });
  };

  const buildInspectionPayload = (type) => {
    const manualPhotos = String(inspectionForm.photos || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    const uploadedPhotos = (inspectionForm.uploadedPhotos || []).map(item => item.url).filter(Boolean);

    const payload = {
      odometerReading: Number(inspectionForm.odometerReading) || 0,
      fuelLevel: inspectionForm.fuelLevel,
      notes: inspectionForm.notes,
      signature: inspectionForm.signature,
      photos: [...uploadedPhotos, ...manualPhotos],
      conditionChecklist: [
        {
          item: type === 'pickup' ? 'Pickup inspection' : 'Return inspection',
          status: inspectionForm.damageDescription ? 'issue' : 'ok',
          notes: inspectionForm.damageDescription || inspectionForm.notes || ''
        }
      ]
    };

    if (type === 'return') {
      payload.damages = inspectionForm.damageDescription
        ? [{ description: inspectionForm.damageDescription, cost: Number(inspectionForm.damageFees) || 0 }]
        : [];
      payload.damageFees = Number(inspectionForm.damageFees) || 0;
      payload.cleaningFees = Number(inspectionForm.cleaningFees) || 0;
      payload.lateFees = Number(inspectionForm.lateFees) || 0;
      payload.extraKmFees = Number(inspectionForm.extraKmFees) || 0;
    }

    return payload;
  };

  const uploadInspectionPhotos = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !inspectionDialog?.rental) return;

    try {
      setUploadingInspectionPhoto(true);
      setMessage('');
      const uploaded = [];
      for (const file of files) {
        const response = await fleetAPI.uploadRentalInspectionPhoto(
          file,
          inspectionDialog.rental._id,
          inspectionDialog.type
        );
        uploaded.push({
          url: response.data?.url || response.url,
          name: file.name
        });
      }
      updateInspectionForm('uploadedPhotos', [
        ...(inspectionForm.uploadedPhotos || []),
        ...uploaded.filter(item => item.url)
      ]);
    } catch (error) {
      setMessage(error.message || 'Could not upload inspection photo');
    } finally {
      setUploadingInspectionPhoto(false);
      event.target.value = '';
    }
  };

  const removeInspectionPhoto = (url) => {
    updateInspectionForm(
      'uploadedPhotos',
      (inspectionForm.uploadedPhotos || []).filter(item => item.url !== url)
    );
  };

  const submitInspection = async (event) => {
    event.preventDefault();
    if (!inspectionDialog?.rental) return;
    try {
      setLoading(true);
      setMessage('');
      const payload = buildInspectionPayload(inspectionDialog.type);
      if (inspectionDialog.type === 'pickup') {
        await fleetAPI.confirmPickup(inspectionDialog.rental._id, payload);
        setMessage('Rental pickup confirmed');
      } else {
        await fleetAPI.confirmReturn(inspectionDialog.rental._id, payload);
        setMessage('Rental return confirmed and settlement updated');
      }
      setInspectionDialog(null);
      setInspectionForm(emptyInspectionForm);
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not save inspection');
    } finally {
      setLoading(false);
    }
  };

  const submitWalkInRental = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setMessage('');
      if (!selectedWalkInAsset) throw new Error('Select an available rental asset.');
      if (!walkInForm.fullName.trim()) throw new Error('Customer full name is required.');
      if (!walkInForm.phone.trim()) throw new Error('Customer mobile number is required.');
      if (!walkInForm.startDate || !walkInForm.endDate) throw new Error('Rental start and end dates are required.');

      await fleetAPI.createWalkInRental({
        itemType: selectedWalkInAsset.itemType || selectedWalkInAsset.assetType || 'trailer',
        itemId: selectedWalkInAsset._id,
        startDate: walkInForm.startDate,
        endDate: walkInForm.endDate,
        pickupLocation: { address: walkInForm.pickupAddress || 'Owner pickup point' },
        returnLocation: { address: walkInForm.returnAddress || walkInForm.pickupAddress || 'Owner return point' },
        paymentMethod: walkInForm.paymentMethod,
        assignedDriver: walkInForm.assignedDriver || undefined,
        notes: walkInForm.notes,
        customer: {
          fullName: walkInForm.fullName,
          phone: walkInForm.phone,
          email: walkInForm.email,
          nationalId: walkInForm.nationalId,
          licenseNumber: walkInForm.licenseNumber,
          licenseExpiry: walkInForm.licenseExpiry,
          notes: walkInForm.notes
        }
      });

      setShowWalkInDialog(false);
      setWalkInForm(emptyWalkInRentalForm);
      setMessage('Walk-in rental created');
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not create walk-in rental');
    } finally {
      setLoading(false);
    }
  };

  const handleRentalAction = async (rental, action) => {
    try {
      if (['pickup', 'return'].includes(action)) {
        openInspectionDialog(rental, action);
        return;
      }
      if (action === 'approve') await fleetAPI.approveRental(rental._id);
      if (action === 'reject') await fleetAPI.rejectRental(rental._id, 'Rejected by owner');
      if (action === 'pay') {
        const response = await fleetAPI.payRental(rental._id);
        const redirectUrl = response.data?.redirectUrl;
        if (redirectUrl) window.open(redirectUrl, '_blank', 'noopener,noreferrer');
        setMessage(redirectUrl
          ? 'Payment link opened in a new tab. You can also share it with the customer.'
          : 'Payment initiated. Complete payment, then check status.');
      }
      if (action === 'check-payment') {
        await fleetAPI.checkRentalPayment(rental._id);
        setMessage('Payment status refreshed');
      }
      if (!['pay', 'check-payment'].includes(action)) setMessage('Rental updated');
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not update rental');
    }
  };

  const requestRental = async (asset) => {
    try {
      if (!requestForm.startDate || !requestForm.endDate) {
        setMessage('Select rental start and end dates first');
        return;
      }

      await fleetAPI.requestRental({
        itemType: asset.itemType || asset.assetType || 'trailer',
        itemId: asset._id,
        startDate: requestForm.startDate,
        endDate: requestForm.endDate,
        pickupLocation: { address: requestForm.pickupAddress || asset.operatingAreas?.[0]?.city || 'Owner pickup point' },
        returnLocation: { address: requestForm.returnAddress || requestForm.pickupAddress || asset.operatingAreas?.[0]?.city || 'Owner pickup point' }
      });
      setMessage('Rental request submitted');
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not submit rental request');
    }
  };

  const vehicleTypeCategories = REFERENCE_CATEGORIES_BY_ASSET[form.assetType] || [];
  const vehicleTypeOptions = referenceData.vehicleTypes.filter((type) => (
    !vehicleTypeCategories.length || vehicleTypeCategories.includes(type.category)
  ));
  const showVehicleType = ['small_vehicle', 'truck', 'tractor_unit', 'full_rig'].includes(form.assetType);
  const showTrailerType = ['trailer', 'full_rig'].includes(form.assetType);

  if (isDriverAccount) {
    const isAvailable = driverProfile?.availability?.isAvailable !== false;
    const visible = driverProfile?.marketplace?.visible === true;
    const lookingForWork = driverProfile?.marketplace?.lookingForWork !== false;
    const subscriptionActive = subscription?.status === 'active'
      && ['paid', 'not_required', 'waived'].includes(subscription?.payment?.status);

    return (
      <div className="fleet-page">
        <aside className="fleet-sidebar">
          <div className="fleet-brand">
            <img src={logo} alt="Palmtrent" className="fleet-brand-logo" />
            <span>Driver Portal</span>
          </div>
          <button className="active"><User className="icon" /> Availability</button>
          <button onClick={authAPI.logout}><LogOut className="icon" /> Sign Out</button>
        </aside>
        <main className="fleet-main">
          <header className="fleet-header">
            <div>
              <h1>Driver Work Profile</h1>
              <p>Set your availability so transporters and rental owners can find you for driving work.</p>
            </div>
          </header>
          {message && <div className="fleet-message">{message}</div>}
          <div className="fleet-account-grid">
            <section className="fleet-panel">
              <div className="panel-title">
                <h2>Availability</h2>
                <Clock className="icon" />
              </div>
              <div className="subscription-card">
                <h3>{driverProfile?.fullName || currentUser.fullName}</h3>
                <p>{driverProfile?.licenseClass ? `License ${driverProfile.licenseClass}` : 'Complete your license details from mobile profile.'}</p>
                <span className={`status ${isAvailable ? 'available' : 'inactive'}`}>{isAvailable ? 'available' : 'inactive'}</span>
                <div className="toggle-row">
                  <label>
                    <input type="checkbox" checked={visible} onChange={(event) => updateDriverAvailability({ visible: event.target.checked, lookingForWork, isAvailable })} />
                    Show me in driver search
                  </label>
                  <label>
                    <input type="checkbox" checked={lookingForWork} onChange={(event) => updateDriverAvailability({ visible, lookingForWork: event.target.checked, isAvailable })} />
                    Looking for work
                  </label>
                  <label>
                    <input type="checkbox" checked={isAvailable} onChange={(event) => updateDriverAvailability({ visible, lookingForWork, isAvailable: event.target.checked })} />
                    Available now
                  </label>
                </div>
                {(visible || lookingForWork) && !subscriptionActive && (
                  <p className="subscription-warning">
                    You will only appear in the driver marketplace once your annual subscription is paid.
                  </p>
                )}
              </div>
            </section>
            <section className="fleet-panel">
              <div className="panel-title">
                <h2>Subscription</h2>
                <CreditCard className="icon" />
              </div>
              {subscription ? (
                <div className="subscription-card">
                  <h3>{subscription.plan?.name || 'Driver Annual'}</h3>
                  <p>{subscription.currency || 'USD'} {subscription.amount || 0} / {subscription.billingCycle}</p>
                  <span className={`status ${subscription.payment?.status || subscription.status}`}>{subscription.payment?.status || subscription.status}</span>
                  {Number(subscription.amount || subscription.plan?.price || 0) > 0 && !['paid', 'not_required'].includes(subscription.payment?.status) && (
                    <button className="fleet-primary" onClick={paySubscription} disabled={payingSubscription}>
                      {payingSubscription ? 'Opening ClicknPay...' : 'Pay Subscription'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="empty-state">Choose the Driver Annual plan from the pricing section to appear in driver search.</div>
              )}
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fleet-page">
      <aside className="fleet-sidebar">
        <div className="fleet-brand">
          <img src={logo} alt="Palmtrent" className="fleet-brand-logo" />
          <span>Fleet Supplier</span>
        </div>
        <button className={activeTab === 'fleet' ? 'active' : ''} onClick={() => setActiveTab('fleet')}><Truck className="icon" /> Fleet</button>
        <button className={activeTab === 'drivers' ? 'active' : ''} onClick={() => setActiveTab('drivers')}><User className="icon" /> Drivers</button>
        <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}><Users className="icon" /> Staff</button>
        <button className={activeTab === 'market' ? 'active' : ''} onClick={() => setActiveTab('market')}><DollarSign className="icon" /> Market</button>
        <button className={activeTab === 'rentals' ? 'active' : ''} onClick={() => setActiveTab('rentals')}><Package className="icon" /> Rentals</button>
        <button className={activeTab === 'account' ? 'active' : ''} onClick={() => setActiveTab('account')}><Settings className="icon" /> Account</button>
      </aside>

      <main className="fleet-main">
        <header className="fleet-header">
          <div>
            <h1>Fleet And Vehicle Rentals</h1>
            <p>Manage small vehicle rentals, trailers, tractor units, trucks, full rigs, and handovers.</p>
          </div>
          <div className="fleet-header-actions">
            <button className="fleet-secondary" onClick={loadData} disabled={loading}>
              <RefreshCw className="icon" />
              Refresh
            </button>
            <button className="fleet-secondary danger" onClick={authAPI.logout}>
              <LogOut className="icon" />
              Sign Out
            </button>
          </div>
        </header>

        {message && <div className="fleet-message">{message}</div>}

        <section className="fleet-stats">
          <Stat title="Assets" value={stats.totalAssets || 0} icon={<Truck />} />
          <Stat title="Trailers" value={stats.trailers || 0} icon={<Package />} />
          <Stat title="Tractors" value={stats.tractorUnits || 0} icon={<Truck />} />
          <Stat title="Rented" value={stats.rented || 0} icon={<Clock />} />
          <Stat title="Rental Value" value={`$${totalRentalValue.toFixed(0)}`} icon={<DollarSign />} />
        </section>

        {activeTab === 'fleet' && (
          <>
            <section className="fleet-panel wide">
              <div className="panel-title">
                <h2>My Fleet</h2>
                <div className="panel-actions">
                  <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}>
                    <option value="all">All assets</option>
                    {ASSET_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                  <button className="fleet-primary" onClick={() => setShowAddFleetDialog(true)}>
                    <Plus className="icon" />
                    Add Fleet
                  </button>
                </div>
              </div>
              <div className="asset-list">
                {fleet.map(asset => (
                  <article className="asset-card" key={asset._id}>
                    <div>
                      <h3>{assetDisplayName(asset)}</h3>
                      <p>{labelFor(assetTypeFor(asset))} - {assetRegistration(asset)}</p>
                      <span className={`status ${asset.status}`}>{asset.status}</span>
                    </div>
                    <div className="asset-meta">
                      <span>${asset.rentalSettings?.dailyRate || 0}/day</span>
                      <span>{asset.operatingAreas?.[0]?.city || 'No city'}</span>
                    </div>
                    <div className="asset-actions">
                      <button onClick={() => updateStatus(asset, 'available')}><CheckCircle className="icon" /> Open For Bookings</button>
                      <button onClick={() => updateStatus(asset, 'maintenance')}><Wrench className="icon" /> Maintenance</button>
                    </div>
                  </article>
                ))}
                {!fleet.length && <div className="empty-state">No fleet assets yet.</div>}
              </div>
            </section>

            {showAddFleetDialog && (
              <div className="fleet-dialog-backdrop" role="presentation" onMouseDown={() => setShowAddFleetDialog(false)}>
                <section
                  className="fleet-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="add-fleet-title"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="fleet-dialog-header">
                    <div>
                      <h2 id="add-fleet-title">Add Fleet Asset</h2>
                      <p>Register a rental car, van, bakkie, trailer, tractor unit, truck, or full rig.</p>
                    </div>
                    <button
                      className="dialog-close"
                      type="button"
                      aria-label="Close add fleet dialog"
                      onClick={() => setShowAddFleetDialog(false)}
                    >
                      <X className="icon" />
                    </button>
                  </div>

                  <form className="fleet-form" onSubmit={createAsset}>
                    <label>Asset Type
                      <select value={form.assetType} onChange={(e) => updateForm('assetType', e.target.value)}>
                        {ASSET_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </label>
                    <label>Registration Number
                      <input value={form.registrationNumber} onChange={(e) => updateForm('registrationNumber', e.target.value)} required />
                    </label>
                    <label>Display Name
                      <input value={form.assetName} onChange={(e) => updateForm('assetName', e.target.value)} placeholder="Volvo FH + Flatbed" />
                    </label>
                    {showTrailerType && (
                      <label>Trailer Type
                        <select value={form.trailerType} onChange={(e) => updateForm('trailerType', e.target.value)} required={form.assetType === 'trailer'}>
                          <option value="">{referenceLoading ? 'Loading trailer types...' : 'Select trailer type'}</option>
                          {referenceData.trailerTypes.map(type => (
                            <option key={getRecordId(type)} value={getRecordId(type)}>
                              {getRecordLabel(type)}{type.category ? ` (${type.category})` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {showVehicleType && (
                      <label>{form.assetType === 'small_vehicle' ? 'Small Vehicle Type' : 'Truck / Vehicle Type'}
                        <select value={form.vehicleType} onChange={(e) => updateForm('vehicleType', e.target.value)} required={showVehicleType}>
                          <option value="">{referenceLoading ? 'Loading vehicle types...' : 'Select vehicle type'}</option>
                          {vehicleTypeOptions.map(type => (
                            <option key={getRecordId(type)} value={getRecordId(type)}>
                              {getRecordLabel(type)}{type.capacity?.weight?.max ? ` up to ${type.capacity.weight.max} ${type.capacity.weight.unit || 'tonnes'}` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="form-row">
                      <label>Make
                        <select value={form.make} onChange={(e) => updateForm('make', e.target.value)}>
                          <option value="">{referenceLoading ? 'Loading makes...' : 'Select make'}</option>
                          {referenceData.vehicleMakes.map(make => (
                            <option key={getRecordId(make)} value={getRecordId(make)}>
                              {getRecordLabel(make)}{make.country ? ` (${make.country})` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>Model
                        <select value={form.model} onChange={(e) => updateForm('model', e.target.value)} disabled={!form.make || !vehicleModels.length}>
                          <option value="">{form.make && !vehicleModels.length ? 'No models available' : 'Select model'}</option>
                          {vehicleModels.map(model => (
                            <option key={getRecordId(model)} value={getRecordId(model)}>{getRecordLabel(model)}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {!referenceLoading && (!referenceData.trailerTypes.length || !referenceData.vehicleTypes.length) && (
                      <small className="fleet-form-hint">Seed reference data from Admin Settings if trailer or truck lists are empty.</small>
                    )}
                    <div className="form-row">
                      <label>Year
                        <input type="number" value={form.year} onChange={(e) => updateForm('year', e.target.value)} />
                      </label>
                      <label>Capacity (tonnes)
                        <input type="number" value={form.capacityWeight} onChange={(e) => updateForm('capacityWeight', e.target.value)} />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>Daily Rate
                        <input type="number" value={form.dailyRate} onChange={(e) => updateForm('dailyRate', e.target.value)} />
                      </label>
                      <label>Deposit
                        <input type="number" value={form.deposit} onChange={(e) => updateForm('deposit', e.target.value)} />
                      </label>
                    </div>
                    <label>City
                      <input value={form.city} onChange={(e) => updateForm('city', e.target.value)} />
                    </label>
                    <label>Rental Mode
                      <select value={form.rentalMode} onChange={(e) => updateForm('rentalMode', e.target.value)}>
                        <option value="dry_rental">Dry rental</option>
                        <option value="operated_rental">Operated rental</option>
                        <option value="per_trip">Per trip</option>
                        <option value="per_km">Per kilometer</option>
                      </select>
                    </label>
                    <div className="toggle-row">
                      <label><input type="checkbox" checked={form.availableForRental} onChange={(e) => updateForm('availableForRental', e.target.checked)} /> Rent out</label>
                      {form.assetType !== 'small_vehicle' && (
                        <label><input type="checkbox" checked={form.availableForShipmentWork} onChange={(e) => updateForm('availableForShipmentWork', e.target.checked)} /> Shipment work</label>
                      )}
                    </div>
                    <button className="fleet-primary" disabled={loading}>Add Asset</button>
                  </form>
                </section>
              </div>
            )}
          </>
        )}

        {activeTab === 'rentals' && (
          <section className="fleet-panel">
            <div className="panel-title">
              <h2>Rental Requests And Active Rentals</h2>
              <button className="fleet-primary" type="button" onClick={() => setShowWalkInDialog(true)}>
                <Plus className="icon" />
                Walk-in Rental
              </button>
            </div>
            <div className="rental-table">
              {listings.map(rental => (
                <article className="rental-row" key={`owner-${rental._id}`}>
                  <div>
                    <h3>{rental.rentalReference}</h3>
                    <p>{labelFor(rental.itemType)} - {rental.trailer?.registrationNumber || rental.vehicle?.registrationNumber}</p>
                    <p>{rental.channel === 'walk_in' ? `Walk-in: ${rental.renterSnapshot?.fullName || rental.renter?.fullName || 'Customer'}` : `Renter: ${rental.renter?.fullName || 'Online customer'}`}</p>
                  </div>
                  <span className={`status ${rental.status}`}>{rental.status}</span>
                  <strong>${rental.pricing?.total || 0}</strong>
                  <div className="rental-actions">
                    {rental.status === 'pending' && <button onClick={() => handleRentalAction(rental, 'approve')}>Approve</button>}
                    {rental.status === 'pending' && <button onClick={() => handleRentalAction(rental, 'reject')}>Reject</button>}
                    {rental.status === 'approved' && <button onClick={() => handleRentalAction(rental, 'pay')}>Create Payment Link</button>}
                    {rental.status === 'payment_pending' && <button onClick={() => handleRentalAction(rental, 'check-payment')}>Check Payment</button>}
                    {rental.status === 'confirmed' && <button onClick={() => handleRentalAction(rental, 'pickup')}>Confirm Pickup</button>}
                    {rental.status === 'active' && <button onClick={() => handleRentalAction(rental, 'return')}>Confirm Return</button>}
                  </div>
                </article>
              ))}
              {rentals.map(rental => (
                <article className="rental-row" key={`renter-${rental._id}`}>
                  <div>
                    <h3>{rental.rentalReference}</h3>
                    <p>My rental - {labelFor(rental.itemType)} - {rental.trailer?.registrationNumber || rental.vehicle?.registrationNumber}</p>
                    <p>{formatDate(rental.startDate)} to {formatDate(rental.endDate)}</p>
                  </div>
                  <span className={`status ${rental.status}`}>{rental.status}</span>
                  <strong>${rental.pricing?.total || 0}</strong>
                  <div className="rental-actions">
                    {rental.status === 'approved' && <button onClick={() => handleRentalAction(rental, 'pay')}>Pay Rental</button>}
                    {rental.status === 'payment_pending' && <button onClick={() => handleRentalAction(rental, 'check-payment')}>Check Payment</button>}
                    {rental.status === 'confirmed' && <button onClick={() => handleRentalAction(rental, 'pickup')}>Confirm Pickup</button>}
                    {rental.status === 'active' && <button onClick={() => handleRentalAction(rental, 'return')}>Confirm Return</button>}
                  </div>
                </article>
              ))}
              {!listings.length && !rentals.length && <div className="empty-state">No rental requests yet.</div>}
            </div>
          </section>
        )}

        {activeTab === 'drivers' && (
          <>
            <section className="fleet-panel wide">
              <div className="panel-title">
                <h2>Drivers</h2>
                <button className="fleet-primary" onClick={() => openDriverDialog()}>
                  <Plus className="icon" />
                  Add Driver
                </button>
              </div>
              <div className="asset-list">
                {drivers.map(driver => (
                  <article className="asset-card driver-card" key={driver._id}>
                    <div>
                      <h3>{driver.fullName}</h3>
                      <p>{driver.phone} - License {driver.licenseNumber}</p>
                      <span className={`status ${driver.status}`}>{String(driver.status || 'available').replace('_', ' ')}</span>
                    </div>
                    <div className="asset-meta">
                      <span>Class {driver.licenseClass}</span>
                      <span>Expires {formatDate(driver.licenseExpiry)}</span>
                      <span>{driver.assignedVehicle?.registrationNumber || 'Unassigned'}</span>
                      <span>{driver.user ? 'App access linked' : 'No app login'}</span>
                    </div>
                    <div className="asset-actions">
                      <button onClick={() => openDriverDialog(driver)}>Edit</button>
                      <button onClick={() => openAssignVehicleDialog(driver)}>
                        <Truck className="icon" /> {driver.assignedVehicle ? 'Change Vehicle' : 'Assign Vehicle'}
                      </button>
                      {driver.assignedVehicle && (
                        <button onClick={() => unassignDriverVehicle(driver)}>Unassign</button>
                      )}
                      {!driver.user && (
                        <button onClick={() => inviteDriver(driver)}>Invite to App</button>
                      )}
                      <button onClick={() => updateDriverStatus(driver, 'available')}>Available</button>
                      <button onClick={() => updateDriverStatus(driver, 'on_leave')}>On Leave</button>
                      <button onClick={() => deleteDriver(driver)}><Trash2 className="icon" /> Delete</button>
                    </div>
                  </article>
                ))}
                {!drivers.length && <div className="empty-state">No drivers yet. Add your first driver to assign them to vehicles.</div>}
              </div>
            </section>

            {showDriverDialog && (
              <div className="fleet-dialog-backdrop" role="presentation" onMouseDown={() => setShowDriverDialog(false)}>
                <section
                  className="fleet-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="driver-dialog-title"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="fleet-dialog-header">
                    <div>
                      <h2 id="driver-dialog-title">{editingDriverId ? 'Edit Driver' : 'Add Driver'}</h2>
                      <p>Manage driver details, license records, and availability.</p>
                    </div>
                    <button className="dialog-close" type="button" aria-label="Close driver dialog" onClick={() => setShowDriverDialog(false)}>
                      <X className="icon" />
                    </button>
                  </div>

                  <form className="fleet-form" onSubmit={saveDriver}>
                    <label>Full Name
                      <input value={driverForm.fullName} onChange={(e) => updateDriverForm('fullName', e.target.value)} required />
                    </label>
                    <div className="form-row">
                      <label>Phone
                        <input value={driverForm.phone} onChange={(e) => updateDriverForm('phone', e.target.value)} required />
                      </label>
                      <label>Email
                        <input type="email" value={driverForm.email} onChange={(e) => updateDriverForm('email', e.target.value)} />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>License Number
                        <input value={driverForm.licenseNumber} onChange={(e) => updateDriverForm('licenseNumber', e.target.value)} required />
                      </label>
                      <label>License Class
                        <input value={driverForm.licenseClass} onChange={(e) => updateDriverForm('licenseClass', e.target.value)} required />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>License Expiry
                        <input type="date" value={driverForm.licenseExpiry} onChange={(e) => updateDriverForm('licenseExpiry', e.target.value)} required />
                      </label>
                      <label>Experience Years
                        <input type="number" min="0" value={driverForm.experience} onChange={(e) => updateDriverForm('experience', e.target.value)} />
                      </label>
                    </div>
                    <label>Employment Type
                      <select value={driverForm.employmentType} onChange={(e) => updateDriverForm('employmentType', e.target.value)}>
                        <option value="full_time">Full time</option>
                        <option value="part_time">Part time</option>
                        <option value="contract">Contract</option>
                        <option value="freelance">Freelance</option>
                      </select>
                    </label>
                    <label>Notes
                      <input value={driverForm.notes} onChange={(e) => updateDriverForm('notes', e.target.value)} />
                    </label>
                    <button className="fleet-primary" disabled={loading}>{editingDriverId ? 'Save Driver' : 'Add Driver'}</button>
                  </form>
                </section>
              </div>
            )}

            {assignDriverTarget && (
              <div className="fleet-dialog-backdrop" role="presentation" onMouseDown={closeAssignVehicleDialog}>
                <section
                  className="fleet-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="assign-vehicle-dialog-title"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="fleet-dialog-header">
                    <div>
                      <h2 id="assign-vehicle-dialog-title">Assign Vehicle</h2>
                      <p>Link a vehicle to {assignDriverTarget.fullName}.</p>
                    </div>
                    <button className="dialog-close" type="button" aria-label="Close assign vehicle dialog" onClick={closeAssignVehicleDialog}>
                      <X className="icon" />
                    </button>
                  </div>

                  <form className="fleet-form" onSubmit={assignVehicleToDriver}>
                    <label>Vehicle
                      <select value={assignVehicleId} onChange={(e) => setAssignVehicleId(e.target.value)} required>
                        <option value="">Select a vehicle</option>
                        {vehicles.map(vehicle => (
                          <option key={vehicle._id} value={vehicle._id}>
                            {vehicle.registrationNumber} - {vehicle.make} {vehicle.model}
                            {vehicle.assignedDriver && vehicle.assignedDriver !== assignDriverTarget._id ? ' (reassigning)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!vehicles.length && (
                      <p className="empty-state">No vehicles available. Add a vehicle to your fleet first.</p>
                    )}
                    <button className="fleet-primary" disabled={loading || !vehicles.length}>Assign Vehicle</button>
                  </form>
                </section>
              </div>
            )}
          </>
        )}

        {activeTab === 'market' && (
          <section className="fleet-panel">
            <div className="panel-title">
              <h2>Available Fleet To Rent</h2>
              <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}>
                <option value="all">All assets</option>
                {ASSET_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="request-controls">
              <label>Start
                <input type="date" value={requestForm.startDate} onChange={(e) => setRequestForm({ ...requestForm, startDate: e.target.value })} />
              </label>
              <label>End
                <input type="date" value={requestForm.endDate} onChange={(e) => setRequestForm({ ...requestForm, endDate: e.target.value })} />
              </label>
              <label>Pickup Address
                <input value={requestForm.pickupAddress} onChange={(e) => setRequestForm({ ...requestForm, pickupAddress: e.target.value })} />
              </label>
              <label>Return Address
                <input value={requestForm.returnAddress} onChange={(e) => setRequestForm({ ...requestForm, returnAddress: e.target.value })} />
              </label>
            </div>
            <div className="asset-list">
              {market.map(asset => (
                <article className="asset-card" key={asset._id}>
                  <div>
                    <h3>{assetDisplayName(asset)}</h3>
                    <p>{labelFor(assetTypeFor(asset))} - {asset.registrationNumber}</p>
                    <span className="status available">available</span>
                  </div>
                  <div className="asset-meta">
                    <span>{asset.quote ? `$${Number(asset.quote.total || 0).toFixed(2)} total` : `$${asset.rentalSettings?.dailyRate || 0}/day`}</span>
                    {asset.quote?.duration?.days && <span>{asset.quote.duration.days} day estimate</span>}
                    <span>{asset.operatingAreas?.[0]?.city || 'No city'}</span>
                  </div>
                  <div className="asset-actions">
                    <button onClick={() => requestRental(asset)}>Request Rental</button>
                  </div>
                </article>
              ))}
              {!market.length && <div className="empty-state">No available rental assets found.</div>}
            </div>
          </section>
        )}

        {activeTab === 'staff' && (
          <>
            <section className="fleet-panel wide">
              <div className="panel-title">
                <h2>Company Staff</h2>
                <div className="panel-title-actions">
                  <span>{staffUsers.length} users</span>
                  <button className="fleet-primary" type="button" onClick={() => setShowStaffDialog(true)}>
                    <Plus className="icon" />
                    Add Staff
                  </button>
                </div>
              </div>
              <div className="asset-list">
                {staffUsers.map(staff => (
                  <article className="asset-card" key={staff._id}>
                    <div>
                      <h3>{staff.fullName}</h3>
                      <p>{staff.email} - {staff.phone}</p>
                      <span className={`status ${staff.status || 'active'}`}>{staff.status || 'active'}</span>
                    </div>
                    <div className="asset-meta">
                      <span>{staff.rentalStaffRole || 'agent'}</span>
                      <span>{formatDate(staff.createdAt)}</span>
                    </div>
                  </article>
                ))}
                {!staffUsers.length && <div className="empty-state">No rental staff users yet.</div>}
              </div>
            </section>
            {showStaffDialog && (
              <div className="fleet-dialog-backdrop" role="presentation" onMouseDown={() => setShowStaffDialog(false)}>
                <section
                  className="fleet-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="staff-dialog-title"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="fleet-dialog-header">
                    <div>
                      <h2 id="staff-dialog-title">Add Rental Staff</h2>
                      <p>Create a staff account for assistants who manage rentals, walk-ins, fleet records, or handovers.</p>
                    </div>
                    <button className="dialog-close" type="button" aria-label="Close staff dialog" onClick={() => setShowStaffDialog(false)}>
                      <X className="icon" />
                    </button>
                  </div>
                  <form className="fleet-form" onSubmit={saveStaffUser}>
                    <label>Full Name
                      <input value={staffForm.fullName} onChange={(e) => updateStaffForm('fullName', e.target.value)} required />
                    </label>
                    <div className="form-row">
                      <label>Email
                        <input type="email" value={staffForm.email} onChange={(e) => updateStaffForm('email', e.target.value)} required />
                      </label>
                      <label>Mobile Number
                        <input value={staffForm.phone} onChange={(e) => updateStaffForm('phone', e.target.value)} placeholder="+263..." required />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>Temporary Password
                        <input type="password" value={staffForm.password} onChange={(e) => updateStaffForm('password', e.target.value)} minLength={8} required />
                      </label>
                      <label>Role
                        <select value={staffForm.role} onChange={(e) => updateStaffForm('role', e.target.value)}>
                          <option value="agent">Agent</option>
                          <option value="manager">Manager</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </label>
                    </div>
                    <div className="dialog-actions">
                      <button className="fleet-secondary" type="button" onClick={() => setShowStaffDialog(false)}>Cancel</button>
                      <button className="fleet-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Staff User'}</button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </>
        )}

        {activeTab === 'account' && (
          <div className="fleet-account-grid">
            <section className="fleet-panel">
              <div className="panel-title">
                <h2>Profile</h2>
                <User className="icon" />
              </div>
              <form className="fleet-form" onSubmit={saveProfile}>
                <label>Full Name
                  <input value={profileForm.fullName} onChange={(e) => updateProfileForm('fullName', e.target.value)} required />
                </label>
                <label>Email
                  <input type="email" value={profileForm.email} onChange={(e) => updateProfileForm('email', e.target.value)} required />
                </label>
                <label>Phone
                  <input value={profileForm.phone} onChange={(e) => updateProfileForm('phone', e.target.value)} required />
                </label>
                <small className="fleet-form-hint">Use your Zimbabwean mobile number in +263 format.</small>
                <label>Company Name
                  <input value={profileForm.companyName} onChange={(e) => updateProfileForm('companyName', e.target.value)} />
                </label>
                <label>Street Address
                  <textarea value={profileForm.address?.street || ''} onChange={(e) => updateProfileAddress('street', e.target.value)} rows={2} />
                </label>
                <div className="form-row">
                  <label>City
                    <input value={profileForm.address?.city || ''} onChange={(e) => updateProfileAddress('city', e.target.value)} />
                  </label>
                  <label>Province / State
                    <input value={profileForm.address?.state || ''} onChange={(e) => updateProfileAddress('state', e.target.value)} />
                  </label>
                </div>
                <label>Country
                  <input value={profileForm.address?.country || ''} onChange={(e) => updateProfileAddress('country', e.target.value)} />
                </label>
                <button className="fleet-primary" disabled={loading}>Save Profile</button>
              </form>
            </section>

            <section className="fleet-panel">
              <div className="panel-title">
                <h2>Subscription</h2>
                <CreditCard className="icon" />
              </div>
              {subscription ? (
                <div className="subscription-card">
                  <h3>{subscription.plan?.name || 'Current Plan'}</h3>
                  <p>{subscription.currency || 'USD'} {subscription.amount || 0} / {subscription.billingCycle}</p>
                  <span className={`status ${subscription.status}`}>{subscription.status}</span>
                  <dl>
                    <div><dt>Payment</dt><dd>{subscription.payment?.status || 'pending'}</dd></div>
                    <div><dt>Renews</dt><dd>{formatDate(subscription.nextBillingAt || subscription.currentPeriodEnd)}</dd></div>
                    <div><dt>Fleet assets</dt><dd>{subscription.usage?.fleetAssets || 0} used</dd></div>
                  </dl>
                  {Number(subscription.amount || subscription.plan?.price || 0) > 0 && !['paid', 'not_required'].includes(subscription.payment?.status) && (
                    <button className="fleet-primary" onClick={paySubscription} disabled={payingSubscription}>
                      {payingSubscription ? 'Opening ClicknPay...' : 'Pay with ClicknPay'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="empty-state">No active subscription found. Select a plan from the public pricing section.</div>
              )}
            </section>

            <section className="fleet-panel wide">
              <h2>How Fleet Supply Works</h2>
              <div className="settings-copy">
                <p>Trailer owners and truck owners can list trailer-only assets, tractor units, trucks, or full rigs. Dry rental means the renter operates the asset. Operated rental means the owner supplies the asset with a driver or operating service.</p>
                <p>Rental requests appear in the Rentals tab. Drivers are managed from the Drivers tab and can be assigned to vehicles from the mobile fleet screens.</p>
              </div>
              <button className="fleet-secondary danger" onClick={authAPI.logout}>
                <LogOut className="icon" />
                Sign Out
              </button>
            </section>
          </div>
        )}

        {showWalkInDialog && (
          <div className="fleet-dialog-backdrop" role="presentation" onMouseDown={() => setShowWalkInDialog(false)}>
            <section className="fleet-dialog" role="dialog" aria-modal="true" aria-labelledby="walk-in-rental-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="fleet-dialog-header">
                <div>
                  <h2 id="walk-in-rental-title">Create Walk-in Rental</h2>
                  <p>Use this for customers assisted at your rental desk or by company staff.</p>
                </div>
                <button className="dialog-close" type="button" aria-label="Close" onClick={() => setShowWalkInDialog(false)}>
                  <X className="icon" />
                </button>
              </div>
              <form className="fleet-form" onSubmit={submitWalkInRental}>
                <label>Rental Asset
                  <select value={walkInForm.assetId} onChange={(event) => updateWalkInForm('assetId', event.target.value)} required>
                    <option value="">Select asset</option>
                    {rentalReadyAssets.map(asset => (
                      <option key={asset._id} value={asset._id}>
                        {assetDisplayName(asset)} - {assetRegistration(asset)} ({labelFor(assetTypeFor(asset))})
                      </option>
                    ))}
                  </select>
                </label>
                {!rentalReadyAssets.length && <small className="fleet-form-hint">Mark a fleet asset as available for rental before creating a walk-in rental.</small>}
                <label>Assigned Driver / Chauffeur
                  <select value={walkInForm.assignedDriver} onChange={(event) => updateWalkInForm('assignedDriver', event.target.value)}>
                    <option value="">No driver assigned</option>
                    {drivers.map(driver => (
                      <option key={driver._id} value={driver._id}>
                        {driver.fullName} {driver.phone ? `- ${driver.phone}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <small className="fleet-form-hint">Use this for operated rentals, chauffeur-driven small vehicle rentals, or rentals where your company supplies the driver.</small>
                <div className="form-row">
                  <label>Customer Full Name
                    <input value={walkInForm.fullName} onChange={(event) => updateWalkInForm('fullName', event.target.value)} required />
                  </label>
                  <label>Mobile Number
                    <input value={walkInForm.phone} onChange={(event) => updateWalkInForm('phone', event.target.value)} required />
                  </label>
                </div>
                <div className="form-row">
                  <label>Email
                    <input type="email" value={walkInForm.email} onChange={(event) => updateWalkInForm('email', event.target.value)} />
                  </label>
                  <label>National ID
                    <input value={walkInForm.nationalId} onChange={(event) => updateWalkInForm('nationalId', event.target.value)} />
                  </label>
                </div>
                <div className="form-row">
                  <label>License Number
                    <input value={walkInForm.licenseNumber} onChange={(event) => updateWalkInForm('licenseNumber', event.target.value)} />
                  </label>
                  <label>License Expiry
                    <input type="date" value={walkInForm.licenseExpiry} onChange={(event) => updateWalkInForm('licenseExpiry', event.target.value)} />
                  </label>
                </div>
                <div className="form-row">
                  <label>Start Date
                    <input type="date" value={walkInForm.startDate} onChange={(event) => updateWalkInForm('startDate', event.target.value)} required />
                  </label>
                  <label>End Date
                    <input type="date" value={walkInForm.endDate} onChange={(event) => updateWalkInForm('endDate', event.target.value)} required />
                  </label>
                </div>
                <div className="form-row">
                  <label>Pickup Address
                    <input value={walkInForm.pickupAddress} onChange={(event) => updateWalkInForm('pickupAddress', event.target.value)} />
                  </label>
                  <label>Return Address
                    <input value={walkInForm.returnAddress} onChange={(event) => updateWalkInForm('returnAddress', event.target.value)} />
                  </label>
                </div>
                <label>Payment Method
                  <select value={walkInForm.paymentMethod} onChange={(event) => updateWalkInForm('paymentMethod', event.target.value)}>
                    <option value="cash">Cash collected at rental desk</option>
                    <option value="clicknpay">Customer will pay online</option>
                  </select>
                </label>
                <label>Notes
                  <textarea value={walkInForm.notes} onChange={(event) => updateWalkInForm('notes', event.target.value)} rows={3} />
                </label>
                <div className="dialog-actions">
                  <button className="fleet-secondary" type="button" onClick={() => setShowWalkInDialog(false)}>Cancel</button>
                  <button className="fleet-primary" disabled={loading || !rentalReadyAssets.length}>Create Rental</button>
                </div>
              </form>
            </section>
          </div>
        )}

        {inspectionDialog && (
          <div className="fleet-dialog-backdrop" role="presentation" onMouseDown={() => setInspectionDialog(null)}>
            <section className="fleet-dialog" role="dialog" aria-modal="true" aria-labelledby="rental-inspection-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="fleet-dialog-header">
                <div>
                  <h2 id="rental-inspection-title">{inspectionDialog.type === 'pickup' ? 'Confirm Pickup' : 'Confirm Return'}</h2>
                  <p>{inspectionDialog.rental?.rentalReference} - capture condition, odometer and customer acknowledgement.</p>
                </div>
                <button className="dialog-close" type="button" aria-label="Close" onClick={() => setInspectionDialog(null)}>
                  <X className="icon" />
                </button>
              </div>
              <form className="fleet-form" onSubmit={submitInspection}>
                <div className="form-row">
                  <label>Odometer Reading
                    <input type="number" min="0" value={inspectionForm.odometerReading} onChange={(event) => updateInspectionForm('odometerReading', event.target.value)} required />
                  </label>
                  <label>Fuel Level
                    <select value={inspectionForm.fuelLevel} onChange={(event) => updateInspectionForm('fuelLevel', event.target.value)}>
                      <option value="full">Full</option>
                      <option value="three_quarters">Three quarter</option>
                      <option value="half">Half</option>
                      <option value="quarter">Quarter</option>
                      <option value="empty">Empty</option>
                    </select>
                  </label>
                </div>
                <label>Customer / Staff Signature Name
                  <input value={inspectionForm.signature} onChange={(event) => updateInspectionForm('signature', event.target.value)} />
                </label>
                <label>Photo URLs
                  <textarea value={inspectionForm.photos} onChange={(event) => updateInspectionForm('photos', event.target.value)} rows={2} placeholder="Comma separated photo URLs" />
                </label>
                <div className="fleet-upload-control">
                  <label className="fleet-upload-button">
                    Upload Inspection Photos
                    <input type="file" accept="image/*" multiple onChange={uploadInspectionPhotos} disabled={uploadingInspectionPhoto || loading} />
                  </label>
                  {uploadingInspectionPhoto && <small>Uploading photos...</small>}
                  {!!inspectionForm.uploadedPhotos?.length && (
                    <div className="inspection-photo-list">
                      {inspectionForm.uploadedPhotos.map(photo => (
                        <span className="inspection-photo-pill" key={photo.url}>
                          {photo.name || 'Photo'}
                          <button type="button" aria-label="Remove photo" onClick={() => removeInspectionPhoto(photo.url)}>
                            <X className="icon" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <label>Inspection Notes
                  <textarea value={inspectionForm.notes} onChange={(event) => updateInspectionForm('notes', event.target.value)} rows={3} />
                </label>
                {inspectionDialog.type === 'return' && (
                  <>
                    <label>Damage / Return Notes
                      <textarea value={inspectionForm.damageDescription} onChange={(event) => updateInspectionForm('damageDescription', event.target.value)} rows={3} />
                    </label>
                    <div className="form-row">
                      <label>Damage Fees
                        <input type="number" min="0" value={inspectionForm.damageFees} onChange={(event) => updateInspectionForm('damageFees', event.target.value)} />
                      </label>
                      <label>Cleaning Fees
                        <input type="number" min="0" value={inspectionForm.cleaningFees} onChange={(event) => updateInspectionForm('cleaningFees', event.target.value)} />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>Late Fees
                        <input type="number" min="0" value={inspectionForm.lateFees} onChange={(event) => updateInspectionForm('lateFees', event.target.value)} />
                      </label>
                      <label>Extra KM Fees
                        <input type="number" min="0" value={inspectionForm.extraKmFees} onChange={(event) => updateInspectionForm('extraKmFees', event.target.value)} />
                      </label>
                    </div>
                  </>
                )}
                <div className="dialog-actions">
                  <button className="fleet-secondary" type="button" onClick={() => setInspectionDialog(null)}>Cancel</button>
                  <button className="fleet-primary" disabled={loading}>{inspectionDialog.type === 'pickup' ? 'Confirm Pickup' : 'Confirm Return'}</button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

const Stat = ({ title, value, icon }) => (
  <div className="fleet-stat">
    <div className="stat-icon">{icon}</div>
    <span>{title}</span>
    <strong>{value}</strong>
  </div>
);

const labelFor = (type) => ASSET_TYPES.find(item => item.value === type)?.label || 'Vehicle';

export default TrailerOwnerDashboard;

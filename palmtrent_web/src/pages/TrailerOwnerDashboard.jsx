import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle, Clock, DollarSign, Package, Plus, RefreshCw,
  Settings, Truck, Wrench, X, User, LogOut, CreditCard, Trash2
} from 'lucide-react';
import { authAPI, driversAPI, fleetAPI, publicAPI, subscriptionCheckoutAPI } from '../services/api';
import logo from '../assets/logo3.png';
import './styles/TrailerOwnerDashboard.css';

const ASSET_TYPES = [
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
  const [activeTab, setActiveTab] = useState('fleet');
  const [stats, setStats] = useState({});
  const [fleet, setFleet] = useState([]);
  const [listings, setListings] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [market, setMarket] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [driverForm, setDriverForm] = useState(emptyDriverForm);
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
  const [editingDriverId, setEditingDriverId] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashboard, fleetResponse, listingResponse, rentalResponse, driversResponse, subscriptionResponse] = await Promise.all([
        fleetAPI.getDashboard(),
        fleetAPI.getFleet(assetFilter === 'all' ? {} : { assetType: assetFilter }),
        fleetAPI.getMyListings(),
        fleetAPI.getMyRentals(),
        driversAPI.getAll({ limit: 100 }),
        publicAPI.getMySubscription()
      ]);
      setStats(dashboard.data || {});
      setFleet(fleetResponse.data || []);
      setListings(listingResponse.data || []);
      setRentals(rentalResponse.data || []);
      setDrivers(driversResponse.data || []);
      setSubscription(subscriptionResponse.data || null);
      if (activeTab === 'market') {
        const marketResponse = await fleetAPI.getAvailableRentals(assetFilter === 'all' ? {} : { itemType: assetFilter });
        setMarket(marketResponse.data || []);
      }
    } catch (error) {
      setMessage(error.message || 'Could not load fleet data');
    } finally {
      setLoading(false);
    }
  }, [assetFilter, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalRentalValue = useMemo(() => (
    listings.reduce((sum, rental) => sum + Number(rental.pricing?.total || 0), 0)
  ), [listings]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateDriverForm = (field, value) => setDriverForm((current) => ({ ...current, [field]: value }));
  const updateProfileForm = (field, value) => setProfileForm((current) => ({ ...current, [field]: value }));
  const updateProfileAddress = (field, value) => setProfileForm((current) => ({
    ...current,
    address: {
      ...(current.address || {}),
      [field]: value
    }
  }));

  const createAsset = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setMessage('');
      const payload = {
        assetType: form.assetType,
        registrationNumber: form.registrationNumber,
        assetName: form.assetName,
        year: Number(form.year) || undefined,
        description: form.description,
        trailerType: form.trailerType || undefined,
        capacity: {
          weight: {
            value: Number(form.capacityWeight) || 1,
            unit: 'kg'
          }
        },
        tractorUnit: {
          make: form.make,
          model: form.model
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

  const updateStatus = async (asset, status) => {
    try {
      await fleetAPI.updateStatus(asset._id, status);
      setMessage(`${asset.registrationNumber} moved to ${status}`);
      await loadData();
    } catch (error) {
      setMessage(error.message || 'Could not update status');
    }
  };

  const handleRentalAction = async (rental, action) => {
    try {
      if (action === 'approve') await fleetAPI.approveRental(rental._id);
      if (action === 'reject') await fleetAPI.rejectRental(rental._id, 'Rejected by owner');
      if (action === 'pay') {
        const response = await fleetAPI.payRental(rental._id);
        setMessage(response.data?.redirectUrl
          ? `Payment link created: ${response.data.redirectUrl}`
          : 'Payment initiated. Complete payment, then check status.');
      }
      if (action === 'check-payment') {
        await fleetAPI.checkRentalPayment(rental._id);
        setMessage('Payment status refreshed');
      }
      if (action === 'pickup') await fleetAPI.confirmPickup(rental._id, { notes: 'Pickup confirmed from portal' });
      if (action === 'return') await fleetAPI.confirmReturn(rental._id, { notes: 'Return confirmed from portal' });
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

  return (
    <div className="fleet-page">
      <aside className="fleet-sidebar">
        <div className="fleet-brand">
          <img src={logo} alt="Palmtrent" className="fleet-brand-logo" />
          <span>Fleet Supplier</span>
        </div>
        <button className={activeTab === 'fleet' ? 'active' : ''} onClick={() => setActiveTab('fleet')}><Truck className="icon" /> Fleet</button>
        <button className={activeTab === 'drivers' ? 'active' : ''} onClick={() => setActiveTab('drivers')}><User className="icon" /> Drivers</button>
        <button className={activeTab === 'market' ? 'active' : ''} onClick={() => setActiveTab('market')}><DollarSign className="icon" /> Market</button>
        <button className={activeTab === 'rentals' ? 'active' : ''} onClick={() => setActiveTab('rentals')}><Package className="icon" /> Rentals</button>
        <button className={activeTab === 'account' ? 'active' : ''} onClick={() => setActiveTab('account')}><Settings className="icon" /> Account</button>
      </aside>

      <main className="fleet-main">
        <header className="fleet-header">
          <div>
            <h1>Trailer And Truck Fleet</h1>
            <p>Manage trailers, tractor units, trucks, full rigs, and rental handovers.</p>
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
                      <h3>{asset.assetName || asset.registrationNumber}</h3>
                      <p>{labelFor(asset.assetType)} • {asset.registrationNumber}</p>
                      <span className={`status ${asset.status}`}>{asset.status}</span>
                    </div>
                    <div className="asset-meta">
                      <span>${asset.rentalSettings?.dailyRate || 0}/day</span>
                      <span>{asset.operatingAreas?.[0]?.city || 'No city'}</span>
                    </div>
                    <div className="asset-actions">
                      <button onClick={() => updateStatus(asset, 'available')}><CheckCircle className="icon" /> Available</button>
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
                      <p>Register a trailer, tractor unit, truck, or full rig.</p>
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
                    <div className="form-row">
                      <label>Make
                        <input value={form.make} onChange={(e) => updateForm('make', e.target.value)} />
                      </label>
                      <label>Model
                        <input value={form.model} onChange={(e) => updateForm('model', e.target.value)} />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>Year
                        <input type="number" value={form.year} onChange={(e) => updateForm('year', e.target.value)} />
                      </label>
                      <label>Capacity KG
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
                      <label><input type="checkbox" checked={form.availableForShipmentWork} onChange={(e) => updateForm('availableForShipmentWork', e.target.checked)} /> Shipment work</label>
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
            </div>
            <div className="rental-table">
              {listings.map(rental => (
                <article className="rental-row" key={`owner-${rental._id}`}>
                  <div>
                    <h3>{rental.rentalReference}</h3>
                    <p>{labelFor(rental.itemType)} • {rental.trailer?.registrationNumber || rental.vehicle?.registrationNumber}</p>
                  </div>
                  <span className={`status ${rental.status}`}>{rental.status}</span>
                  <strong>${rental.pricing?.total || 0}</strong>
                  <div className="rental-actions">
                    {rental.status === 'pending' && <button onClick={() => handleRentalAction(rental, 'approve')}>Approve</button>}
                    {rental.status === 'pending' && <button onClick={() => handleRentalAction(rental, 'reject')}>Reject</button>}
                    {['approved', 'payment_pending'].includes(rental.status) && <span className="rental-note">Awaiting renter payment</span>}
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
                    </div>
                    <div className="asset-actions">
                      <button onClick={() => openDriverDialog(driver)}>Edit</button>
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
                    <h3>{asset.assetName || asset.registrationNumber}</h3>
                    <p>{labelFor(asset.assetType || asset.itemType)} • {asset.registrationNumber}</p>
                    <span className="status available">available</span>
                  </div>
                  <div className="asset-meta">
                    <span>${asset.rentalSettings?.dailyRate || 0}/day</span>
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
                      {payingSubscription ? 'Opening Payment...' : 'Pay Subscription'}
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

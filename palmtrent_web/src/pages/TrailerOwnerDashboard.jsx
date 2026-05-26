import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle, Clock, DollarSign, Package, Plus, RefreshCw,
  Settings, Truck, Wrench, XCircle
} from 'lucide-react';
import { fleetAPI } from '../services/api';
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

const TrailerOwnerDashboard = () => {
  const [activeTab, setActiveTab] = useState('fleet');
  const [stats, setStats] = useState({});
  const [fleet, setFleet] = useState([]);
  const [listings, setListings] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [market, setMarket] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [requestForm, setRequestForm] = useState({
    startDate: '',
    endDate: '',
    pickupAddress: '',
    returnAddress: ''
  });
  const [assetFilter, setAssetFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashboard, fleetResponse, listingResponse, rentalResponse] = await Promise.all([
        fleetAPI.getDashboard(),
        fleetAPI.getFleet(assetFilter === 'all' ? {} : { assetType: assetFilter }),
        fleetAPI.getMyListings(),
        fleetAPI.getMyRentals()
      ]);
      setStats(dashboard.data || {});
      setFleet(fleetResponse.data || []);
      setListings(listingResponse.data || []);
      setRentals(rentalResponse.data || []);
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
    } catch (error) {
      setMessage(error.message || 'Could not add fleet asset');
    } finally {
      setLoading(false);
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
          <Truck className="icon" />
          <span>Fleet Supplier</span>
        </div>
        <button className={activeTab === 'fleet' ? 'active' : ''} onClick={() => setActiveTab('fleet')}><Truck className="icon" /> Fleet</button>
        <button className={activeTab === 'market' ? 'active' : ''} onClick={() => setActiveTab('market')}><DollarSign className="icon" /> Market</button>
        <button className={activeTab === 'rentals' ? 'active' : ''} onClick={() => setActiveTab('rentals')}><Package className="icon" /> Rentals</button>
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}><Settings className="icon" /> Settings</button>
      </aside>

      <main className="fleet-main">
        <header className="fleet-header">
          <div>
            <h1>Trailer And Truck Fleet</h1>
            <p>Manage trailers, tractor units, trucks, full rigs, and rental handovers.</p>
          </div>
          <button className="fleet-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw className="icon" />
            Refresh
          </button>
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
          <div className="fleet-grid-layout">
            <section className="fleet-panel">
              <div className="panel-title">
                <h2>Add Fleet Asset</h2>
                <Plus className="icon" />
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

            <section className="fleet-panel wide">
              <div className="panel-title">
                <h2>My Fleet</h2>
                <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}>
                  <option value="all">All assets</option>
                  {ASSET_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
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
          </div>
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

        {activeTab === 'settings' && (
          <section className="fleet-panel">
            <h2>How Fleet Supply Works</h2>
            <div className="settings-copy">
              <p>Trailer owners can list trailer-only assets, tractor units, trucks, or full rigs. Dry rental means the renter operates the asset. Operated rental means the owner supplies the asset with a driver or operating service.</p>
              <p>Rental requests appear in the Rentals tab. Approving a request reserves the asset, pickup starts the rental, and return makes it available again.</p>
            </div>
          </section>
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

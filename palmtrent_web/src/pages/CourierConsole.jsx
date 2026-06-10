import { useState, useEffect, useCallback } from 'react';
import { courierAPI, authAPI } from '../services/api';

const STATUS_LABELS = {
  created: 'Created', loaded: 'Loaded', in_transit: 'In transit', arrived: 'Arrived',
  awaiting_collection: 'Awaiting collection', awaiting_delivery: 'Arranging delivery',
  out_for_delivery: 'Out for delivery', collected: 'Collected', delivered: 'Delivered', cancelled: 'Cancelled'
};

const FILTERS = [
  { key: 'myday', label: 'My day' }, { key: '', label: 'All' }, { key: 'created', label: 'New' },
  { key: 'in_transit', label: 'In transit' }, { key: 'awaiting_collection', label: 'To collect' },
  { key: 'awaiting_delivery', label: 'To deliver' }
];

const s = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { background: '#0C2D48', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 800, margin: 0 },
  tabs: { display: 'flex', gap: 8, padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0' },
  tab: (active) => ({ padding: '8px 16px', borderRadius: 999, border: '1px solid #cbd5e1', background: active ? '#0C2D48' : '#fff', color: active ? '#fff' : '#334155', cursor: 'pointer', fontWeight: 700 }),
  body: { display: 'flex', gap: 16, padding: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
  panel: { background: '#fff', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0', flex: 1, minWidth: 340 },
  chip: (active) => ({ padding: '6px 12px', borderRadius: 999, border: '1px solid #cbd5e1', background: active ? '#0C2D48' : '#fff', color: active ? '#fff' : '#334155', cursor: 'pointer', fontSize: 13, fontWeight: 700 }),
  input: { width: '100%', minHeight: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 10px', marginBottom: 8, boxSizing: 'border-box' },
  btn: { background: '#F37021', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 800, cursor: 'pointer' },
  btn2: { background: '#0C2D48', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 800, cursor: 'pointer', width: '100%', marginBottom: 8 },
  card: { border: '1px solid #eef2f7', borderRadius: 12, padding: 12, marginBottom: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  badge: { background: '#dbeafe', color: '#1e40af', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' },
  label: { fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4, marginTop: 6 },
  summary: { display: 'flex', gap: 12, marginBottom: 12 },
  sumItem: { flex: 1, background: '#0C2D48', color: '#fff', borderRadius: 12, padding: 12, textAlign: 'center' }
};

export default function CourierConsole() {
  const user = authAPI.getCurrentUser() || {};
  const isAdmin = user.userType === 'admin';
  const [tab, setTab] = useState('desk');
  const [shipments, setShipments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('myday');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [label, setLabel] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState('');

  const loadList = useCallback(async () => {
    const params = {};
    if (filter === 'myday') { params.mine = 'true'; params.today = 'true'; }
    else if (filter) params.status = filter;
    if (search.trim()) params.search = search.trim();
    const r = await courierAPI.listShipments(params);
    setShipments(r.data || []);
    setSummary(filter === 'myday' ? r.summary : null);
  }, [filter, search]);

  useEffect(() => { loadList(); }, [loadList]);

  const openDetail = async (id) => {
    const r = await courierAPI.getShipment(id);
    setSelected(r.data);
    setLabel(r.label);
    setShowCreate(false);
  };

  const runAction = async (fn, confirm) => {
    if (confirm && !window.confirm(confirm)) return;
    try {
      await fn();
      await openDetail(selected._id);
      await loadList();
      setMsg('Updated.');
    } catch (e) {
      setMsg(e.message || 'Action failed');
    }
  };

  const logout = () => { authAPI.logout(); window.location.href = '/'; };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>PalmTrent Courier Desk</h1>
        <div>
          <span style={{ marginRight: 16 }}>{user.fullName || user.email}</span>
          <button onClick={logout} style={{ ...s.btn, background: '#F37021' }}>Log out</button>
        </div>
      </div>

      <div style={s.tabs}>
        <button style={s.tab(tab === 'desk')} onClick={() => setTab('desk')}>Shipments</button>
        {isAdmin && <button style={s.tab(tab === 'depots')} onClick={() => setTab('depots')}>Depots</button>}
      </div>

      {msg && <div style={{ padding: '8px 24px', color: '#0C2D48' }}>{msg}</div>}

      {tab === 'depots' ? (
        <DepotsTab />
      ) : (
        <div style={s.body}>
          {/* List */}
          <div style={{ ...s.panel, maxWidth: 460 }}>
            {summary && (
              <div style={s.summary}>
                <div style={s.sumItem}><div style={{ fontSize: 20, fontWeight: 800 }}>{summary.count}</div><div style={{ fontSize: 11 }}>Today</div></div>
                <div style={s.sumItem}><div style={{ fontSize: 20, fontWeight: 800 }}>${Number(summary.totalCollected || 0).toFixed(2)}</div><div style={{ fontSize: 11 }}>Collected</div></div>
                <div style={s.sumItem}><div style={{ fontSize: 20, fontWeight: 800 }}>${Number(summary.outstanding || 0).toFixed(2)}</div><div style={{ fontSize: 11 }}>Outstanding</div></div>
              </div>
            )}
            <button style={s.btn} onClick={() => { setShowCreate(true); setSelected(null); }}>+ New Shipment</button>
            <input style={{ ...s.input, marginTop: 10 }} placeholder="Search reference or phone" value={search}
              onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadList()} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {FILTERS.map((f) => <button key={f.key} style={s.chip(filter === f.key)} onClick={() => setFilter(f.key)}>{f.label}</button>)}
            </div>
            {shipments.length === 0 && <div style={{ color: '#64748b', padding: 12 }}>No shipments.</div>}
            {shipments.map((sh) => (
              <div key={sh._id} style={s.card} onClick={() => openDetail(sh._id)}>
                <div>
                  <div style={{ fontWeight: 800, color: '#0C2D48' }}>{sh.reference}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{sh.originName || '—'} → {sh.destinationName || '—'}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{sh.recipient?.name} · {sh.recipient?.phone}</div>
                </div>
                <span style={s.badge}>{STATUS_LABELS[sh.status] || sh.status}</span>
              </div>
            ))}
          </div>

          {/* Detail / Create */}
          {showCreate ? (
            <CreateForm onDone={async (id) => { setShowCreate(false); await loadList(); if (id) openDetail(id); }} />
          ) : selected ? (
            <Detail shipment={selected} label={label} isAdmin={isAdmin} runAction={runAction} />
          ) : (
            <div style={{ ...s.panel }}><div style={{ color: '#64748b' }}>Select a shipment or create a new one.</div></div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ shipment, label, runAction }) {
  const [collect, setCollect] = useState({ name: '', idNumber: '' });
  const [showCollect, setShowCollect] = useState(false);
  const [copies, setCopies] = useState(shipment.packageCount || 1);
  const st = shipment.status;
  return (
    <div style={{ ...s.panel }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: '#0C2D48' }}>{shipment.reference}</h2>
        <span style={s.badge}>{STATUS_LABELS[st] || st}</span>
      </div>

      {label && (
        <div style={{ textAlign: 'center', margin: '12px 0', padding: 12, border: '1px dashed #cbd5e1', borderRadius: 12 }}>
          {label.qrImageUrl && <img src={label.qrImageUrl} alt="QR" style={{ width: 160, height: 160 }} />}
          <div style={{ fontWeight: 800, letterSpacing: 1, color: '#0C2D48' }}>{label.code}</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{label.origin} → {label.destination}</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{label.packageCount} item(s) · {label.totalWeight || 0} kg · {shipment.deliveryPreference === 'delivery' ? 'Deliver to address' : 'Collect at depot'}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 700 }}>Copies (one per item)</span>
            <input type="number" min="1" max="50" value={copies} onChange={(e) => setCopies(e.target.value)} style={{ width: 64, ...s.input, marginBottom: 0, textAlign: 'center' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <button style={s.btn} onClick={() => printLabel(label, copies)}>Print {copies} label(s)</button>
            <button style={{ ...s.btn, background: '#0C2D48' }} onClick={() => downloadZpl(shipment, copies)}>Download ZPL</button>
            <button style={{ ...s.btn, background: '#334155' }} onClick={() => sendZpl(shipment, copies)}>Send to Zebra</button>
          </div>
        </div>
      )}

      <Row k="Sender" v={`${shipment.sender?.name} · ${shipment.sender?.phone}`} />
      <Row k="Recipient" v={`${shipment.recipient?.name} · ${shipment.recipient?.phone}`} />
      {shipment.deliveryPreference === 'delivery' && <Row k="Deliver to" v={shipment.deliveryAddress?.address} />}
      <Row k="Charge" v={`$${shipment.pricing?.amount} (${shipment.pricing?.paymentStatus})`} />
      {shipment.bus?.plateNumber && <Row k="Bus" v={`${shipment.bus.operator || ''} ${shipment.bus.plateNumber}`} />}
      {shipment.handover?.name && <Row k="Collected by" v={`${shipment.handover.name}${shipment.handover.idNumber ? ` (ID ${shipment.handover.idNumber})` : ''}`} />}

      <h3 style={{ marginTop: 16, marginBottom: 6 }}>Tracking</h3>
      {[...(shipment.statusHistory || [])].reverse().map((h, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: '#F37021', marginTop: 5 }} />
          <div>
            <div style={{ fontWeight: 700 }}>{STATUS_LABELS[h.status] || h.status}</div>
            {h.note && <div style={{ fontSize: 12, color: '#64748b' }}>{h.note}</div>}
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{h.at ? new Date(h.at).toLocaleString() : ''}</div>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 14 }}>
        {st === 'created' && <button style={s.btn2} onClick={() => runAction(() => courierAPI.load(shipment._id), 'Mark loaded on bus?')}>Mark Loaded on Bus</button>}
        {st === 'loaded' && <button style={s.btn2} onClick={() => runAction(() => courierAPI.depart(shipment._id), 'Mark in transit?')}>Mark In Transit</button>}
        {['loaded', 'in_transit'].includes(st) && <button style={s.btn2} onClick={() => runAction(() => courierAPI.arrive(shipment._id), 'Confirm arrival at destination?')}>Scan Arrival</button>}
        {st === 'awaiting_collection' && !showCollect && <button style={s.btn2} onClick={() => setShowCollect(true)}>Record Collection</button>}
        {st === 'awaiting_collection' && showCollect && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, marginBottom: 8 }}>
            <span style={s.label}>Collector name *</span>
            <input style={s.input} value={collect.name} onChange={(e) => setCollect({ ...collect, name: e.target.value })} />
            <span style={s.label}>ID / passport number *</span>
            <input style={s.input} value={collect.idNumber} onChange={(e) => setCollect({ ...collect, idNumber: e.target.value })} />
            <button style={s.btn} onClick={() => runAction(() => courierAPI.collect(shipment._id, collect), 'Confirm handover?')}>Confirm Handover</button>
          </div>
        )}
        {['awaiting_delivery', 'out_for_delivery'].includes(st) && (
          <div style={{ background: '#eff6ff', borderRadius: 10, padding: 12, color: '#1e3a5f' }}>Broadcast to available transporters for last-mile delivery.</div>
        )}
        {!['delivered', 'collected', 'cancelled'].includes(st) && (
          <button style={{ ...s.btn2, background: '#fff', color: '#dc2626', border: '1px solid #fecaca' }}
            onClick={() => runAction(() => courierAPI.cancel(shipment._id, { reason: 'Cancelled by agent' }), 'Cancel this shipment?')}>Cancel shipment</button>
        )}
      </div>
    </div>
  );
}

function CreateForm({ onDone }) {
  const [depots, setDepots] = useState([]);
  const [form, setForm] = useState({
    originDepot: '', destinationDepot: '', originName: '', destinationName: '',
    senderName: '', senderPhone: '', recipientName: '', recipientPhone: '',
    deliveryPreference: 'collection', deliveryAddress: '', deliveryCity: '',
    amount: '', paymentReceived: true, busOperator: '', busPlate: '', altName: '', altPhone: ''
  });
  const [items, setItems] = useState([{ description: '', quantity: '1', weight: '' }]);
  const [quote, setQuote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { courierAPI.getDepots().then((r) => setDepots(r.data || [])).catch(() => {}); }, []);

  useEffect(() => {
    const totalWeight = items.reduce((sum, it) => sum + (Number(it.weight) || 0) * (Number(it.quantity) || 1), 0);
    const h = setTimeout(() => courierAPI.quote({ totalWeight, deliveryPreference: form.deliveryPreference }).then((r) => setQuote(r.data)).catch(() => {}), 300);
    return () => clearTimeout(h);
  }, [items, form.deliveryPreference]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setItem = (i, k, v) => setItems((p) => p.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  const submit = async () => {
    if (!form.senderName || !form.senderPhone) return setErr('Sender name and phone required.');
    if (!form.recipientName || !form.recipientPhone) return setErr('Recipient name and phone required.');
    if (form.deliveryPreference === 'delivery' && !form.deliveryAddress) return setErr('Delivery address required.');
    const cleanItems = items.filter((it) => it.description.trim());
    if (!cleanItems.length) return setErr('Add at least one item.');
    setSaving(true); setErr('');
    try {
      const r = await courierAPI.createShipment({
        originDepot: form.originDepot || undefined, destinationDepot: form.destinationDepot || undefined,
        originName: form.originName || undefined, destinationName: form.destinationName || undefined,
        sender: { name: form.senderName, phone: form.senderPhone },
        recipient: { name: form.recipientName, phone: form.recipientPhone },
        alternateContacts: form.altPhone ? [{ name: form.altName, phone: form.altPhone }] : [],
        items: cleanItems.map((it) => ({ description: it.description, quantity: Number(it.quantity) || 1, weight: Number(it.weight) || 0 })),
        deliveryPreference: form.deliveryPreference,
        deliveryAddress: form.deliveryPreference === 'delivery' ? { address: form.deliveryAddress, city: form.deliveryCity } : undefined,
        pricing: { amount: Number(form.amount) || 0, paymentStatus: form.paymentReceived ? 'paid' : 'unpaid' },
        bus: { operator: form.busOperator, plateNumber: form.busPlate }
      });
      onDone(r.data?._id);
    } catch (e) { setErr(e.message || 'Could not create shipment'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ ...s.panel }}>
      <h2 style={{ marginTop: 0, color: '#0C2D48' }}>New Shipment</h2>
      {err && <div style={{ color: '#dc2626', marginBottom: 8 }}>{err}</div>}
      {depots.length > 0 && (
        <>
          <span style={s.label}>Origin depot</span>
          <select style={s.input} value={form.originDepot} onChange={(e) => { const d = depots.find((x) => x._id === e.target.value); set('originDepot', e.target.value); if (d) set('originName', `${d.name} (${d.city})`); }}>
            <option value="">— select —</option>
            {depots.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.city})</option>)}
          </select>
          <span style={s.label}>Destination depot</span>
          <select style={s.input} value={form.destinationDepot} onChange={(e) => { const d = depots.find((x) => x._id === e.target.value); set('destinationDepot', e.target.value); if (d) set('destinationName', `${d.name} (${d.city})`); }}>
            <option value="">— select —</option>
            {depots.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.city})</option>)}
          </select>
        </>
      )}
      <span style={s.label}>Origin name (if not a depot)</span><input style={s.input} value={form.originName} onChange={(e) => set('originName', e.target.value)} />
      <span style={s.label}>Destination name</span><input style={s.input} value={form.destinationName} onChange={(e) => set('destinationName', e.target.value)} />

      <h3>Sender</h3>
      <input style={s.input} placeholder="Full name *" value={form.senderName} onChange={(e) => set('senderName', e.target.value)} />
      <input style={s.input} placeholder="Phone * (+263...)" value={form.senderPhone} onChange={(e) => set('senderPhone', e.target.value)} />
      <h3>Recipient</h3>
      <input style={s.input} placeholder="Full name *" value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} />
      <input style={s.input} placeholder="Phone * (+263...)" value={form.recipientPhone} onChange={(e) => set('recipientPhone', e.target.value)} />

      <h3>At destination</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {['collection', 'delivery'].map((o) => <button key={o} style={s.chip(form.deliveryPreference === o)} onClick={() => set('deliveryPreference', o)}>{o === 'collection' ? 'Collect at depot' : 'Deliver to address'}</button>)}
      </div>
      {form.deliveryPreference === 'delivery' && (
        <>
          <input style={s.input} placeholder="Delivery address *" value={form.deliveryAddress} onChange={(e) => set('deliveryAddress', e.target.value)} />
          <input style={s.input} placeholder="City" value={form.deliveryCity} onChange={(e) => set('deliveryCity', e.target.value)} />
        </>
      )}

      <h3>Items</h3>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input style={{ ...s.input, flex: 2, marginBottom: 0 }} placeholder="Description" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
          <input style={{ ...s.input, flex: 1, marginBottom: 0 }} placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
          <input style={{ ...s.input, flex: 1, marginBottom: 0 }} placeholder="kg" value={it.weight} onChange={(e) => setItem(i, 'weight', e.target.value)} />
        </div>
      ))}
      <button style={{ ...s.chip(false), marginBottom: 10 }} onClick={() => setItems((p) => [...p, { description: '', quantity: '1', weight: '' }])}>+ Add item</button>

      <h3>Payment (collected at counter)</h3>
      {quote && (
        <div style={{ background: '#f1f5f9', borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Billable weight</span><b>{quote.billableWeight} kg</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Base + per-kg</span><b>${quote.baseFee} + ${quote.weightCharge}</b></div>
          {quote.deliverySurcharge ? <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Delivery surcharge</span><b>${quote.deliverySurcharge}</b></div> : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', marginTop: 6, paddingTop: 6, fontSize: 18, color: '#0C2D48' }}><b>Charge</b><b>${form.amount ? Number(form.amount).toFixed(2) : quote.amount.toFixed(2)}</b></div>
        </div>
      )}
      <input style={s.input} placeholder={`Override amount (optional)${quote ? ` — auto $${quote.amount}` : ''}`} value={form.amount} onChange={(e) => set('amount', e.target.value)} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input type="checkbox" checked={form.paymentReceived} onChange={(e) => set('paymentReceived', e.target.checked)} /> Payment collected at the counter
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input style={{ ...s.input, flex: 1 }} placeholder="Bus operator" value={form.busOperator} onChange={(e) => set('busOperator', e.target.value)} />
        <input style={{ ...s.input, flex: 1 }} placeholder="Bus plate" value={form.busPlate} onChange={(e) => set('busPlate', e.target.value)} />
      </div>

      <h3>Extra SMS contact (optional)</h3>
      <input style={s.input} placeholder="Name" value={form.altName} onChange={(e) => set('altName', e.target.value)} />
      <input style={s.input} placeholder="Phone (+263...)" value={form.altPhone} onChange={(e) => set('altPhone', e.target.value)} />

      <button style={{ ...s.btn, width: '100%', marginTop: 10 }} onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Create & Print Label'}</button>
    </div>
  );
}

function DepotsTab() {
  const [depots, setDepots] = useState([]);
  const [form, setForm] = useState({ name: '', code: '', city: '', address: '', phone: '' });
  const [msg, setMsg] = useState('');

  const load = () => courierAPI.getDepots().then((r) => setDepots(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.code || !form.city) return setMsg('Name, code and city are required.');
    try {
      await courierAPI.createDepot(form);
      setForm({ name: '', code: '', city: '', address: '', phone: '' });
      setMsg('Depot created.');
      load();
    } catch (e) { setMsg(e.message || 'Could not create depot'); }
  };

  return (
    <div style={s.body}>
      <div style={{ ...s.panel, maxWidth: 460 }}>
        <h2 style={{ marginTop: 0, color: '#0C2D48' }}>Depots</h2>
        {depots.length === 0 && <div style={{ color: '#64748b' }}>No depots yet.</div>}
        {depots.map((d) => (
          <div key={d._id} style={s.card}>
            <div><div style={{ fontWeight: 800 }}>{d.name}</div><div style={{ fontSize: 12, color: '#64748b' }}>{d.city} · {d.phone || 'no phone'}</div></div>
            <span style={s.badge}>{d.code}</span>
          </div>
        ))}
      </div>
      <div style={{ ...s.panel, maxWidth: 420 }}>
        <h2 style={{ marginTop: 0, color: '#0C2D48' }}>Add Depot</h2>
        {msg && <div style={{ color: '#0C2D48', marginBottom: 8 }}>{msg}</div>}
        <input style={s.input} placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input style={s.input} placeholder="Code * (e.g. HRE01)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input style={s.input} placeholder="City *" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <input style={s.input} placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input style={s.input} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <button style={{ ...s.btn, width: '100%' }} onClick={create}>Create Depot</button>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: '#64748b', fontSize: 13 }}>{k}</span><b style={{ fontSize: 13, textAlign: 'right', marginLeft: 12 }}>{v || '—'}</b></div>;
}

// Download the ZPL for a Zebra label printer.
async function downloadZpl(shipment, copies) {
  try {
    const r = await courierAPI.getZpl(shipment._id, copies);
    const zpl = r?.data?.zpl;
    if (!zpl) return;
    const blob = new Blob([zpl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${shipment.reference}.zpl`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) { window.alert(e.message || 'Could not get ZPL'); }
}

// Send the ZPL straight to a networked Zebra printer (raw TCP 9100).
async function sendZpl(shipment, copies) {
  const saved = localStorage.getItem('palmtrent_zebra_ip') || '';
  const ip = window.prompt('Zebra printer IP address (raw 9100):', saved);
  if (!ip) return;
  localStorage.setItem('palmtrent_zebra_ip', ip);
  try {
    const r = await courierAPI.printZpl(shipment._id, { printerIp: ip, copies });
    window.alert(r.message || 'Sent to printer');
  } catch (e) { window.alert(e.message || 'Could not reach printer'); }
}

// Opens a print-optimised window with a large, high-contrast, bold label sized
// for a standard 100×150mm thermal shipping-label printer. Prints `copies`
// labels (one per item), each on its own page.
function printLabel(label, copies = 1) {
  if (!label) return;
  const n = Math.max(1, Math.min(50, Number(copies) || 1));
  const isDelivery = label.deliveryPreference === 'delivery';
  const esc = (t) => String(t == null ? '' : t).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const oneLabel = (i) => `<div class="border" style="page-break-after:${i < n - 1 ? 'always' : 'auto'}">
      <div class="head"><span class="brand">PALMTRENT</span><span class="tag">${isDelivery ? 'DELIVER' : 'COLLECT'}</span></div>
      ${label.qrImageUrl ? `<div><img class="qr" src="${esc(label.qrImageUrl)}"/></div>` : ''}
      <div class="ref">${esc(label.code)}</div>
      <div class="copy">ITEM ${i + 1} OF ${n}</div>
      <div class="route">${esc((label.origin || '').toUpperCase())}<div class="arrow">&#8595;</div>${esc((label.destination || '').toUpperCase())}</div>
      <div class="to">${esc(label.recipient)}<div class="phone">${esc(label.recipientPhone)}</div></div>
      <div class="meta">${esc(label.packageCount || 1)} ITEMS &middot; ${esc(label.totalWeight || 0)} KG</div>
      <div class="from">FROM: ${esc(label.sender)}</div>
    </div>`;
  const w = window.open('', '_blank', 'width=440,height=760');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${esc(label.code)}</title><style>
    @page { size: 100mm 150mm; margin: 5mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; }
    .border { border: 5px solid #0C2D48; border-radius: 10px; padding: 16px; text-align: center; }
    .head { display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 30px; font-weight: 900; letter-spacing: 3px; color: #0C2D48; }
    .tag { font-size: 24px; font-weight: 900; color: #fff; padding: 6px 18px; border-radius: 8px; background: ${isDelivery ? '#F37021' : '#0C2D48'}; }
    .qr { width: 240px; height: 240px; margin: 8px 0; }
    .ref { font-size: 50px; font-weight: 900; letter-spacing: 3px; margin: 6px 0; }
    .copy { font-size: 22px; font-weight: 900; color: #F37021; margin-bottom: 6px; }
    .route { font-size: 30px; font-weight: 900; color: #0C2D48; line-height: 1.2; }
    .arrow { font-size: 34px; font-weight: 900; }
    .to { font-size: 36px; font-weight: 900; border-top: 4px solid #000; padding-top: 12px; margin-top: 12px; }
    .phone { font-size: 28px; font-weight: 800; color: #0C2D48; }
    .meta { font-size: 24px; font-weight: 900; border-top: 4px solid #000; padding-top: 12px; margin-top: 12px; }
    .from { font-size: 18px; font-weight: 700; margin-top: 12px; text-align: left; }
  </style></head><body onload="window.print()">
    ${Array.from({ length: n }, (_, i) => oneLabel(i)).join('')}
  </body></html>`);
  w.document.close();
}

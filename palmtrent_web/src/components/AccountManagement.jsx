import React, { useState } from 'react';
import { Download, PauseCircle, Trash2, X } from 'lucide-react';
import { authAPI } from '../services/api';

// Self-service account management (download data / deactivate / delete) shared by
// the shipper, corporate, and fleet dashboards. Mirrors the mobile app so the
// controls are consistent across platforms.
const AccountManagement = () => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState('');

  const handleExport = async () => {
    try {
      setBusy(true);
      setMessage('');
      const response = await authAPI.exportMyData();
      const json = JSON.stringify(response.data ?? response, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'palmtrent-my-data.json';
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Your data has been downloaded.');
    } catch (error) {
      setMessage(error.message || 'Unable to export your data.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Deactivate your account? You will be signed out and must contact support to reactivate it.')) return;
    try {
      setBusy(true);
      await authAPI.deactivateAccount();
      authAPI.logout();
    } catch (error) {
      setMessage(error.message || 'Unable to deactivate account.');
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!password) {
      setMessage('Enter your password to confirm deletion.');
      return;
    }
    try {
      setBusy(true);
      await authAPI.deleteAccount(password);
      authAPI.logout();
    } catch (error) {
      setMessage(error.message || 'Unable to delete account. Check your password.');
      setBusy(false);
    }
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>Account Management</h3>
      {message ? <p style={styles.message}>{message}</p> : null}

      <button type="button" style={styles.row} onClick={handleExport} disabled={busy}>
        <Download size={18} />
        <span style={styles.rowLabel}>Download My Data</span>
      </button>

      <button type="button" style={styles.row} onClick={handleDeactivate} disabled={busy}>
        <PauseCircle size={18} />
        <span style={styles.rowLabel}>Deactivate Account</span>
      </button>

      <button type="button" style={{ ...styles.row, ...styles.danger }} onClick={() => setShowDelete(true)} disabled={busy}>
        <Trash2 size={18} />
        <span style={styles.rowLabel}>Delete Account</span>
      </button>

      {showDelete && (
        <div style={styles.overlay} onClick={() => setShowDelete(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h4 style={{ margin: 0 }}>Delete Account</h4>
              <button type="button" style={styles.close} onClick={() => setShowDelete(false)}><X size={18} /></button>
            </div>
            <p style={styles.modalText}>
              This permanently deletes your account and removes your personal details.
              This cannot be undone. Enter your password to confirm.
            </p>
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />
            <div style={styles.modalActions}>
              <button type="button" style={styles.cancelBtn} onClick={() => { setShowDelete(false); setPassword(''); }}>Cancel</button>
              <button type="button" style={styles.deleteBtn} onClick={handleDelete} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginTop: 20 },
  title: { margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0C2D48' },
  message: { color: '#6b7280', fontSize: 13, marginBottom: 12 },
  row: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px',
    marginBottom: 10, cursor: 'pointer', color: '#111827', fontSize: 14, fontWeight: 600
  },
  rowLabel: { flex: 1 },
  danger: { color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 12, padding: 20, width: '90%', maxWidth: 420 },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  close: { background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' },
  modalText: { color: '#6b7280', fontSize: 13, lineHeight: 1.5, marginBottom: 16 },
  input: { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 16, boxSizing: 'border-box' },
  modalActions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  cancelBtn: { background: '#e5e7eb', border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, color: '#111827' },
  deleteBtn: { background: '#dc2626', border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, color: '#fff' },
};

export default AccountManagement;

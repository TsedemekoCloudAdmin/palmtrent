import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

// Shown when a signed-in account was provisioned with a temporary password
// (mustChangePassword). The backend blocks all other endpoints until the
// password is changed, so this page only talks to the change-password endpoint.
const wrapStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0C2D48', padding: '1.5rem' };
const cardStyle = { width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: '2rem', boxShadow: '0 20px 45px rgba(0,0,0,0.25)' };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6, marginTop: 14 };
const inputStyle = { width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 12px', fontSize: 15 };
const buttonStyle = { width: '100%', minHeight: 46, marginTop: 20, borderRadius: 12, border: 'none', background: '#F37021', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' };
const messageStyle = { marginTop: 14, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', padding: '0.7rem 0.9rem', borderRadius: 8, fontSize: 13 };

const ForceChangePasswordPage = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setMessage('Your new password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setMessage('Choose a password different from the temporary one.');
      return;
    }
    try {
      setSaving(true);
      setMessage('');
      await authAPI.changePassword(currentPassword, newPassword);
      navigate('/', { replace: true });
    } catch (error) {
      setMessage(error.message || 'Could not change your password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={wrapStyle}>
      <form style={cardStyle} onSubmit={submit}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>Set a new password</h1>
        <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.5, marginTop: 8 }}>
          Your account was created with a temporary password. Set your own password to continue.
        </p>

        <label style={labelStyle}>Temporary password
          <input style={inputStyle} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </label>
        <label style={labelStyle}>New password
          <input style={inputStyle} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </label>
        <label style={labelStyle}>Confirm new password
          <input style={inputStyle} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </label>

        {message && <div style={messageStyle}>{message}</div>}

        <button style={buttonStyle} disabled={saving}>{saving ? 'Updating...' : 'Update Password'}</button>
        <button
          type="button"
          onClick={authAPI.logout}
          style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
        >
          Sign out
        </button>
      </form>
    </div>
  );
};

export default ForceChangePasswordPage;

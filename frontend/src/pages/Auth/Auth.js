import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';

const Auth = ({ initialMode = 'login' }) => {
  const [authView, setAuthView] = useState(initialMode === 'signup' ? 'signup' : 'login'); // 'login' | 'signup' | 'forgot'
  const [role, setRole] = useState('user');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
    newPassword: '',
    kitchenName: '',
    areaName: '',
    city: '',
    pincode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData({ ...formData, phone: val });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (authView === 'login') {
        const loginIdentifier = (formData.email || formData.username || '').trim();
        const res = await axios.post('/api/auth/login', {
          username: loginIdentifier,
          password: formData.password,
          role: role
        });

        if (res.data?.success && res.data?.user) {
          if (res.data.restoredNotice === true) {
            alert('🎉 Welcome back! Your scheduled account deletion has been CANCELLED and restored.');
          }
          loginUser(res.data.user, res.data.token);
          if (res.data.user.role === 'seller') {
            navigate('/seller');
          } else {
            navigate('/');
          }
        } else {
          setError(res.data?.message || 'Login failed.');
        }
      } else if (authView === 'signup') {
        if (formData.phone.length !== 10) {
          setLoading(false);
          return setError('Contact Number must be exactly 10 digits.');
        }
        const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_-])[A-Za-z\d@$!%*?&#^_-]{8,}$/;
        if (!passRegex.test(formData.password)) {
          setLoading(false);
          return setError('Password must contain at least 8 characters, including 1 uppercase, 1 lowercase, 1 number, and 1 special character.');
        }
        if (role === 'seller' && (!formData.kitchenName.trim() || !formData.city.trim())) {
          setLoading(false);
          return setError('Kitchen / Brand Name and City are required.');
        }

        const res = await axios.post('/api/auth/signup', {
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
          phone: formData.phone.trim(),
          role: role,
          kitchenName: formData.kitchenName.trim(),
          areaName: formData.areaName.trim(),
          city: formData.city.trim(),
          pincode: formData.pincode.trim()
        });

        if (res.data?.success) {
          alert('🎉 Registration Successful! Please log in with your credentials.');
          setAuthView('login');
          setFormData(prev => ({ ...prev, password: '' }));
        } else {
          setError(res.data?.message || 'Registration failed.');
        }
      } else if (authView === 'forgot') {
        // Forgot Password API Call
        const res = await axios.post('/api/auth/forgot-password', {
          username: formData.username.trim(),
          phone: formData.phone.trim(),
          newPassword: formData.newPassword
        });

        if (res.data?.success) {
          alert(res.data.message);
          setAuthView('login');
          setFormData(prev => ({ ...prev, password: '', newPassword: '' }));
        } else {
          setError(res.data?.message || 'Password reset failed.');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '420px', margin: '20px auto', padding: '20px 14px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 25px rgba(0,0,0,0.06)', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>

      {/* Role Switcher */}
      {authView !== 'forgot' && (
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => { setRole('user'); setError(''); }}
            style={{
              flex: 1,
              padding: '9px',
              border: 'none',
              borderRadius: '8px',
              background: role === 'user' ? '#ffffff' : 'transparent',
              color: role === 'user' ? '#16a34a' : '#64748b',
              fontWeight: '800',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => { setRole('seller'); setError(''); }}
            style={{
              flex: 1,
              padding: '9px',
              border: 'none',
              borderRadius: '8px',
              background: role === 'seller' ? '#ffffff' : 'transparent',
              color: role === 'seller' ? '#16a34a' : '#64748b',
              fontWeight: '800',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Cloud Kitchen (Seller)
          </button>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: '18px' }}>
        <h2 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '20px', fontWeight: '800' }}>
          {authView === 'forgot'
            ? '🔑 Reset Your Password'
            : authView === 'login'
            ? (role === 'seller' ? 'Kitchen Partner Login' : 'Customer Sign In')
            : (role === 'seller' ? 'Register Your Cloud Kitchen' : 'Create Customer Account')}
        </h2>
        {authView === 'forgot' && (
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Verify your username and 10-digit registered phone to set a new password.
          </span>
        )}
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px', fontWeight: '700', border: '1px solid #f87171' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Username */}
        <div>
          <label htmlFor="auth-username" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
            {authView === 'login' ? 'USERNAME OR EMAIL *' : 'DESIRED USERNAME *'}
          </label>
          <input
            id="auth-username"
            name="username"
            type="text"
            placeholder={authView === 'login' ? 'Enter username or email' : 'e.g. kalyan_kumar'}
            value={formData.username}
            onChange={e => setFormData({ ...formData, username: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
            required
          />
        </div>

        {/* Email on Signup */}
        {authView === 'signup' && (
          <div>
            <label htmlFor="auth-email" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
              EMAIL ADDRESS *
            </label>
            <input
              id="auth-email"
              name="email"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              required
            />
          </div>
        )}

        {/* Phone on Signup or Forgot */}
        {(authView === 'signup' || authView === 'forgot') && (
          <div>
            <label htmlFor="auth-phone" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
              REGISTERED CONTACT NUMBER (10 DIGITS) *
            </label>
            <input
              id="auth-phone"
              name="phone"
              type="tel"
              placeholder="10-digit mobile number"
              value={formData.phone}
              onChange={handlePhoneChange}
              maxLength="10"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              required
            />
          </div>
        )}

        {/* Seller Specific Fields */}
        {authView === 'signup' && role === 'seller' && (
          <>
            <div>
              <label htmlFor="auth-kitchen-name" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                KITCHEN / BRAND NAME *
              </label>
              <input
                id="auth-kitchen-name"
                name="kitchenName"
                type="text"
                placeholder="e.g. FitMeals Cloud Kitchen"
                value={formData.kitchenName}
                onChange={e => setFormData({ ...formData, kitchenName: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: '8px' }}>
              <input
                type="text"
                placeholder="Area / Hub *"
                value={formData.areaName}
                onChange={e => setFormData({ ...formData, areaName: e.target.value })}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', minWidth: 0, boxSizing: 'border-box' }}
                required
              />
              <input
                type="text"
                placeholder="City *"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', minWidth: 0, boxSizing: 'border-box' }}
                required
              />
              <input
                type="text"
                placeholder="PIN Code"
                maxLength="6"
                value={formData.pincode}
                onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', minWidth: 0, boxSizing: 'border-box' }}
              />
            </div>
          </>
        )}

        {/* Password field on Login / Signup */}
        {authView !== 'forgot' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="auth-password" style={{ fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                PASSWORD * {authView === 'signup' && <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 'bold' }}>(Min 8 chars, 1 Upper, 1 Num, 1 Symbol)</span>}
              </label>
              {authView === 'login' && (
                <button
                  type="button"
                  onClick={() => { setAuthView('forgot'); setError(''); }}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <input
              id="auth-password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              required
            />
          </div>
        )}

        {/* New Password on Forgot View */}
        {authView === 'forgot' && (
          <div>
            <label htmlFor="auth-new-password" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
              SET NEW PASSWORD * <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 'bold' }}>(Min 8 chars, 1 Upper, 1 Num, 1 Symbol)</span>
            </label>
            <input
              id="auth-new-password"
              name="newPassword"
              type="password"
              placeholder="Enter your new secure password"
              value={formData.newPassword}
              onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              required
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '8px',
            background: '#16a34a',
            color: '#ffffff',
            border: 'none',
            padding: '12px',
            borderRadius: '8px',
            fontWeight: '800',
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : authView === 'forgot' ? '⚡ Reset & Save Password' : authView === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
        {authView === 'forgot' ? (
          <button
            type="button"
            onClick={() => { setAuthView('login'); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#16a34a', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ← Back to Login
          </button>
        ) : authView === 'login' ? (
          <>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => { setAuthView('signup'); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#16a34a', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Register Here
            </button>
          </>
        ) : (
          <>
            Already registered?{' '}
            <button
              type="button"
              onClick={() => { setAuthView('login'); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#16a34a', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Log In
            </button>
          </>
        )}
      </div>

    </div>
  );
};

export default Auth;

import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';

const Auth = ({ initialMode = 'login' }) => {
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  const [role, setRole] = useState('user'); // 'user' or 'seller'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
    areaName: '',
    city: '',
    pincode: ''
  });
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        const res = await axios.post('/api/auth/login', {
          identifier: formData.email || formData.username,
          password: formData.password
        });
        if (res.data?.user) {
          login(res.data.user);
          if (res.data.user.role === 'seller') {
            navigate('/seller');
          } else {
            navigate('/');
          }
        }
      } else {
        const res = await axios.post('/api/auth/signup', {
          ...formData,
          role
        });
        if (res.data?.user) {
          login(res.data.user);
          if (res.data.user.role === 'seller') {
            navigate('/seller');
          } else {
            navigate('/');
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '40px auto', padding: '24px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
      
      {/* Role Selector Tabs */}
      <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setRole('user')}
          style={{
            flex: 1,
            padding: '8px',
            border: 'none',
            borderRadius: '8px',
            background: role === 'user' ? '#ffffff' : 'transparent',
            color: role === 'user' ? '#16a34a' : '#64748b',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: role === 'user' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
          }}
        >
          👤 Customer
        </button>
        <button
          type="button"
          onClick={() => setRole('seller')}
          style={{
            flex: 1,
            padding: '8px',
            border: 'none',
            borderRadius: '8px',
            background: role === 'seller' ? '#ffffff' : 'transparent',
            color: role === 'seller' ? '#16a34a' : '#64748b',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: role === 'seller' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
          }}
        >
          👨‍🍳 Cloud Kitchen (Seller)
        </button>
      </div>

      <h2 style={{ textAlign: 'center', margin: '0 0 6px 0', color: '#0f172a', fontSize: '20px', fontWeight: '800' }}>
        {isLogin ? `🔑 ${role === 'seller' ? 'Kitchen Partner Login' : 'Customer Login'}` : `🌱 ${role === 'seller' ? 'Register Your Kitchen' : 'Create Customer Account'}`}
      </h2>
      <p style={{ textAlign: 'center', margin: '0 0 18px 0', fontSize: '12px', color: '#64748b' }}>
        {role === 'seller' ? 'Manage your dishes & live order desk' : 'Order fresh healthy meals delivered to your doorstep'}
      </p>

      {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px', fontWeight: '600' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!isLogin && (
          <input
            type="text"
            placeholder={role === 'seller' ? "Kitchen / Brand Name *" : "Full Name *"}
            value={formData.username}
            onChange={e => setFormData({ ...formData, username: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            required
          />
        )}

        <input
          type={isLogin ? 'text' : 'email'}
          placeholder={isLogin ? "Email or Kitchen Username *" : "Email Address *"}
          value={formData.email}
          onChange={e => setFormData({ ...formData, email: e.target.value })}
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          required
        />

        {!isLogin && (
          <input
            type="tel"
            placeholder="Contact Number *"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            required
          />
        )}

        {!isLogin && role === 'seller' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
            <input
              type="text"
              placeholder="Area (e.g. Indiranagar) *"
              value={formData.areaName}
              onChange={e => setFormData({ ...formData, areaName: e.target.value })}
              style={{ padding: '10px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              required
            />
            <input
              type="text"
              placeholder="City *"
              value={formData.city}
              onChange={e => setFormData({ ...formData, city: e.target.value })}
              style={{ padding: '10px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              required
            />
            <input
              type="text"
              maxLength="6"
              placeholder="PIN Code *"
              value={formData.pincode}
              onChange={e => setFormData({ ...formData, pincode: e.target.value })}
              style={{ padding: '10px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              required
            />
          </div>
        )}

        <input
          type="password"
          placeholder="Password *"
          value={formData.password}
          onChange={e => setFormData({ ...formData, password: e.target.value })}
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          required
        />

        <button
          type="submit"
          style={{
            background: '#16a34a',
            color: '#ffffff',
            border: 'none',
            padding: '12px',
            borderRadius: '8px',
            fontWeight: '800',
            fontSize: '14px',
            cursor: 'pointer',
            marginTop: '6px'
          }}
        >
          {isLogin ? (role === 'seller' ? 'Access Kitchen Desk' : 'Sign In to Order') : 'Create Account'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
        {isLogin ? "New to HealthyBites? " : "Already registered? "}
        <button
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          style={{ background: 'none', border: 'none', color: '#16a34a', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {isLogin ? 'Register Here' : 'Log In'}
        </button>
      </div>

    </div>
  );
};

export default Auth;

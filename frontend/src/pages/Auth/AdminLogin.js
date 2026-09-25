import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { loginUser } = useContext(AuthContext);
  const [formData, setFormData] = useState({ username: '', password: '', secretKey: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.username.trim() !== 'admin') {
      return setError('❌ Invalid Admin Username');
    }
    if (formData.password !== 'admin123' && formData.secretKey !== 'healthyadmin2026') {
      return setError('❌ Invalid Password or Security Master Key');
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', {
        username: formData.username.trim(),
        password: formData.password,
        secretKey: formData.secretKey,
        role: 'admin'
      });

      if (res.data?.success && res.data?.user) {
        loginUser(res.data.user, res.data.token);
        navigate('/admin');
      } else {
        setError(res.data?.message || 'Unauthorized Admin Access');
      }
    } catch (err) {
      setError(err.response?.data?.message || '❌ Authentication Failed: Invalid Credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0b0e11', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '400px', width: '100%', background: '#131920', border: '1px solid #1e293b', borderRadius: '16px', padding: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{ width: '40px', height: '40px', margin: '0 auto 10px auto', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '18px' }}>
            H
          </div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#ffffff', fontWeight: '800' }}>
            HealthyBites Ops Console
          </h2>
          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
            RESTRICTED • AUTHORIZED PERSONNEL ONLY
          </span>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px', fontWeight: '600' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>ADMIN USERNAME</label>
            <input
              type="text"
              placeholder="admin"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0b0e11', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>PASSWORD</label>
            <input
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0b0e11', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>SECURITY MASTER KEY</label>
            <input
              type="password"
              placeholder="healthyadmin2026"
              value={formData.secretKey}
              onChange={e => setFormData({ ...formData, secretKey: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0b0e11', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              background: '#22c55e',
              color: '#052e16',
              border: 'none',
              padding: '12px',
              borderRadius: '8px',
              fontWeight: '800',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Authenticating...' : '⚡ Unlock Operations Console'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;

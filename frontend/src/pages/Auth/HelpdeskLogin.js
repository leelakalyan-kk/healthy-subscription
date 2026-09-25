import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';

const HelpdeskLogin = () => {
  const navigate = useNavigate();
  const { loginUser } = useContext(AuthContext);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/login', {
        username: formData.username.trim(),
        password: formData.password,
        role: 'helpdesk'
      });

      if (res.data?.success && res.data?.user) {
        const staff = res.data.user;
        // Verify helpdesk or admin authorization
        if (staff.role !== 'helpdesk' && staff.role !== 'admin') {
          setError('❌ Unauthorized: Only registered helpdesk staff can login here.');
          setLoading(false);
          return;
        }

        loginUser(staff, res.data.token || 'helpdesk_session_token');
        navigate('/admin');
      } else {
        setError(res.data?.message || 'Invalid agent credentials');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0e11',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        background: '#131920',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        padding: '32px 28px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
      }}>
        
        {/* Portal Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            margin: '0 auto 12px auto',
            borderRadius: '10px',
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid #38bdf8',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px'
          }}>
            🎧
          </div>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '19px', color: '#ffffff', fontWeight: '800' }}>
            Customer Support Agent Portal
          </h2>
          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Order Lookup · Live Dispatch · Issue Resolution
          </span>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            marginBottom: '16px',
            fontWeight: '600'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'monospace' }}>
              AGENT USERNAME *
            </label>
            <input
              type="text"
              placeholder="e.g. agent_ramesh"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: '#0b0e11',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'monospace' }}>
              PASSWORD *
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: '#0b0e11',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              background: '#38bdf8',
              color: '#082f49',
              border: 'none',
              padding: '12px',
              borderRadius: '8px',
              fontWeight: '800',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease'
            }}
          >
            {loading ? 'Authenticating Agent...' : '🎧 Login to Support Desk'}
          </button>
        </form>

        <div style={{ marginTop: '20px', borderTop: '1px solid #1e293b', paddingTop: '16px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Are you a Super Admin?{' '}
            <Link to="/admin-login" style={{ color: '#22c55e', textDecoration: 'none', fontWeight: '700' }}>
              Master Console Login
            </Link>
          </span>
        </div>

      </div>
    </div>
  );
};

export default HelpdeskLogin;

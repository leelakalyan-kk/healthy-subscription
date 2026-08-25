import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';

const Auth = () => {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [loginData, setLoginData] = useState({ identifier: '', password: '' });
  const [signupData, setSignupData] = useState({ username: '', email: '', phone: '', password: '', role: 'user' });
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', loginData);
      const user = res.data.user;
      login(user);
      alert(`Welcome back, ${user.username}!`);
      if (user.role === 'seller') {
        navigate('/seller');
      } else {
        navigate('/');
      }
    } catch (err) {
      alert(err.response?.data?.error || "Login Failed!");
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/signup', signupData);
      alert(res.data.message || "Account created successfully!");
      setAuthMode('login');
    } catch (err) {
      alert(err.response?.data?.error || "Signup Failed!");
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '50px auto', background: 'white', padding: '36px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      
      {authMode === 'login' ? (
        /* LOGIN FORM */
        <form onSubmit={handleLogin}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '0 0 20px 0' }}>Sign In</h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#475569' }}>Email or Username</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Enter email or username" 
              required 
              value={loginData.identifier} 
              onChange={e => setLoginData({ ...loginData, identifier: e.target.value })} 
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#475569' }}>Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="Enter password" 
              required 
              value={loginData.password} 
              onChange={e => setLoginData({ ...loginData, password: e.target.value })} 
            />
          </div>

          <button type="submit" className="btn-green" style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 'bold' }}>
            Submit
          </button>

          {/* LINK TO SIGN UP */}
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
            Don't have an account?{' '}
            <span 
              onClick={() => setAuthMode('signup')} 
              style={{ color: '#16a34a', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Sign Up
            </span>
          </div>
        </form>
      ) : (
        /* SIGN UP FORM */
        <form onSubmit={handleSignup}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '0 0 20px 0' }}>Create Account</h2>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>Username</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Enter username" 
              required 
              value={signupData.username} 
              onChange={e => setSignupData({ ...signupData, username: e.target.value })} 
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="Enter email" 
              required 
              value={signupData.email} 
              onChange={e => setSignupData({ ...signupData, email: e.target.value })} 
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>Mobile Number</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Enter phone number" 
              required 
              value={signupData.phone} 
              onChange={e => setSignupData({ ...signupData, phone: e.target.value })} 
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="Create password" 
              required 
              value={signupData.password} 
              onChange={e => setSignupData({ ...signupData, password: e.target.value })} 
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>Account Type</label>
            <select 
              className="form-input" 
              value={signupData.role} 
              onChange={e => setSignupData({ ...signupData, role: e.target.value })}
            >
              <option value="user">Customer (User)</option>
              <option value="seller">Seller</option>
            </select>
          </div>

          <button type="submit" className="btn-green" style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 'bold' }}>
            Submit
          </button>

          {/* LINK TO SIGN IN */}
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
            Already have an account?{' '}
            <span 
              onClick={() => setAuthMode('login')} 
              style={{ color: '#16a34a', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Sign In
            </span>
          </div>
        </form>
      )}

    </div>
  );
};

export default Auth;

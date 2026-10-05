import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Footer = () => {
  const navigate = useNavigate();
  const [modalContent, setModalContent] = useState(null);

  const RIDER_SERVER_URL = 'http://15.206.179.97';

  const handleCategoryClick = (categoryName) => {
    navigate('/');
    window.scrollTo({ top: 120, behavior: 'smooth' });
    window.dispatchEvent(new CustomEvent('select_category', { detail: categoryName }));
  };

  const handleStartTour = () => {
    localStorage.removeItem('tour_completed_customer_v1');
    window.location.reload();
  };

  const linkStyle = {
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'color 0.2s ease'
  };

  const columnHeaderStyle = {
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '800',
    marginBottom: '18px',
    letterSpacing: '0.3px',
    textTransform: 'uppercase'
  };

  return (
    <>
      <footer style={{ background: '#090d16', color: '#cbd5e1', borderTop: '1px solid #1e293b', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '48px 20px 36px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '36px'
        }}>

          {/* Column 1: Brand & Clean Vector Social Icons */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '24px' }}>🌱</span>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#22c55e', letterSpacing: '-0.5px' }}>
                HealthyBites
              </span>
            </div>
            <p style={{ fontSize: '13px', lineHeight: '1.65', color: '#94a3b8', margin: '0 0 18px 0' }}>
              Premium, trust-first healthy meal subscription platform. Every calorie is freshly prepared by certified cloud kitchens.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              {/* Instagram Vector Icon */}
              <a href="https://instagram.com" target="_blank" rel="noreferrer" title="Instagram" style={{ background: '#1e293b', color: '#fff', width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
              {/* X / Twitter Vector Icon */}
              <a href="https://twitter.com" target="_blank" rel="noreferrer" title="Twitter / X" style={{ background: '#1e293b', color: '#fff', width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              {/* Web / Globe Vector Icon */}
              <a href="https://healthybites.com" target="_blank" rel="noreferrer" title="Website" style={{ background: '#1e293b', color: '#fff', width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Categories */}
          <div>
            <h3 style={columnHeaderStyle}>Categories</h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button type="button" onClick={() => handleCategoryClick('All')} style={linkStyle}>
                🍽️ All Meals
              </button>
              <button type="button" onClick={() => handleCategoryClick('High Protein')} style={linkStyle}>
                💪 High Protein Meals
              </button>
              <button type="button" onClick={() => handleCategoryClick('Salad')} style={linkStyle}>
                🥗 Fresh Organic Salads
              </button>
              <button type="button" onClick={() => handleCategoryClick('Keto')} style={linkStyle}>
                🥑 Keto Diet Bowls
              </button>
              <button type="button" onClick={() => handleCategoryClick('Bowl')} style={linkStyle}>
                🍲 Nutrient-Dense Bowls
              </button>
              <button type="button" onClick={() => { navigate('/account'); window.scrollTo(0, 0); }} style={{ ...linkStyle, color: '#22c55e', fontWeight: 'bold' }}>
                🗓 Flexible Subscriptions ➔
              </button>
            </div>
          </div>

          {/* Column 3: Partner Onboarding */}
          <div>
            <h3 style={columnHeaderStyle}>Partner Onboarding</h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Link to="/signup" style={linkStyle}>
                <span>👨‍🍳</span> Kitchen / Vendor Registration
              </Link>
              <a href={`${RIDER_SERVER_URL}/signup`} target="_blank" rel="noreferrer" style={linkStyle}>
                <span>🛵</span> Delivery Partner Registration
              </a>
              <Link to="/login" style={linkStyle}>
                <span>💻</span> Kitchen Partner Login
              </Link>
              <a href={`${RIDER_SERVER_URL}/login`} target="_blank" rel="noreferrer" style={linkStyle}>
                <span>⚡</span> Delivery Rider Login
              </a>
              <Link to="/admin-login" style={linkStyle}>
                <span>🔑</span> Admin Portal Login
              </Link>
              <Link to="/support-login" style={linkStyle}>
                <span>🎧</span> Support Desk Login
              </Link>
            </div>
          </div>

          {/* Column 4: Contact & Platform Tour */}
          <div>
            <h3 style={columnHeaderStyle}>Contact & Support</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: '#94a3b8' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>📍</span>
                <span>Vijayawada & Surrounding Hubs,<br/>Andhra Pradesh, India</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>✉️</span>
                <a href="mailto:support@healthybites.com" style={{ color: '#22c55e', textDecoration: 'none' }}>support@healthybites.com</a>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>📞</span>
                <span>+91 1800-202-2026</span>
              </div>

              <button
                type="button"
                onClick={handleStartTour}
                style={{
                  marginTop: '8px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: '#22c55e',
                  border: '1px solid #22c55e',
                  padding: '9px 16px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: 'fit-content'
                }}
              >
                <span>🚀</span>
                <span>Restart Platform Tour</span>
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div style={{ background: '#05080e', padding: '16px 20px', borderTop: '1px solid #1e293b' }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12px',
            color: '#64748b'
          }}>
            <span>© 2026 HealthyBites. All rights reserved.</span>
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setModalContent({ title: 'Privacy Policy', text: 'HealthyBites respects your privacy. We strictly safeguard customer GPS coordinates, phone numbers, and payment details under Indian Data Protection norms. We do not sell user data to third parties.' })}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: 0 }}
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setModalContent({ title: 'Terms of Service', text: 'Orders are freshly prepared by verified cloud kitchens within 10-30KM. Subscriptions may be customized for the next day before 8:00 PM. Instant refunds apply to cancelled orders directly to your HealthyBites wallet.' })}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: 0 }}
              >
                Terms of Service
              </button>
              <Link to="/signup" style={{ color: '#94a3b8', textDecoration: 'none' }}>Kitchen Registration</Link>
              <Link to="/admin-login" style={{ color: '#94a3b8', textDecoration: 'none' }}>Admin Login</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Info Modal for Terms / Privacy */}
      {modalContent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(3px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            maxWidth: '460px',
            width: '100%',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            color: '#0f172a'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '800' }}>{modalContent.title}</h3>
            <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#475569', margin: '0 0 20px 0' }}>{modalContent.text}</p>
            <button
              type="button"
              onClick={() => setModalContent(null)}
              style={{
                width: '100%',
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                padding: '10px',
                borderRadius: '8px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;

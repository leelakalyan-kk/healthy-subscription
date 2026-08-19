import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navbar = ({ cartCount, toggleCart, searchQuery, setSearchQuery, currentLocation }) => {
  const { currentUser, logout } = useContext(AuthContext);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    setShowDropdown(false);
    navigate(path);
  };

  const isSeller = currentUser && currentUser.role === 'seller';

  return (
    <header className="navbar" style={{ padding: '14px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', borderBottom: '1px solid #e2e8f0', gap: '20px' }}>
      
      {/* 1. Brand Logo */}
      <div className="brand-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: '800', color: '#16a34a', flexShrink: 0 }}>
        <div className="logo-icon">🌱</div>
        HealthySubscription {isSeller && <span style={{ fontSize: '12px', background: '#ecfdf5', color: '#16a34a', padding: '2px 8px', borderRadius: '6px', border: '1px solid #86efac' }}>SELLER</span>}
      </div>

      {/* 2. Search Bar */}
      <div style={{ flex: '1', maxWidth: '360px', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '15px' }}>🔍</span>
        <input 
          type="text" 
          className="search-input" 
          placeholder={isSeller ? "Search catalog items..." : "Search protein meals, salads..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
        />
      </div>

      {/* 3. Clean Auto-Detected Location Pill (No manual popup) */}
      {!isSeller && (
        <div 
          style={{ 
            background: '#ecfdf5', 
            color: '#15803d', 
            border: '1px solid #86efac', 
            padding: '8px 16px', 
            borderRadius: '20px', 
            fontSize: '13px', 
            fontWeight: '700', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          📍 <span>{currentLocation || 'Detecting Location...'}</span>
        </div>
      )}

      {/* 4. Cart & Profile */}
      <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        {!isSeller && (
          <button type="button" className="icon-btn" onClick={toggleCart} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', position: 'relative', fontSize: '15px' }}>
            🛒 <span className="cart-badge" style={{ background: '#dc2626', color: 'white', borderRadius: '999px', padding: '2px 6px', fontSize: '11px', fontWeight: 'bold', marginLeft: '4px' }}>{cartCount}</span>
          </button>
        )}

        <div 
          style={{ position: 'relative', paddingBottom: '5px' }}
          onMouseEnter={() => setShowDropdown(true)}
          onMouseLeave={() => setShowDropdown(false)}
        >
          <button 
            type="button" 
            className="icon-btn" 
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '15px' }}
          >
            👤
          </button>

          {showDropdown && (
            <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', minWidth: '220px', zIndex: 999, padding: '8px 0', marginTop: '2px' }}>
              {currentUser ? (
                <>
                  <div className="dropdown-header" style={{ padding: '8px 16px', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>
                    {isSeller ? '👨‍🍳 SELLER' : '👤 CUSTOMER'}: {currentUser.username?.toUpperCase()}
                  </div>
                  
                  {isSeller ? (
                    <>
                      <div className="dropdown-item" style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '14px' }} onClick={() => handleNavigation('/seller?tab=orders')}>👨‍🍳 Seller Dashboard</div>
                      <div className="dropdown-item" style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '14px' }} onClick={() => handleNavigation('/seller?tab=orders')}>📥 Manage Orders</div>
                      <div className="dropdown-item" style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '14px' }} onClick={() => handleNavigation('/seller?tab=add-product')}>➕ Add New Item</div>
                      <div className="dropdown-item" style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '14px' }} onClick={() => handleNavigation('/seller?tab=revenue')}>💵 Revenue / Payouts</div>
                    </>
                  ) : (
                    <>
                      <div className="dropdown-item" style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '14px' }} onClick={() => { toggleCart(); setShowDropdown(false); }}>🛒 Cart</div>
                      <div className="dropdown-item" style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '14px' }} onClick={() => handleNavigation('/account?tab=ordered-items')}>📦 Ordered items</div>
                      <div className="dropdown-item" style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '14px' }} onClick={() => handleNavigation('/account?tab=wishlist')}>💚 Wish list</div>
                      <div className="dropdown-item" style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '14px' }} onClick={() => handleNavigation('/account?tab=address')}>📍 Delivery Addresses</div>
                    </>
                  )}
                  
                  <hr style={{ margin: '6px 0', border: '0', borderTop: '1px solid #e2e8f0' }} />
                  <div className="dropdown-item" style={{ padding: '10px 16px', cursor: 'pointer', color: '#dc2626', fontWeight: 'bold', fontSize: '14px' }} onClick={() => { logout(); handleNavigation('/'); }}>
                    🚪 Logout
                  </div>
                </>
              ) : (
                <div className="dropdown-item" style={{ fontWeight: 'bold', color: '#16a34a', padding: '12px 16px', cursor: 'pointer', fontSize: '14px' }} onClick={() => handleNavigation('/auth')}>
                  🔑 Login / Sign up
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </header>
  );
};

export default Navbar;

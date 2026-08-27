import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navbar = ({
  searchQuery,
  setSearchQuery,
  cartCount = 0,
  setIsCartOpen,
  currentLocation,
  setIsLocationModalOpen,
  wishlistCount = 0,
  setIsWishlistOpen
}) => {
  const { currentUser, logout } = useContext(AuthContext);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();

  return (
    <nav style={{
      background: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      width: '100%',
      maxWidth: '100vw',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        boxSizing: 'border-box'
      }}>
        
        {/* Brand Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{ fontSize: '20px' }}>🌱</span>
          <span style={{ fontSize: '16px', fontWeight: '800', color: '#16a34a', letterSpacing: '-0.5px' }}>
            HealthyBites
          </span>
        </Link>

        {/* Location Selector */}
        <button
          type="button"
          onClick={() => setIsLocationModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '20px',
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: '600',
            color: '#334155',
            cursor: 'pointer',
            maxWidth: '160px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            flexShrink: 1
          }}
          title={currentLocation}
        >
          <span>📍</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentLocation.replace(/📍/g, '').trim()}
          </span>
        </button>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          
          {/* Wishlist Button */}
          <button
            type="button"
            onClick={() => setIsWishlistOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              padding: '4px'
            }}
            title="Open Wishlist"
          >
            <span>💚</span>
            {wishlistCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-6px',
                background: '#16a34a',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 'bold',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {wishlistCount}
              </span>
            )}
          </button>

          {/* Cart Button */}
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: '#ecfdf5',
              border: '1px solid #86efac',
              borderRadius: '20px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: '700',
              color: '#15803d',
              cursor: 'pointer'
            }}
          >
            <span>🛒</span>
            <span>{cartCount}</span>
          </button>

          {/* User Profile */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              👤
            </button>

            {showProfileMenu && (
              <div style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                width: '150px',
                padding: '6px',
                zIndex: 1100
              }}>
                {currentUser ? (
                  <>
                    <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>
                      {currentUser.username || 'User'}
                    </div>
                    <Link to="/account" onClick={() => setShowProfileMenu(false)} style={{ display: 'block', padding: '8px', fontSize: '12px', color: '#334155', textDecoration: 'none' }}>
                      ⚙️ My Account
                    </Link>
                    <button
                      onClick={() => { logout(); setShowProfileMenu(false); navigate('/login'); }}
                      style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '8px', fontSize: '12px', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      🚪 Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setShowProfileMenu(false)} style={{ display: 'block', padding: '8px', fontSize: '12px', color: '#16a34a', fontWeight: 'bold', textDecoration: 'none' }}>
                      🔑 Login
                    </Link>
                    <Link to="/signup" onClick={() => setShowProfileMenu(false)} style={{ display: 'block', padding: '8px', fontSize: '12px', color: '#334155', textDecoration: 'none' }}>
                      📝 Sign Up
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '0 12px 10px 12px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
        <input
          type="text"
          placeholder="🔍 Search dishes, ingredients, kitchens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
            background: '#f8fafc'
          }}
        />
      </div>
    </nav>
  );
};

export default Navbar;

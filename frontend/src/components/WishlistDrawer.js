import React from 'react';

const WishlistDrawer = ({ isOpen, onClose, wishlist = [], toggleWishlist, addToCart }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 2000,
      display: 'flex',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        height: '100%',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 25px rgba(0,0,0,0.15)',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>💚</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              My Wishlist ({wishlist.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              fontWeight: 'bold',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {wishlist.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 10px', color: '#64748b' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>🤍</span>
              <h4 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Your wishlist is empty</h4>
              <p style={{ fontSize: '13px', margin: 0 }}>Save your favorite healthy dishes here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {wishlist.map(item => (
                <div
                  key={item._id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    background: '#ffffff',
                    alignItems: 'center'
                  }}
                >
                  <img
                    src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}
                    alt={item.title}
                    style={{ width: '65px', height: '65px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>
                      {item.title}
                    </h4>
                    <div style={{ fontSize: '12px', color: '#059669', fontWeight: '600', marginBottom: '4px' }}>
                      📍 {item.areaName || item.city || 'Local'}
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#16a34a' }}>
                      ₹{item.price}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    <button
                      onClick={() => toggleWishlist(item)}
                      style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}
                      title="Remove from wishlist"
                    >
                      ❌
                    </button>
                    <button
                      onClick={() => {
                        addToCart(item);
                        onClose();
                      }}
                      style={{
                        background: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      🛒 Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WishlistDrawer;

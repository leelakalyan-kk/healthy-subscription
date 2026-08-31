import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const LocationModal = ({ isOpen, onClose, currentLocation, setCurrentLocation }) => {
  const [customArea, setCustomArea] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [customPin, setCustomPin] = useState('');
  const [foods, setFoods] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    axios.get('/api/food/all')
      .then(res => {
        if (Array.isArray(res.data)) setFoods(res.data);
      })
      .catch(err => console.error('Error fetching hub locations:', err));
  }, [isOpen]);

  const liveKitchenHubs = useMemo(() => {
    const hubMap = new Map();
    foods.forEach(f => {
      const area = (f.areaName || '').trim();
      const city = (f.city || '').trim();
      const pin = (f.pincode || '').trim();

      if (city || area) {
        const key = `${area}_${city}_${pin}`.toLowerCase();
        if (!hubMap.has(key)) {
          const displayName = [area, city].filter(Boolean).join(', ') + (pin ? ` (${pin})` : '');
          hubMap.set(key, {
            name: displayName,
            city: city,
            area: area,
            pin: pin
          });
        }
      }
    });
    return Array.from(hubMap.values());
  }, [foods]);

  if (!isOpen) return null;

  const updateGlobalLocation = (newLoc) => {
    setCurrentLocation(newLoc);
    localStorage.setItem('user_delivery_hub', newLoc);
    window.dispatchEvent(new CustomEvent('location_changed', { detail: newLoc }));
    onClose();
  };

  const handleSelectHub = (hub) => {
    const loc = `📍 ${hub.name}`;
    updateGlobalLocation(loc);
  };

  const handleSaveCustomLocation = (e) => {
    e.preventDefault();
    if (!customArea.trim() || !customCity.trim()) {
      alert('Please fill in Area and City!');
      return;
    }
    const pinStr = customPin.trim() ? ` (${customPin.trim()})` : '';
    const loc = `📍 ${customArea.trim()}, ${customCity.trim()}${pinStr}`;
    updateGlobalLocation(loc);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 2100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        maxWidth: '460px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              📍 Select Delivery Location
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Live filtering kitchens delivering within 10 KM
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              fontWeight: 'bold',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          <form onSubmit={handleSaveCustomLocation} style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '8px' }}>
              Enter Your Delivery Address:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Area / Street"
                value={customArea}
                onChange={e => setCustomArea(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                required
              />
              <input
                type="text"
                placeholder="City"
                value={customCity}
                onChange={e => setCustomCity(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                required
              />
              <input
                type="text"
                maxLength="6"
                placeholder="PIN Code"
                value={customPin}
                onChange={e => setCustomPin(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>
            <button
              type="submit"
              style={{
                width: '100%',
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                padding: '10px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Set Delivery Location
            </button>
          </form>

          {/* Dynamic Active Kitchens from DB */}
          {liveKitchenHubs.length > 0 && (
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '10px' }}>
                🟢 Active Kitchen Hubs Delivering Now ({liveKitchenHubs.length}):
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {liveKitchenHubs.map((hub, idx) => {
                  const isSelected = (currentLocation || '').toLowerCase().includes(hub.area.toLowerCase()) || 
                                     (hub.pin && (currentLocation || '').includes(hub.pin));
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectHub(hub)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid #16a34a' : '1px solid #e2e8f0',
                        background: isSelected ? '#ecfdf5' : '#ffffff',
                        color: isSelected ? '#16a34a' : '#334155',
                        fontSize: '13px',
                        fontWeight: '600',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>📍 {hub.name}</span>
                      {isSelected && <span style={{ fontWeight: 'bold' }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LocationModal;

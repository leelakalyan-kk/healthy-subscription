import React, { useState } from 'react';

const POPULAR_HUBS = [
  { name: 'Bangalore - Ashok Nagar (560002)', city: 'Bangalore', pin: '560002' },
  { name: 'Bangalore - Indiranagar (560038)', city: 'Bangalore', pin: '560038' },
  { name: 'Hyderabad - Jubilee Hills (500033)', city: 'Hyderabad', pin: '500033' },
  { name: 'Hyderabad - Madhapur (500081)', city: 'Hyderabad', pin: '500081' },
  { name: 'Visakhapatnam - Siripuram (530003)', city: 'Visakhapatnam', pin: '530003' },
  { name: 'Visakhapatnam - MVP Colony (530017)', city: 'Visakhapatnam', pin: '530017' },
  { name: 'Vijayawada - Benz Circle (520001)', city: 'Vijayawada', pin: '520001' },
  { name: 'Vijayawada - Patamata (520010)', city: 'Vijayawada', pin: '520010' }
];

const LocationModal = ({ isOpen, onClose, currentLocation, setCurrentLocation }) => {
  const [customArea, setCustomArea] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [customPin, setCustomPin] = useState('');

  if (!isOpen) return null;

  const handleSelectHub = (hubName) => {
    setCurrentLocation(`📍 ${hubName}`);
    onClose();
  };

  const handleSaveCustomLocation = (e) => {
    e.preventDefault();
    if (!customArea.trim() || !customCity.trim() || !customPin.trim()) {
      alert('Please fill in Area, City and 6-digit PIN code!');
      return;
    }
    if (customPin.trim().length !== 6) {
      alert('Please enter a valid 6-digit PIN code!');
      return;
    }
    setCurrentLocation(`📍 ${customArea.trim()}, ${customCity.trim()} (${customPin.trim()})`);
    onClose();
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
              We deliver from cloud kitchens within 10 KM
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
          
          {/* Custom Location Form */}
          <form onSubmit={handleSaveCustomLocation} style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '8px' }}>
              Enter Any Custom Location in India:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Area (e.g. Alwal)"
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
                required
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
              Set Custom Delivery Location
            </button>
          </form>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '10px' }}>
              Popular Delivery Hubs:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {POPULAR_HUBS.map((hub, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectHub(hub.name)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: currentLocation.includes(hub.pin) ? '2px solid #16a34a' : '1px solid #e2e8f0',
                    background: currentLocation.includes(hub.pin) ? '#ecfdf5' : '#ffffff',
                    color: currentLocation.includes(hub.pin) ? '#16a34a' : '#334155',
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
                  {currentLocation.includes(hub.pin) && <span>✓</span>}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LocationModal;

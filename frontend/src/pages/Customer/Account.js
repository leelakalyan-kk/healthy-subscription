import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';

const socket = io();

const ORDER_STEPS = [
  { key: 'Order Placed', label: 'Order Confirmed', icon: '📝' },
  { key: 'Preparing', label: 'Preparing Meal', icon: '🍳' },
  { key: 'Out for Delivery', label: 'On the Way', icon: '🛵' },
  { key: 'Delivered', label: 'Delivered', icon: '✅' }
];

const getStepIndex = (status) => {
  switch (status) {
    case 'Order Placed': return 0;
    case 'Preparing': return 1;
    case 'Out for Delivery': return 2;
    case 'Delivered': return 3;
    case 'Cancelled': return -1;
    default: return 0;
  }
};

const Account = ({ wishlist = [], toggleWishlist, addToCart, currentLocation, setCurrentLocation }) => {
  const { currentUser, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('ordered-items');
  const [orders, setOrders] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [newLabel, setNewLabel] = useState('Home');
  const [newPin, setNewPin] = useState('');
  const [detectedArea, setDetectedArea] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [pinStatus, setPinStatus] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) setActiveTab(tabParam);
  }, [location.search]);

  const loadCustomerData = useCallback(() => {
    if (!currentUser) return;
    const userId = currentUser._id || currentUser.id || currentUser.username;
    
    axios.get(`/api/orders/my-orders/${userId}`)
      .then(res => Array.isArray(res.data) && setOrders(res.data))
      .catch(console.error);

    axios.get(`/api/user/locations/${userId}`)
      .then(res => Array.isArray(res.data) && setSavedAddresses(res.data))
      .catch(console.error);
  }, [currentUser]);

  // ⚡ 0-Second Instant Reactive State Updates
  useEffect(() => {
    loadCustomerData();

    // Instant status change
    const onStatusUpdate = (updatedOrder) => {
      setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
    };

    // Instant new order arrival
    const onNewOrder = (newOrder) => {
      const myId = currentUser?._id || currentUser?.id || currentUser?.username;
      if (newOrder.userId === myId || newOrder.customerName === currentUser?.username) {
        setOrders(prev => [newOrder, ...prev.filter(o => o._id !== newOrder._id)]);
      }
    };

    socket.on('order_status_updated', onStatusUpdate);
    socket.on('new_order_placed', onNewOrder);

    return () => {
      socket.off('order_status_updated', onStatusUpdate);
      socket.off('new_order_placed', onNewOrder);
    };
  }, [currentUser, loadCustomerData]);

  const handlePincodeLookup = async (e) => {
    const pin = e.target.value.replace(/\D/g, '');
    setNewPin(pin);

    if (pin.length === 6) {
      setPinStatus('🔍 Locating Area...');
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();
        if (data && data[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          const areaCity = `${po.Name}, ${po.District}`;
          setDetectedArea(areaCity);
          setPinStatus(`✅ Auto-Detected: ${areaCity}`);
        } else {
          setPinStatus('❌ Invalid PIN code.');
        }
      } catch (err) {
        setPinStatus('⚠️ PIN code lookup error.');
      }
    } else {
      setPinStatus('');
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!newAddress || !newPhone) return alert("Please enter full address and phone!");

    const userId = currentUser?._id || currentUser?.id || currentUser?.username || 'user';
    const fullStreetAddress = `${newAddress}${detectedArea ? `, ${detectedArea}` : ''}${newPin ? ` - ${newPin}` : ''}`;

    try {
      const res = await axios.post('/api/user/location/add', {
        userId,
        location: { labelName: newLabel, address: fullStreetAddress, pin: newPin, phone: newPhone }
      });
      if (res.data?.locations) {
        setSavedAddresses(res.data.locations);
        if (setCurrentLocation) {
          setCurrentLocation(detectedArea ? `${detectedArea} (${newPin})` : (newPin || 'Vijayawada'));
        }
        setNewAddress(''); setNewPin(''); setDetectedArea(''); setNewPhone(''); setPinStatus('');
        alert("🎉 Address Saved!");
      }
    } catch (err) {
      alert("Failed to save address.");
    }
  };

  const handleSetActiveLocation = async (addr) => {
    const userId = currentUser?._id || currentUser?.id || currentUser?.username;
    try {
      const res = await axios.patch(`/api/user/location/set-active/${userId}/${addr._id}`);
      if (res.data?.locations) setSavedAddresses(res.data.locations);
      if (setCurrentLocation && addr.pin) setCurrentLocation(`📍 ${addr.labelName} (${addr.pin})`);
    } catch (err) {
      alert("Failed to switch address.");
    }
  };

  const handleDeleteAddress = async (locationId, label) => {
    if (!window.confirm(`Delete "${label}" address?`)) return;
    const userId = currentUser?._id || currentUser?.id || currentUser?.username;
    try {
      const res = await axios.delete(`/api/user/location/${userId}/${locationId}`);
      if (res.data?.locations) setSavedAddresses(res.data.locations);
    } catch (err) {
      alert("Failed to delete address.");
    }
  };

  const navItems = [
    { id: 'ordered-items', label: '📦 Ordered items & Tracking' },
    { id: 'address', label: '📍 Delivery Addresses' },
    { id: 'wishlist', label: '💚 Wish list' },
    { id: 'payment-options', label: '💳 Payment options' },
    { id: 'wallet', label: '💰 Wallet' },
  ];

  return (
    <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px' }}>
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#ecfdf5', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>👤</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px' }}>{currentUser?.username || 'Customer'}</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>Active Hub: <strong style={{ color: '#16a34a' }}>📍 {currentLocation}</strong></p>
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/'); }} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '8px 18px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>🚪 Logout</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '12px', height: 'fit-content' }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); navigate(`/account?tab=${item.id}`); }}
              style={{
                width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: '10px', border: 'none',
                background: activeTab === item.id ? '#ecfdf5' : 'transparent',
                color: activeTab === item.id ? '#16a34a' : '#475569',
                fontWeight: activeTab === item.id ? '700' : '500', cursor: 'pointer', marginBottom: '4px'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          {activeTab === 'ordered-items' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '20px' }}>📦 Live Orders & Instant Tracking</h3>
                <span style={{ fontSize: '12px', background: '#ecfdf5', color: '#16a34a', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold', border: '1px solid #86efac' }}>⚡ 0s Instant Sync</span>
              </div>

              {orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                  <span style={{ fontSize: '48px' }}>🍲</span>
                  <p>No orders placed yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {orders.map(order => {
                    const activeIndex = getStepIndex(order.orderStatus);
                    return (
                      <div key={order._id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <strong style={{ fontSize: '16px' }}>Order #{order._id.substring(18)}</strong>
                            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '12px' }}>Kitchen: <strong>{order.sellerName}</strong></p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '16px', fontWeight: '800', color: '#16a34a' }}>₹{order.totalAmount}</span>
                          </div>
                        </div>

                        <div style={{ margin: '20px 0', padding: '16px 12px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '16px', left: '5%', right: '5%', height: '4px', background: '#e2e8f0', zIndex: 1 }}>
                              <div style={{ height: '100%', background: '#16a34a', width: `${(activeIndex / (ORDER_STEPS.length - 1)) * 100}%`, transition: 'width 0.3s ease' }} />
                            </div>
                            {ORDER_STEPS.map((step, idx) => (
                              <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, flex: 1 }}>
                                <div style={{
                                  width: '34px', height: '34px', borderRadius: '50%',
                                  background: idx <= activeIndex ? '#16a34a' : '#f1f5f9',
                                  color: idx <= activeIndex ? '#ffffff' : '#94a3b8',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
                                }}>
                                  {step.icon}
                                </div>
                                <span style={{ marginTop: '8px', fontSize: '11px', fontWeight: idx === activeIndex ? '800' : '600', color: idx === activeIndex ? '#16a34a' : '#475569' }}>
                                  {step.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <div><strong>Items: </strong> {order.items?.map(i => `${i.title} (x${i.qty})`).join(', ')}</div>
                          <div><strong>Drop: </strong> {order.deliveryAddress}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'address' && (
            <div>
              <h3 style={{ margin: '0 0 20px 0' }}>📍 Delivery Addresses Management</h3>
              <form onSubmit={handleAddAddress} style={{ background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="text" placeholder="Tag (e.g. Home)" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="form-input" required />
                  <input type="text" placeholder="Phone Number" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="form-input" required />
                </div>
                <input type="text" maxLength="6" placeholder="6-Digit PIN Code" value={newPin} onChange={handlePincodeLookup} className="form-input" />
                {pinStatus && <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>{pinStatus}</p>}
                <input type="text" placeholder="House / Street / Landmark" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="form-input" required />
                <button type="submit" className="btn-green" style={{ width: 'fit-content', padding: '8px 22px' }}>Save Address</button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {savedAddresses.map(addr => (
                  <div key={addr._id} style={{ background: addr.isDefault ? '#ecfdf5' : '#ffffff', border: addr.isDefault ? '2px solid #16a34a' : '1px solid #e2e8f0', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>🏠 {addr.labelName} {addr.isDefault && <span style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>ACTIVE</span>}</strong>
                      <p style={{ margin: '4px 0', fontSize: '13px', color: '#475569' }}>{addr.address}</p>
                      <span style={{ fontSize: '12px', color: '#16a34a' }}>📞 {addr.phone}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!addr.isDefault && (
                        <button type="button" onClick={() => handleSetActiveLocation(addr)} style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>Set Active</button>
                      )}
                      <button type="button" onClick={() => handleDeleteAddress(addr._id, addr.labelName)} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'wishlist' && <div><h3>💚 Wishlist ({wishlist.length})</h3></div>}
          {activeTab === 'payment-options' && <div><h3>💳 Payment Options (Sandbox Active)</h3></div>}
          {activeTab === 'wallet' && <div><h3>💰 Wallet Balance: ₹{currentUser?.walletBalance || 250}</h3></div>}
        </div>
      </div>
    </div>
  );
};

export default Account;

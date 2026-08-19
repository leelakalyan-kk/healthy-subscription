import React, { useState, useEffect, useContext, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';

import { AuthProvider, AuthContext } from './context/AuthContext';
import Navbar from './components/Navbar';
import CustomerHome from './pages/Customer/CustomerHome';
import Account from './pages/Customer/Account';
import Auth from './pages/Auth/Auth';
import SellerHome from './pages/Seller/SellerHome';

import './App.css';

const socket = io();

export const getCoordinatesForLocation = (locationStr, pinStr) => {
  const pin = String(pinStr || locationStr || '');
  const loc = String(locationStr || '').toLowerCase();

  if (pin.startsWith('500') || loc.includes('hyderabad') || loc.includes('alwal') || loc.includes('madhapur')) {
    return { lat: 17.4483, lng: 78.3915 };
  }
  return { lat: 16.5062, lng: 80.6480 };
};

export const cleanLocationDisplay = async (rawString) => {
  if (!rawString) return 'Vijayawada';
  const pinMatch = String(rawString).match(/\b\d{6}\b/);
  if (pinMatch) {
    const pin = pinMatch[0];
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data && data[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
        return `${data[0].PostOffice[0].Name}, ${data[0].PostOffice[0].District} (${pin})`;
      }
    } catch (e) {}
    return `PIN ${pin}`;
  }
  return rawString.split(',')[0].trim();
};

function MainLayout() {
  const { currentUser } = useContext(AuthContext);
  const [foods, setFoods] = useState([]);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocation, setCurrentLocation] = useState('Vijayawada');
  const [customerCoords, setCustomerCoords] = useState({ lat: 16.5062, lng: 80.6480 });
  const [showCart, setShowCart] = useState(false);
  const [activeAddressObj, setActiveAddressObj] = useState(null);

  // Sandbox Modal
  const [showSandboxModal, setShowSandboxModal] = useState(false);
  const [selectedPaymentTab, setSelectedPaymentTab] = useState('UPI');
  const [simulatedUpiId, setSimulatedUpiId] = useState('user@okaxis');
  const [isProcessingSandbox, setIsProcessingSandbox] = useState(false);

  const navigate = useNavigate();

  // 🔄 Dedicated Fetch Food Function
  const loadFoods = useCallback(() => {
    axios.get('/api/food')
      .then(res => {
        if (Array.isArray(res.data)) {
          setFoods(res.data);
        }
      })
      .catch(console.error);
  }, []);

  // ⚡ Auto-Refresh Food Feed Every 3 Seconds & on Socket Events
  useEffect(() => {
    loadFoods();

    const handleFoodAdded = (newFood) => {
      setFoods(prev => [newFood, ...prev.filter(f => f._id !== newFood._id)]);
    };

    const handleFoodDeleted = (id) => {
      setFoods(prev => prev.filter(f => f._id !== id));
    };

    socket.on('food_added', handleFoodAdded);
    socket.on('food_deleted', handleFoodDeleted);

    const foodPoll = setInterval(loadFoods, 3000);

    return () => {
      socket.off('food_added', handleFoodAdded);
      socket.off('food_deleted', handleFoodDeleted);
      clearInterval(foodPoll);
    };
  }, [loadFoods]);

  // Load Active User Address & Sync
  const loadUserAddress = useCallback(() => {
    if (currentUser) {
      const uid = currentUser._id || currentUser.id || currentUser.username;
      axios.get(`/api/user/locations/${uid}`).then(async (res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const activeLoc = res.data.find(l => l.isDefault) || res.data[0];
          setActiveAddressObj(activeLoc);
          const cleanLoc = await cleanLocationDisplay(activeLoc.pin || activeLoc.address);
          setCurrentLocation(cleanLoc);
          setCustomerCoords(getCoordinatesForLocation(activeLoc.address, activeLoc.pin));
        }
      }).catch(console.error);
    }
  }, [currentUser]);

  useEffect(() => {
    loadUserAddress();
  }, [currentUser, loadUserAddress]);

  const addToCart = (food) => {
    const existing = cart.find(i => i._id === food._id);
    setCart(existing ? cart.map(i => i._id === food._id ? { ...i, qty: i.qty + 1 } : i) : [...cart, { ...food, qty: 1 }]);
  };

  const updateQuantity = (id, delta) => {
    setCart(cart.map(i => i._id === id ? (i.qty + delta > 0 ? { ...i, qty: i.qty + delta } : null) : i).filter(Boolean));
  };

  const toggleWishlist = (food) => {
    setWishlist(wishlist.some(i => i._id === food._id) ? wishlist.filter(i => i._id !== food._id) : [...wishlist, food]);
  };

  const getCartTotal = () => cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const openSandboxCheckout = () => {
    if (!currentUser) {
      alert("Please login first to place an order!");
      setShowCart(false);
      navigate('/auth');
      return;
    }
    if (!activeAddressObj) {
      alert("Please add/select a delivery address in your Account first!");
      setShowCart(false);
      navigate('/account?tab=address');
      return;
    }
    setShowCart(false);
    setShowSandboxModal(true);
  };

  const handleExecuteSandboxPay = async () => {
    setIsProcessingSandbox(true);
    try {
      const payload = {
        userId: currentUser._id || currentUser.id || currentUser.username,
        customerName: currentUser.username,
        items: cart,
        totalAmount: getCartTotal(),
        deliveryAddress: `${activeAddressObj.address} (Ph: ${activeAddressObj.phone || currentUser.phone || ''})`,
        deliveryPincode: activeAddressObj.pin || '',
        paymentType: selectedPaymentTab === 'UPI' ? `UPI: ${simulatedUpiId}` : selectedPaymentTab === 'CARD' ? 'Test Card ending 4242' : 'Cash on Delivery'
      };

      const res = await axios.post('/api/payment/sandbox-pay', payload);
      if (res.data?.success) {
        alert(`🎉 Order Placed! Txn ID: ${res.data.txnId}`);
        setCart([]);
        setShowSandboxModal(false);
        navigate('/account?tab=ordered-items');
      }
    } catch (err) {
      alert("Payment failed.");
    } finally {
      setIsProcessingSandbox(false);
    }
  };

  const isSeller = currentUser && currentUser.role === 'seller';

  return (
    <div className="app-container">
      <Navbar
        cartCount={cart.reduce((a, b) => a + b.qty, 0)}
        toggleCart={() => setShowCart(!showCart)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentLocation={currentLocation}
      />

      {/* Cart Drawer */}
      {showCart && (
        <div className="drawer-overlay" onClick={() => setShowCart(false)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Your cart</h3>
              <button className="close-btn" onClick={() => setShowCart(false)}>✕</button>
            </div>

            {cart.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
                <span style={{ fontSize: '48px' }}>🛒</span>
                <p style={{ marginTop: '10px' }}>Your cart is empty</p>
              </div>
            ) : (
              <div style={{ padding: '20px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {cart.map(item => (
                    <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                      <div>
                        <h4 style={{ margin: 0 }}>{item.title}</h4>
                        <p style={{ margin: '2px 0', color: '#64748b', fontSize: '12px' }}>Kitchen: {item.sellerName || 'Verified'}</p>
                        <p style={{ margin: '4px 0', color: '#16a34a', fontWeight: 'bold' }}>₹{item.price} x {item.qty}</p>
                      </div>
                      <div className="qty-controls">
                        <button onClick={() => updateQuantity(item._id, -1)}>-</button>
                        <span>{item.qty}</span>
                        <button onClick={() => updateQuantity(item._id, 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '15px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#15803d' }}>📍 Deliver to:</span>
                      <button 
                        type="button" 
                        onClick={() => { setShowCart(false); navigate('/account?tab=address'); }}
                        style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Change
                      </button>
                    </div>
                    {activeAddressObj ? (
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>🏠 {activeAddressObj.labelName}:</strong>
                        <p style={{ margin: '2px 0', fontSize: '12px', color: '#475569' }}>{activeAddressObj.address}</p>
                      </div>
                    ) : (
                      <p style={{ margin: '2px 0', fontSize: '12px', color: '#dc2626' }}>No address selected.</p>
                    )}
                  </div>

                  <h3 style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 10px 0' }}>
                    <span>Total Bill:</span>
                    <span style={{ color: '#16a34a' }}>₹{getCartTotal()}</span>
                  </h3>

                  <button 
                    className="btn-green" 
                    style={{ width: '100%', padding: '12px 0', fontSize: '15px' }} 
                    onClick={openSandboxCheckout}
                  >
                    🧪 Proceed to Sandbox Pay • ₹{getCartTotal()}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sandbox Modal */}
      {showSandboxModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', width: '90%', maxWidth: '460px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            
            <div style={{ background: '#0f172a', color: '#ffffff', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ background: '#3b82f6', color: '#ffffff', fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>Sandbox Test Gateway</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '18px' }}>HealthySubscription Pay 💳</h3>
              </div>
              <button onClick={() => setShowSandboxModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <div style={{ background: '#ecfdf5', borderBottom: '1px solid #86efac', padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 'bold' }}>Total Test Amount:</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#475569' }}>Simulated Test Mode • No Real Charges</p>
              </div>
              <strong style={{ fontSize: '24px', color: '#15803d' }}>₹{getCartTotal()}</strong>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              {['UPI', 'CARD', 'COD'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSelectedPaymentTab(tab)}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    border: 'none',
                    background: selectedPaymentTab === tab ? '#ffffff' : 'transparent',
                    borderBottom: selectedPaymentTab === tab ? '3px solid #16a34a' : 'none',
                    color: selectedPaymentTab === tab ? '#16a34a' : '#64748b',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {tab === 'UPI' ? '📱 UPI' : tab === 'CARD' ? '💳 Card' : '💵 Cash'}
                </button>
              ))}
            </div>

            <div style={{ padding: '22px' }}>
              {selectedPaymentTab === 'UPI' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Simulated Virtual Payment Address (VPA):</label>
                  <input
                    type="text"
                    value={simulatedUpiId}
                    onChange={(e) => setSimulatedUpiId(e.target.value)}
                    className="form-input"
                    placeholder="username@okhdfcbank"
                  />
                </div>
              )}

              {selectedPaymentTab === 'CARD' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Test Card Number</label>
                  <input type="text" className="form-input" value="4242 •••• •••• 4242 (VISA Test Card)" readOnly />
                </div>
              )}

              {selectedPaymentTab === 'COD' && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '32px' }}>💵</span>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#334155', fontWeight: '600' }}>Pay directly in cash upon meal delivery.</p>
                </div>
              )}

              <button
                type="button"
                className="btn-green"
                disabled={isProcessingSandbox}
                onClick={handleExecuteSandboxPay}
                style={{ width: '100%', padding: '13px 0', fontSize: '15px', marginTop: '18px' }}
              >
                {isProcessingSandbox ? 'Processing...' : `✅ Complete Test Payment (₹${getCartTotal()})`}
              </button>
            </div>

          </div>
        </div>
      )}

      <main className="main-content">
        <Routes>
          <Route path="/" element={
            isSeller ? <SellerHome /> : (
              <CustomerHome
                foods={foods}
                searchQuery={searchQuery}
                cart={cart}
                addToCart={addToCart}
                updateQuantity={updateQuantity}
                wishlist={wishlist}
                toggleWishlist={toggleWishlist}
                currentLocation={currentLocation}
                customerCoords={customerCoords}
              />
            )
          } />
          <Route path="/auth" element={<Auth />} />
          <Route path="/account" element={<Account wishlist={wishlist} toggleWishlist={toggleWishlist} addToCart={addToCart} currentLocation={currentLocation} setCurrentLocation={setCurrentLocation} />} />
          <Route path="/seller" element={<SellerHome />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <MainLayout />
      </Router>
    </AuthProvider>
  );
}

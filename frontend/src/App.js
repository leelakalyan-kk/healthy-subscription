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

const socket = io('/', { transports: ['websocket', 'polling'] });

function MainLayout() {
  const { currentUser } = useContext(AuthContext);
  const [foods, setFoods] = useState([]);
  const [cart, setCart] = useState(() => {
    try {
      const localCart = localStorage.getItem('hs_cart');
      return localCart ? JSON.parse(localCart) : [];
    } catch (e) {
      return [];
    }
  });
  const [wishlist, setWishlist] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocation, setCurrentLocation] = useState('Chittinagar, Krishna (520001)');
  const [customerCoords, setCustomerCoords] = useState({ lat: 16.5215, lng: 80.6120 });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const navigate = useNavigate();

  // Save cart in localStorage to retain on refresh
  useEffect(() => {
    localStorage.setItem('hs_cart', JSON.stringify(cart));
  }, [cart]);

  // Initial Database Fetch on Mount / Refresh
  const fetchFoodsFromDB = useCallback(async () => {
    try {
      const res = await axios.get('/api/food');
      if (Array.isArray(res.data)) {
        const seen = new Set();
        const unique = res.data.filter(item => {
          const id = String(item._id || item.id);
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        setFoods(unique);
      }
    } catch (err) {
      console.error("Error fetching foods from DB:", err);
    }
  }, []);

  useEffect(() => {
    fetchFoodsFromDB();

    const handleFoodAdded = (newFood) => {
      setFoods(prev => {
        const exists = prev.some(f => String(f._id || f.id) === String(newFood._id || newFood.id));
        if (exists) {
          return prev.map(f => String(f._id || f.id) === String(newFood._id || newFood.id) ? newFood : f);
        }
        return [newFood, ...prev];
      });
    };

    const handleFoodDeleted = (deletedId) => {
      setFoods(prev => prev.filter(f => String(f._id || f.id) !== String(deletedId)));
    };

    socket.on('food_added', handleFoodAdded);
    socket.on('food_deleted', handleFoodDeleted);

    return () => {
      socket.off('food_added', handleFoodAdded);
      socket.off('food_deleted', handleFoodDeleted);
    };
  }, [fetchFoodsFromDB]);

  const addToCart = (food) => {
    setCart(prev => {
      const existing = prev.find(item => item._id === food._id);
      if (existing) {
        return prev.map(item => item._id === food._id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...food, qty: 1 }];
    });
  };

  const updateQuantity = (foodId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item._id === foodId) {
          const newQty = item.qty + delta;
          return newQty > 0 ? { ...item, qty: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const toggleWishlist = (food) => {
    setWishlist(prev => {
      const exists = prev.some(item => item._id === food._id);
      if (exists) return prev.filter(item => item._id !== food._id);
      return [...prev, food];
    });
  };

  // Instant Sandbox Order Checkout
  const handleSandboxCheckout = async () => {
    if (!currentUser) {
      alert("Please login first to complete your order!");
      setIsCartOpen(false);
      navigate('/auth');
      return;
    }

    if (cart.length === 0) return;

    setIsCheckingOut(true);
    const totalAmount = cart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);

    try {
      const res = await axios.post('/api/payment/sandbox-pay', {
        userId: currentUser._id || currentUser.id || currentUser.username,
        customerName: currentUser.username || 'Customer',
        items: cart,
        totalAmount,
        deliveryAddress: currentLocation,
        paymentType: 'Sandbox Instant Pay'
      });

      if (res.data.success) {
        alert("🎉 Order placed successfully via Sandbox!");
        setCart([]);
        setIsCartOpen(false);
        navigate('/account?tab=ordered-items');
      }
    } catch (err) {
      alert("Order placement failed. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const totalCartPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div className="App">
      <Navbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        cartCount={cart.reduce((acc, curr) => acc + curr.qty, 0)}
        toggleCart={() => setIsCartOpen(!isCartOpen)}
        currentLocation={currentLocation}
      />

      {/* Slide-in Cart Drawer */}
      {isCartOpen && (
        <div className="drawer-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>🛒 Your Meal Cart ({cart.length})</h3>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '60px', color: '#64748b' }}>
                <span style={{ fontSize: '40px' }}>🍲</span>
                <p>Your meal cart is empty.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', gap: '14px' }}>
                {cart.map(item => (
                  <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.title}</strong>
                      <div style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '13px' }}>₹{item.price * item.qty}</div>
                    </div>
                    <div className="qty-controls">
                      <button onClick={() => updateQuantity(item._id, -1)}>-</button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateQuantity(item._id, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '18px', fontWeight: '800' }}>
                  <span>Total Amount:</span>
                  <span style={{ color: '#16a34a' }}>₹{totalCartPrice}</span>
                </div>
                <button
                  onClick={handleSandboxCheckout}
                  disabled={isCheckingOut}
                  className="btn-green"
                  style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: 'bold' }}
                >
                  {isCheckingOut ? 'Processing Order...' : '⚡ Pay via Sandbox & Order'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={
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
          }
        />
        <Route path="/seller" element={<SellerHome />} />
        <Route
          path="/account"
          element={
            <Account
              wishlist={wishlist}
              toggleWishlist={toggleWishlist}
              addToCart={addToCart}
              currentLocation={currentLocation}
              setCurrentLocation={setCurrentLocation}
            />
          }
        />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <MainLayout />
      </Router>
    </AuthProvider>
  );
}

export default App;

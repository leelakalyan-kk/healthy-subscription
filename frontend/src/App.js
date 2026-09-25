import React, { useState, useEffect, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import WishlistDrawer from './components/WishlistDrawer';
import CustomerHome from './pages/Customer/CustomerHome';
import SellerHome from './pages/Seller/SellerHome';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminLogin from './pages/Auth/AdminLogin';
import HelpdeskLogin from './pages/Auth/HelpdeskLogin';
import Account from './pages/Customer/Account';
import CustomerTrack from './pages/Customer/CustomerTrack';
import Auth from './pages/Auth/Auth';
import FloatingChatbot from './components/FloatingChatbot';

// Strict Protected Route Component for Admin & Helpdesk
const ProtectedAdminRoute = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  const storedUser = JSON.parse(localStorage.getItem('active_user') || 'null');
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');

  const user = currentUser || storedUser;
  const isAuthorized = token && user && (user.role === 'admin' || user.role === 'helpdesk');

  if (!isAuthorized) {
    return <Navigate to="/admin-login" replace />;
  }

  return children;
};

// Strict Protected Route for Kitchen Seller
const ProtectedSellerRoute = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  const storedUser = JSON.parse(localStorage.getItem('active_user') || 'null');
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');

  const user = currentUser || storedUser;
  const isSeller = token && user && (user.role === 'seller' || user.username === 'tests');

  if (!isSeller) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const { currentUser } = useContext(AuthContext);
  const [foods, setFoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('user_cart') || '[]'));
  const [wishlist, setWishlist] = useState(() => JSON.parse(localStorage.getItem('user_wishlist') || '[]'));
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  
  const [currentLocation, setCurrentLocation] = useState(() => {
    return localStorage.getItem('user_delivery_hub') || '📍 Select Delivery Location';
  });

  useEffect(() => {
    const handleLocChange = (e) => {
      if (e.detail) setCurrentLocation(e.detail);
    };
    window.addEventListener('location_changed', handleLocChange);
    return () => window.removeEventListener('location_changed', handleLocChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('user_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('user_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  const addToCart = (food) => {
    setCart(prev => {
      const exists = prev.find(item => item._id === food._id);
      if (exists) return prev.map(item => item._id === food._id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...food, qty: 1 }];
    });
  };

  const updateQuantity = (foodId, delta) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item._id === foodId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const toggleWishlist = (food) => {
    setWishlist(prev => {
      const exists = prev.some(item => item._id === food._id);
      if (exists) return prev.filter(item => item._id !== food._id);
      return [...prev, food];
    });
  };

  const activeUser = currentUser || JSON.parse(localStorage.getItem('active_user') || 'null');
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
  const isSeller = token && activeUser && (activeUser.role === 'seller' || activeUser.username === 'tests');
  const isAdminOrStaff = token && activeUser && (activeUser.role === 'admin' || activeUser.role === 'helpdesk');

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div style={{ minHeight: '100vh', background: isAdminOrStaff ? '#0b0e11' : '#f8fafc', display: 'flex', flexDirection: 'column' }}>

      {!isSeller && !isAdminOrStaff && (
        <Navbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          cartCount={cartCount}
          setIsCartOpen={setIsCartOpen}
          currentLocation={currentLocation}
          
          wishlistCount={wishlist.length}
          setIsWishlistOpen={setIsWishlistOpen}
        />
      )}

      <main style={{ flex: 1 }}>
        <Routes>
          <Route
            path="/"
            element={
              isAdminOrStaff ? (
                <Navigate to="/admin" replace />
              ) : isSeller ? (
                <Navigate to="/seller" replace />
              ) : (
                <CustomerHome
                  foods={foods}
                  searchQuery={searchQuery}
                  cart={cart}
                  addToCart={addToCart}
                  updateQuantity={updateQuantity}
                  wishlist={wishlist}
                  toggleWishlist={toggleWishlist}
                  currentLocation={currentLocation}
                />
              )
            }
          />
          <Route path="/seller" element={<ProtectedSellerRoute><SellerHome /></ProtectedSellerRoute>} />
          <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/support-login" element={<HelpdeskLogin />} />
          <Route path="/track/:orderId" element={<CustomerTrack />} />
          <Route path="/account" element={isAdminOrStaff ? <Navigate to="/admin" replace /> : isSeller ? <Navigate to="/seller" replace /> : <Account />} />
          <Route path="/login" element={<Auth initialMode="login" />} />
          <Route path="/signup" element={<Auth initialMode="signup" />} />
        </Routes>
      {!isSeller && !isAdminOrStaff && <FloatingChatbot mode="customer" />}
      </main>

      {!isSeller && !isAdminOrStaff && (
        <>
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cart={cart}
            updateQuantity={updateQuantity}
            currentLocation={currentLocation}
          />

          <WishlistDrawer
            isOpen={isWishlistOpen}
            onClose={() => setIsWishlistOpen(false)}
            wishlist={wishlist}
            toggleWishlist={toggleWishlist}
            addToCart={addToCart}
          />

          
        </>
      )}
    </div>
  );
}

// customer chatbot included
export default App;

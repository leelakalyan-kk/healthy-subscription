import React, { useState, useEffect, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import WishlistDrawer from './components/WishlistDrawer';
import LocationModal from './components/LocationModal';
import CustomerHome from './pages/Customer/CustomerHome';
import SellerHome from './pages/Seller/SellerHome';
import Account from './pages/Customer/Account';
import Auth from './pages/Auth/Auth';

function App() {
  const { currentUser } = useContext(AuthContext);
  const [foods, setFoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('user_cart') || '[]'));
  const [wishlist, setWishlist] = useState(() => JSON.parse(localStorage.getItem('user_wishlist') || '[]'));
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(() => localStorage.getItem('user_delivery_hub') || '📍 Home: Ashok Nagar, Bangalore (560002)');

  useEffect(() => {
    localStorage.setItem('user_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('user_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('user_delivery_hub', currentLocation);
  }, [currentLocation]);

  const addToCart = (food) => {
    setCart(prev => {
      const exists = prev.find(item => item._id === food._id);
      if (exists) {
        return prev.map(item => item._id === food._id ? { ...item, qty: item.qty + 1 } : item);
      }
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
      if (exists) {
        return prev.filter(item => item._id !== food._id);
      }
      return [...prev, food];
    });
  };

  const isSeller = currentUser?.role === 'seller' || currentUser?.username === 'tests';
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      
      {/* Hide Customer Navbar for Kitchen Partners */}
      {!isSeller && (
        <Navbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          cartCount={cartCount}
          setIsCartOpen={setIsCartOpen}
          currentLocation={currentLocation}
          setIsLocationModalOpen={setIsLocationModalOpen}
          wishlistCount={wishlist.length}
          setIsWishlistOpen={setIsWishlistOpen}
        />
      )}

      <main style={{ flex: 1 }}>
        <Routes>
          <Route
            path="/"
            element={
              isSeller ? (
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
          <Route path="/seller" element={<SellerHome />} />
          <Route path="/account" element={isSeller ? <Navigate to="/seller" replace /> : <Account />} />
          <Route path="/login" element={<Auth initialMode="login" />} />
          <Route path="/signup" element={<Auth initialMode="signup" />} />
        </Routes>
      </main>

      {!isSeller && (
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

          <LocationModal
            isOpen={isLocationModalOpen}
            onClose={() => setIsLocationModalOpen(false)}
            currentLocation={currentLocation}
            setCurrentLocation={setCurrentLocation}
          />
        </>
      )}
    </div>
  );
}

export default App;

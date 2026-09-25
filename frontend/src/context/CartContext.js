import React, { createContext, useState, useEffect } from 'react';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('active_cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('active_cart_items', JSON.stringify(cartItems));
      localStorage.setItem('cart', JSON.stringify(cartItems));
      localStorage.setItem('cart_items', JSON.stringify(cartItems));
    } catch (e) {}
  }, [cartItems]);

  const addToCart = (food) => {
    if (!food) return;
    setCartItems(prev => {
      const current = Array.isArray(prev) ? prev : [];
      const id = food._id || food.id;
      const existing = current.find(item => (item._id || item.id) === id);
      if (existing) {
        return current.map(item =>
          (item._id || item.id) === id ? { ...item, qty: (item.qty || 1) + 1 } : item
        );
      }
      return [...current, { ...food, qty: 1 }];
    });
  };

  const updateQuantity = (id, newQty) => {
    setCartItems(prev => {
      const current = Array.isArray(prev) ? prev : [];
      if (newQty <= 0) {
        return current.filter(item => (item._id || item.id) !== id);
      }
      return current.map(item => (item._id || item.id) === id ? { ...item, qty: newQty } : item);
    });
  };

  const removeFromCart = (id) => {
    setCartItems(prev => (Array.isArray(prev) ? prev.filter(item => (item._id || item.id) !== id) : []));
  };

  const clearCart = () => {
    setCartItems([]);
    try {
      localStorage.removeItem('active_cart_items');
      localStorage.removeItem('cart');
      localStorage.removeItem('cart_items');
    } catch (e) {}
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, updateQuantity, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

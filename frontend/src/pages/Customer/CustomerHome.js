import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { getCoordsFromLocation, calculateDistanceKm } from '../../utils/geoMapper';

const socket = io('/', { transports: ['websocket', 'polling'] });

const CustomerHome = ({
  searchQuery = '',
  cart = [],
  addToCart,
  updateQuantity,
  wishlist = [],
  toggleWishlist,
  currentLocation = '📍 Home: Ashok Nagar, Bangalore (560002)'
}) => {
  const [foods, setFoods] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFoods = async () => {
      try {
        const res = await axios.get('/api/food/all');
        if (Array.isArray(res.data)) {
          setFoods(res.data);
        }
      } catch (err) {
        console.error('Error fetching foods:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFoods();

    socket.on('food_added', (newFood) => {
      setFoods((prev) => [newFood, ...prev.filter((f) => f._id !== newFood._id)]);
    });

    socket.on('food_deleted', (deletedId) => {
      setFoods((prev) => prev.filter((f) => f._id !== deletedId));
    });

    return () => {
      socket.off('food_added');
      socket.off('food_deleted');
    };
  }, []);

  // User delivery coordinates
  const userCoords = useMemo(() => {
    return getCoordsFromLocation(currentLocation);
  }, [currentLocation]);

  // Strict 10 KM Filter
  const nearbyFoods = useMemo(() => {
    return foods
      .map((food) => {
        const foodCoords = (food.lat && food.lng)
          ? { lat: food.lat, lng: food.lng }
          : getCoordsFromLocation(`${food.areaName || ''} ${food.city || ''}`, food.pincode);

        const dist = calculateDistanceKm(
          userCoords.lat,
          userCoords.lng,
          foodCoords.lat,
          foodCoords.lng
        );

        const eta = Math.max(15, Math.round(dist * 4 + 10));

        return {
          ...food,
          distanceKm: dist,
          etaMins: eta
        };
      })
      .filter((food) => food.distanceKm <= 10);
  }, [foods, userCoords]);

  // Filter by category and search
  const filteredFoods = useMemo(() => {
    return nearbyFoods.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        (item.protein && item.protein.toLowerCase().includes(selectedCategory.toLowerCase()));

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.sellerName?.toLowerCase().includes(query) ||
        item.areaName?.toLowerCase().includes(query) ||
        item.city?.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [nearbyFoods, selectedCategory, searchQuery]);

  const categories = ['All', 'High Protein', 'Salad', 'Keto', 'Bowl'];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 14px', boxSizing: 'border-box' }}>
      
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
        color: '#ffffff',
        padding: '24px 20px',
        borderRadius: '16px',
        marginBottom: '20px',
        boxShadow: '0 4px 15px rgba(22, 163, 74, 0.2)'
      }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '800' }}>
          Fresh & Healthy Meal Plans 🌱
        </h1>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#dcfce7' }}>
          Hot meals prepared fresh and delivered directly from partner cloud kitchens within 10 KM.
        </p>
        <div style={{
          background: 'rgba(0,0,0,0.18)',
          display: 'inline-block',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          Active Delivery Hub: {currentLocation}
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: selectedCategory === cat ? '2px solid #16a34a' : '1px solid #cbd5e1',
              background: selectedCategory === cat ? '#16a34a' : '#ffffff',
              color: selectedCategory === cat ? '#ffffff' : '#334155',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {cat === 'All' ? '🍽️ All Meals' : cat}
          </button>
        ))}
      </div>

      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
          🥗 Kitchens Delivering to You ({filteredFoods.length})
        </h3>
        <span style={{
          background: '#ecfdf5',
          color: '#16a34a',
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '800',
          border: '1px solid #86efac'
        }}>
          ⚡ Fine-Tuned (≤ 10 KM)
        </span>
      </div>

      {/* Food Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <span>🔄 Loading healthy meals near you...</span>
        </div>
      ) : filteredFoods.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px dashed #cbd5e1',
          color: '#64748b'
        }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '10px' }}>🍲</span>
          <h4 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '16px' }}>No kitchens found within 10 KM</h4>
          <p style={{ margin: 0, fontSize: '13px' }}>
            Current delivery hub ki 10 KM radius lo partner kitchens levu.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '18px'
        }}>
          {filteredFoods.map((item) => {
            const inCart = cart.find((c) => c._id === item._id);
            const isWish = wishlist.some((w) => w._id === item._id);

            return (
              <div
                key={item._id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}
              >
                {/* Distance & ETA Badge */}
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  color: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  backdropFilter: 'blur(4px)'
                }}>
                  📍 {item.distanceKm} km • ⏱️ {item.etaMins} mins
                </div>

                {/* Wishlist Button */}
                <button
                  type="button"
                  onClick={() => toggleWishlist(item)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    fontSize: '14px'
                  }}
                >
                  {isWish ? '💚' : '🤍'}
                </button>

                {/* Food Image */}
                <img
                  src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}
                  alt={item.title}
                  style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                />

                {/* Body */}
                <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: '800' }}>
                        {item.title}
                      </h4>
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                      👨‍🍳 {item.sellerName || 'Partner Kitchen'} • 📍 {item.areaName || ''}, {item.city || ''} ({item.pincode || ''})
                    </div>

                    <p style={{ margin: '0 0 10px 0', color: '#475569', fontSize: '12px', lineHeight: '1.4' }}>
                      {item.description}
                    </p>
                  </div>

                  {/* Price & Add */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                      ₹{item.price}
                    </span>

                    {inCart ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#ecfdf5',
                        border: '1px solid #86efac',
                        borderRadius: '6px'
                      }}>
                        <button
                          onClick={() => updateQuantity(item._id, -1)}
                          style={{ background: 'transparent', border: 'none', padding: '4px 10px', color: '#15803d', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          -
                        </button>
                        <span style={{ padding: '0 4px', fontWeight: '800', color: '#15803d', fontSize: '12px' }}>
                          {inCart.qty}
                        </span>
                        <button
                          onClick={() => updateQuantity(item._id, 1)}
                          style={{ background: 'transparent', border: 'none', padding: '4px 10px', color: '#15803d', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        style={{
                          background: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        🛒 Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default CustomerHome;

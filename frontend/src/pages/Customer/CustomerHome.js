import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 2.5;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return parseFloat(distance.toFixed(1));
};

const getKitchenCoords = (item) => {
  if (item.lat && item.lng && item.lat !== 16.5062) {
    return { lat: item.lat, lng: item.lng };
  }
  const city = (item.city || '').toLowerCase();
  const area = (item.areaName || item.location || '').toLowerCase();
  const pin = String(item.pincode || '');

  if (pin.startsWith('500') || city.includes('hyderabad')) {
    if (area.includes('alwal') || pin === '500010') return { lat: 17.5023, lng: 78.5284 };
    if (area.includes('madhapur') || pin === '500081') return { lat: 17.4483, lng: 78.3915 };
    return { lat: 17.3850, lng: 78.4867 };
  }

  if (pin.startsWith('520') || city.includes('vijayawada')) {
    if (area.includes('chittinagar') || pin === '520001') return { lat: 16.5215, lng: 80.6120 };
    if (area.includes('benz circle') || pin === '520010') return { lat: 16.5062, lng: 80.6480 };
    return { lat: 16.5062, lng: 80.6480 };
  }

  return { lat: item.lat || 16.5062, lng: item.lng || 80.6480 };
};

const CustomerHome = ({
  foods: propFoods = [],
  searchQuery = '',
  cart = [],
  addToCart,
  updateQuantity,
  wishlist = [],
  toggleWishlist,
  currentLocation = 'Chittinagar, Krishna (520001)',
  customerCoords = { lat: 16.5215, lng: 80.6120 }
}) => {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [dbFoods, setDbFoods] = useState([]);

  // Auto-fetch directly if props not ready on instant refresh
  useEffect(() => {
    if (!propFoods || propFoods.length === 0) {
      axios.get('/api/food')
        .then(res => {
          if (Array.isArray(res.data)) {
            setDbFoods(res.data);
          }
        })
        .catch(console.error);
    }
  }, [propFoods]);

  const activeFoods = propFoods && propFoods.length > 0 ? propFoods : dbFoods;

  // Deduplicate items
  const uniqueFoods = useMemo(() => {
    const seen = new Set();
    return activeFoods.filter(item => {
      const id = String(item._id || item.id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [activeFoods]);

  const filteredFoods = useMemo(() => {
    const normalizedSearch = (searchQuery || '').toLowerCase();

    return uniqueFoods
      .map(item => {
        const kitchenCoords = getKitchenCoords(item);
        const distance = calculateDistanceKm(customerCoords.lat, customerCoords.lng, kitchenCoords.lat, kitchenCoords.lng);
        const distanceKm = distance !== null && !Number.isNaN(distance) ? distance : 2.5;
        return { ...item, distanceKm, etaMins: Math.round(15 + distanceKm * 3.5) };
      })
      .filter(item => {
        const matchesRadius = item.distanceKm <= 20.0;
        const matchesSearch = [item.title, item.description, item.sellerName]
          .some(value => value?.toLowerCase().includes(normalizedSearch));
        const matchesCategory = selectedCategory === 'ALL' || (item.protein || '').toLowerCase().includes(selectedCategory.toLowerCase());
        return matchesRadius && matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [customerCoords.lat, customerCoords.lng, uniqueFoods, searchQuery, selectedCategory]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
        color: '#ffffff',
        borderRadius: '20px',
        padding: '28px 30px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 10px 25px rgba(22, 163, 74, 0.15)'
      }}>
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: '800' }}>
            Fresh & Healthy Meal Plans 🌱
          </h1>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.95 }}>
            Hot meals prepared fresh and delivered directly from partner cloud kitchens.
          </p>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(8px)',
          padding: '10px 18px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.3)',
          minWidth: '220px'
        }}>
          <span style={{ fontSize: '11px', opacity: 0.9, display: 'block', marginBottom: '2px' }}>
            Active Delivery Hub:
          </span>
          <strong style={{ fontSize: '13px' }}>
            📍 {currentLocation || 'Chittinagar, Krishna (520001)'}
          </strong>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '20px' }}>
        {[
          { id: 'ALL', label: '🍽️ All Meals' },
          { id: 'High Protein', label: 'High Protein' },
          { id: 'Salad', label: 'Salad' },
          { id: 'Keto', label: 'Keto' },
          { id: 'Bowl', label: 'Bowl' }
        ].map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              padding: '8px 18px',
              borderRadius: '20px',
              border: selectedCategory === cat.id ? '2px solid #16a34a' : '1px solid #cbd5e1',
              background: selectedCategory === cat.id ? '#ecfdf5' : '#ffffff',
              color: selectedCategory === cat.id ? '#16a34a' : '#475569',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: '800' }}>
          🥗 Kitchens Delivering to You ({filteredFoods.length})
        </h2>
        <span style={{ fontSize: '13px', color: '#d97706', fontWeight: '700' }}>
          ⚡ Sorted by Closest
        </span>
      </div>

      {/* Empty State */}
      {filteredFoods.length === 0 ? (
        <div style={{
          background: '#ffffff',
          border: '1.5px dashed #cbd5e1',
          borderRadius: '16px',
          padding: '50px 20px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '10px' }}>🚚</span>
          <h3 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '18px', fontWeight: '700' }}>
            No Kitchens Available in this category
          </h3>
          <p style={{ margin: '0 auto', maxWidth: '520px', fontSize: '13px', lineHeight: '1.5', color: '#64748b' }}>
            No partner kitchens found for your active filter. Try selecting <strong>🍽️ All Meals</strong>.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {filteredFoods.map((food) => {
            const cartItem = cart.find(item => item._id === food._id);
            const isWishlisted = wishlist.some(item => item._id === food._id);

            return (
              <div
                key={food._id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                  height: '100%'
                }}
              >
                <div style={{ position: 'relative', width: '100%', height: '180px', background: '#f1f5f9' }}>
                  <img
                    src={food.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}
                    alt={food.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  
                  <span style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    color: '#15803d',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '700',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}>
                    💪 {food.protein || 'High Protein'}
                  </span>

                  <span style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '12px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    color: '#ffffff',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '700',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    📍 {food.distanceKm} km • ⏱️ {food.etaMins} mins
                  </span>

                  <button
                    type="button"
                    onClick={() => toggleWishlist(food)}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(255, 255, 255, 0.9)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '34px',
                      height: '34px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px'
                    }}
                  >
                    {isWishlisted ? '💚' : '🤍'}
                  </button>
                </div>

                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: '1' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#0f172a', fontWeight: '700' }}>
                    {food.title}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 8px 0', color: '#059669', fontSize: '12px', fontWeight: '600' }}>
                    <span>👨‍🍳 {food.sellerName || 'Verified Kitchen'}</span>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span style={{ color: '#64748b' }}>{food.areaName || food.city || 'Local'}</span>
                  </div>
                  
                  <p style={{
                    margin: '0 0 16px 0',
                    color: '#64748b',
                    fontSize: '13px',
                    lineHeight: '1.4',
                    height: '36px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {food.description || 'Fresh nutrient-rich balanced meal.'}
                  </p>

                  <div style={{
                    marginTop: 'auto',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a' }}>
                      ₹{food.price}
                    </span>

                    {cartItem ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#ecfdf5',
                        border: '1px solid #86efac',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <button onClick={() => updateQuantity(food._id, -1)} style={{ background: 'transparent', border: 'none', padding: '6px 12px', color: '#15803d', fontWeight: 'bold', cursor: 'pointer' }}>-</button>
                        <span style={{ padding: '0 8px', fontWeight: '700', color: '#15803d', fontSize: '14px' }}>{cartItem.qty}</span>
                        <button onClick={() => updateQuantity(food._id, 1)} style={{ background: 'transparent', border: 'none', padding: '6px 12px', color: '#15803d', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(food)}
                        style={{
                          background: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '8px 18px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '14px',
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

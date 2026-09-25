import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { isDeliverable } from '../../utils/geoMapper';
import GuidedTour from '../../components/GuidedTour';

const socket = io(window.location.origin, { transports: ['websocket', 'polling'] });

const customerTourSteps = [
  { icon: '📍', title: 'Select Delivery Area', desc: 'Choose your delivery location at the top to browse healthy cloud kitchens within 10 KM.' },
  { icon: '🥗', title: 'Explore Fresh Meals', desc: 'Filter by High Protein, Salads, Keto bowls, and customize your diet effortlessly.' },
  { icon: '🗓️', title: 'Flexible Subscriptions', desc: 'Save on daily meals with zero delivery fees and swap tomorrow’s meal before 8 PM.' },
  { icon: '🛵', title: 'Live GPS & Constant OTP', desc: 'Track your delivery partner live on the map. Your OTP is always the last 4 digits of your mobile number!' }
];

const CustomerHome = ({
  searchQuery = '',
  cart = [],
  addToCart,
  updateQuantity,
  wishlist = [],
  toggleWishlist,
  currentLocation = ''
}) => {
  const [foods, setFoods] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  const activeHub = currentLocation || localStorage.getItem('user_delivery_hub') || '📍 Select Delivery Location';
  const activeHubClean = activeHub.replace(/📍/g, '').trim();

  const formatFoodItem = useCallback((item) => {
    const area = (item.areaName || '').trim();
    const city = (item.city || '').trim();
    const pin = (item.pincode || '').trim();

    const locParts = [area, city].filter(Boolean);
    const formattedLoc = locParts.length > 0 ? locParts.join(', ') : 'Local Kitchen';
    const pinDisplay = pin ? ` - ${pin}` : '';

    return {
      ...item,
      areaName: area,
      city: city,
      pincode: pin,
      fullLocationText: `${formattedLoc}${pinDisplay}`,
      isAvailable: item.isAvailable !== false
    };
  }, []);

  const fetchAllFoods = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);
      const res = await axios.get('/api/food/all');
      const dataArray = Array.isArray(res.data) ? res.data : (res.data?.foods || []);
      setFoods(dataArray.map(formatFoodItem));
    } catch (err) {
      console.error('Error fetching foods:', err);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [formatFoodItem]);

  useEffect(() => {
    fetchAllFoods(true);

    const interval = setInterval(() => {
      fetchAllFoods(false);
    }, 3000);

    socket.on('food_added', (newFood) => {
      setFoods((prev) => [formatFoodItem(newFood), ...prev.filter((f) => f._id !== newFood._id)]);
    });

    socket.on('food_updated', (updatedFood) => {
      setFoods((prev) => prev.map((f) => (f._id === updatedFood._id ? formatFoodItem(updatedFood) : f)));
    });

    socket.on('food_deleted', (deletedId) => {
      setFoods((prev) => prev.filter((f) => f._id !== deletedId));
    });

    return () => {
      clearInterval(interval);
      socket.off('food_added');
      socket.off('food_updated');
      socket.off('food_deleted');
    };
  }, [fetchAllFoods, formatFoodItem]);

  const filteredFoods = useMemo(() => {
    return foods.filter((item) => {
      const currentLoc = (currentLocation || activeHub || '').replace(/📍/g, '').trim();
      if (currentLoc && !currentLoc.toLowerCase().includes('select delivery location') && currentLoc.length > 3) {
        const canDeliver = isDeliverable(currentLoc, item);
        if (!canDeliver) return false;
      }

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
        item.city?.toLowerCase().includes(query) ||
        item.pincode?.includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [foods, selectedCategory, searchQuery, currentLocation, activeHub]);

  const categories = ['All', 'High Protein', 'Salad', 'Keto', 'Bowl'];

  return (
    <>
      <GuidedTour tourKey="customer_v1" steps={customerTourSteps} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 14px', boxSizing: 'border-box' }}>
        <div style={{
          background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
          color: '#ffffff',
          padding: '22px 20px',
          borderRadius: '16px',
          marginBottom: '20px',
          boxShadow: '0 4px 15px rgba(22, 163, 74, 0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '800' }}>
                Fresh & Healthy Meal Plans 🌱
              </h1>
              <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#dcfce7' }}>
                Delivering within 10 KM from verified cloud kitchens.
              </p>
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.25)',
              padding: '8px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '700',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              📍 Delivery To: {activeHubClean}
            </div>
          </div>
        </div>

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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
            🥗 Kitchens Delivering in Your Area ({filteredFoods.length})
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
            ⚡ Live Kitchen Network
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <span style={{ fontSize: '16px', fontWeight: '700' }}>🔄 Checking local kitchens...</span>
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
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '10px' }}>📍</span>
            <h4 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '16px' }}>No Kitchens Delivering in This Area</h4>
            <p style={{ margin: 0, fontSize: '13px' }}>
              We currently deliver within 10 KM of active kitchen hubs. Please select an active city hub.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
            gap: '18px'
          }}>
            {filteredFoods.map((item) => {
              const inCart = (cart || []).find((c) => (c._id || c.id) === (item._id || item.id));
              const isWish = (wishlist || []).some((w) => (w._id || w.id) === (item._id || item.id));
              const isAvailable = item.isAvailable !== false;

              return (
                <div
                  key={item._id || item.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    opacity: isAvailable ? 1 : 0.7
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    padding: '4px 9px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    backdropFilter: 'blur(4px)',
                    zIndex: 2
                  }}>
                    📍 In-Range Kitchen • ⏱️ ~25 mins
                  </div>

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
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      fontSize: '14px',
                      zIndex: 2
                    }}
                  >
                    {isWish ? '💚' : '🤍'}
                  </button>

                  <div style={{ position: 'relative', width: '100%', height: '160px', background: '#f1f5f9' }}>
                    <img
                      src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}
                      alt={item.title}
                      style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                    />
                    {!isAvailable && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontWeight: '800',
                        fontSize: '13px'
                      }}>
                        🔴 OUT OF STOCK
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#0f172a', fontWeight: '800' }}>
                        {item.title}
                      </h4>

                      <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span>👨‍🍳 {item.sellerName || 'Kitchen Partner'}</span>
                        {item.branchName && (
                          <span style={{ background: '#ecfdf5', color: '#16a34a', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>
                            {item.branchName}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                        📍 <strong>Dispatch:</strong> {item.fullLocationText}
                      </div>

                      <p style={{ margin: '0 0 10px 0', color: '#475569', fontSize: '12px', lineHeight: '1.4' }}>
                        {item.description || 'Fresh nutrient-rich balanced meal cooked with organic ingredients.'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                        ₹{item.price}
                      </span>

                      {!isAvailable ? (
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', background: '#fee2e2', padding: '4px 8px', borderRadius: '6px' }}>
                          Sold Out
                        </span>
                      ) : inCart ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          background: '#ecfdf5',
                          border: '1px solid #86efac',
                          borderRadius: '6px'
                        }}>
                          <button
                            onClick={() => updateQuantity((item._id || item.id), -1)}
                            style={{ background: 'transparent', border: 'none', padding: '4px 10px', color: '#15803d', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            -
                          </button>
                          <span style={{ padding: '0 4px', fontWeight: '800', color: '#15803d', fontSize: '12px' }}>
                            {inCart.qty}
                          </span>
                          <button
                            onClick={() => updateQuantity((item._id || item.id), 1)}
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
                            padding: '7px 16px',
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
    </>
  );
};

export default CustomerHome;

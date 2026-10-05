import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { calculateDistanceKm } from '../../utils/geoMapper';
import GuidedTour from '../../components/GuidedTour';

const socket = io(window.location.origin, { transports: ['websocket', 'polling'] });

const customerTourSteps = [
  { icon: '📍', title: 'Select Delivery Area', desc: 'Choose your delivery location at the top to browse healthy cloud kitchens within 10 KM - 30 KM.' },
  { icon: '🥗', title: 'Explore Fresh Meals', desc: 'Filter by High Protein, Salads, Keto bowls, and customize your diet effortlessly.' },
  { icon: '🗓', title: 'Flexible Subscriptions', desc: 'Save on daily meals with zero delivery fees and swap tomorrow’s meal before 8 PM.' },
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
  const [isScanningLocation, setIsScanningLocation] = useState(false);
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(10);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [activeCoords, setActiveCoords] = useState(() => {
    try {
      const stored = localStorage.getItem('user_delivery_coords');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const dropdownRef = useRef(null);
  const activeUser = JSON.parse(localStorage.getItem('active_user') || 'null');
  const isLoggedIn = Boolean(activeUser && (activeUser._id || activeUser.id || activeUser.username));
  const userIdentifier = activeUser?._id || activeUser?.id || activeUser?.username || '';

  const [savedAddresses, setSavedAddresses] = useState(() => {
    if (!isLoggedIn) return [];
    try {
      return JSON.parse(localStorage.getItem('user_addresses_' + userIdentifier) || '[]');
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    const handleCategoryEvent = (e) => {
      if (e.detail) setSelectedCategory(e.detail);
    };
    window.addEventListener('select_category', handleCategoryEvent);
    return () => window.removeEventListener('select_category', handleCategoryEvent);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowAddressDropdown(false);
      }
    };
    if (showAddressDropdown) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showAddressDropdown]);

  const syncAddressesFromDB = useCallback(async () => {
    if (!isLoggedIn || !userIdentifier) return;
    try {
      const res = await axios.get('/api/auth/get-addresses/' + userIdentifier).catch(() => ({ data: [] }));
      const dbList = Array.isArray(res.data) ? res.data : [];
      if (dbList.length > 0) {
        setSavedAddresses(dbList);
        localStorage.setItem('user_addresses_' + userIdentifier, JSON.stringify(dbList));
      }
    } catch (e) {}
  }, [isLoggedIn, userIdentifier]);

  useEffect(() => {
    syncAddressesFromDB();
  }, [syncAddressesFromDB]);

  const resolveLocationName = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        const place = a.suburb || a.neighbourhood || a.residential || a.road || a.city_district || '';
        const city = a.city || a.town || a.village || a.county || '';
        const parts = [place, city].filter(Boolean).join(', ');
        if (parts) return `📍 ${parts}`;
      }
    } catch (e) {}
    return `📍 Current GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  // Live GPS scan
  const triggerLiveGPSScan = useCallback(async () => {
    setIsScanningLocation(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const coordsObj = { lat, lng };

          localStorage.setItem('user_delivery_coords', JSON.stringify(coordsObj));
          setActiveCoords(coordsObj);

          const locText = await resolveLocationName(lat, lng);
          localStorage.setItem('user_delivery_hub', locText);
          window.dispatchEvent(new CustomEvent('location_changed', { detail: locText }));
          setIsScanningLocation(false);
        },
        async () => {
          try {
            const ipRes = await fetch('https://ipapi.co/json/');
            const ipData = await ipRes.json();
            if (ipData && ipData.latitude && ipData.longitude) {
              const coordsObj = { lat: ipData.latitude, lng: ipData.longitude };
              localStorage.setItem('user_delivery_coords', JSON.stringify(coordsObj));
              setActiveCoords(coordsObj);

              const locText = `📍 ${ipData.city || 'Local Area'}, ${ipData.region || ''}`;
              localStorage.setItem('user_delivery_hub', locText);
              window.dispatchEvent(new CustomEvent('location_changed', { detail: locText }));
            }
          } catch (e) {}
          setIsScanningLocation(false);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      setIsScanningLocation(false);
    }
  }, []);

  // Run GPS auto-scan if no coordinates exist
  useEffect(() => {
    const curCoords = localStorage.getItem('user_delivery_coords');
    if (!curCoords || !activeCoords) {
      triggerLiveGPSScan();
    }
  }, [triggerLiveGPSScan, activeCoords]);

  const activeHub = currentLocation || localStorage.getItem('user_delivery_hub') || '📍 Select Delivery Location';
  const activeHubClean = activeHub.replace(/📍/g, '').trim();

  const formatFoodItem = useCallback((item) => {
    const area = (item.areaName || '').trim();
    const city = (item.city || '').trim();
    const cleanPin = String(item.pincode || '').replace(/\D/g, '').slice(0, 6);
    const locParts = [area, city].filter(Boolean);
    const formattedLoc = locParts.length > 0 ? locParts.join(', ') : 'Local Kitchen';
    const pinDisplay = cleanPin ? ` - ${cleanPin}` : '';

    return {
      ...item,
      areaName: area,
      city: city,
      pincode: cleanPin,
      fullLocationText: `${formattedLoc}${pinDisplay}`,
      lat: Number(item.lat || 0),
      lng: Number(item.lng || 0),
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
    const interval = setInterval(() => fetchAllFoods(false), 3000);

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

  const foodsWithMetrics = useMemo(() => {
    return foods.map((item) => {
      let distanceKm = null;
      let deliveryTimeMins = 25;
      const hasKitchenCoords = item.lat && item.lng && item.lat !== 0 && item.lng !== 0;
      const hasCustCoords = activeCoords && activeCoords.lat && activeCoords.lng && activeCoords.lat !== 0 && activeCoords.lng !== 0;

      if (hasCustCoords && hasKitchenCoords) {
        distanceKm = calculateDistanceKm(activeCoords.lat, activeCoords.lng, item.lat, item.lng);
        if (distanceKm !== null) {
          deliveryTimeMins = Math.round(15 + (distanceKm * 2.5));
        }
      }
      return { ...item, distanceKm, deliveryTimeMins };
    });
  }, [foods, activeCoords]);

  const filteredFoods = useMemo(() => {
    const isLocationSelected = Boolean(activeCoords && activeCoords.lat && activeCoords.lng);
    const activeHubLower = activeHubClean.toLowerCase();

    return foodsWithMetrics.filter((item) => {
      if (isLocationSelected) {
        if (item.distanceKm !== null) {
          if (item.distanceKm > deliveryRadiusKm) return false;
        } else {
          const itemCity = (item.city || '').toLowerCase();
          const itemArea = (item.areaName || '').toLowerCase();
          const matchesCity = itemCity && activeHubLower.includes(itemCity);
          const matchesArea = itemArea && activeHubLower.includes(itemArea);
          if (!matchesCity && !matchesArea) return false;
        }
      }

      const matchesCategory = selectedCategory === 'All' || (item.protein && item.protein.toLowerCase().includes(selectedCategory.toLowerCase()));
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
  }, [foodsWithMetrics, activeCoords, activeHubClean, deliveryRadiusKm, selectedCategory, searchQuery]);

  const handleSelectAddress = (addr) => {
    const newLoc = '📍 ' + addr.address;
    localStorage.setItem('user_delivery_hub', newLoc);

    if (addr.lat && addr.lng && Number(addr.lat) !== 0) {
      const coordsToSet = { lat: Number(addr.lat), lng: Number(addr.lng) };
      localStorage.setItem('user_delivery_coords', JSON.stringify(coordsToSet));
      setActiveCoords(coordsToSet);
    }

    window.dispatchEvent(new CustomEvent('location_changed', { detail: newLoc }));
    setShowAddressDropdown(false);
  };

  const handleAddToCartWithAuth = (item) => {
    if (!isLoggedIn) {
      alert('⚠️ Please log in first to add dishes and proceed with your order.');
      window.location.href = '/login';
      return;
    }
    addToCart(item);
  };

  const categories = ['All', 'High Protein', 'Salad', 'Keto', 'Bowl'];

  return (
    <>
      <GuidedTour tourKey="customer_v1" steps={customerTourSteps} />
      <div style={{ width: '100%', maxWidth: '1240px', margin: '0 auto', padding: '20px 20px', boxSizing: 'border-box' }}>

        {/* BANNER WITH CONTROLS STRICTLY PLACED ON THE RIGHT */}
        <div style={{
          background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
          color: '#ffffff',
          padding: '24px 28px',
          borderRadius: '16px',
          marginBottom: '22px',
          boxShadow: '0 4px 15px rgba(22, 163, 74, 0.2)',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Left Side: Title & Subtitle */}
          <div style={{ flex: '1 1 300px', minWidth: '260px' }}>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: '800' }}>
              Fresh & Healthy Meal Plans 🌱
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#dcfce7', lineHeight: '1.4' }}>
              Delivering fresh nutritious meals from verified cloud kitchens.
            </p>
          </div>

          {/* Right Side: Address Selector (Top) + Range (Bottom) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-end',
            marginLeft: 'auto',
            flexShrink: 0
          }}>

            {/* Row 1: Address Dropdown + GPS Scan */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowAddressDropdown(!showAddressDropdown)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.88)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.25)',
                    padding: '8px 16px',
                    borderRadius: '24px',
                    fontSize: '13px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    maxWidth: '420px',
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.18)'
                  }}
                  title="Click to switch saved address"
                >
                  <span style={{ color: '#f87171' }}>📍</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                    {isScanningLocation ? '⚡ Scanning GPS...' : activeHubClean || 'Detecting Location...'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#86efac' }}>▼</span>
                </button>

                {showAddressDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '44px',
                    right: 0,
                    width: '320px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.25)',
                    padding: '12px',
                    zIndex: 99999,
                    color: '#0f172a'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', paddingBottom: '6px', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>
                      Choose Delivery Address
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                      {!isLoggedIn ? (
                        <div style={{ padding: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                          Please log in to use saved addresses.<br />
                          <a href="/login" style={{ color: '#16a34a', fontWeight: 'bold', textDecoration: 'none' }}>🔑 Login Here</a>
                        </div>
                      ) : savedAddresses.length === 0 ? (
                        <div style={{ padding: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                          No saved addresses.<br />
                          <a href="/account" style={{ color: '#16a34a', fontWeight: 'bold', textDecoration: 'none' }}>+ Add in My Account</a>
                        </div>
                      ) : (
                        savedAddresses.map(a => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => handleSelectAddress(a)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              background: activeHubClean.includes(a.address) ? '#ecfdf5' : '#ffffff',
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%'
                            }}
                          >
                            <span>{a.type === 'Home' ? '🏡' : a.type === 'Work' ? '💼' : '📍'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>{a.type}</strong>
                              <span style={{ fontSize: '11px', color: '#475569', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {a.address}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* GPS Rescan Button */}
              <button
                type="button"
                onClick={triggerLiveGPSScan}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  color: '#86efac',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                title="Scan Live GPS Location"
              >
                🛰️
              </button>
            </div>

            {/* Row 2: Range Pills directly under Address (Right Aligned) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.28)', padding: '4px 8px', borderRadius: '20px', width: 'fit-content' }}>
              <span style={{ fontSize: '11px', color: '#dcfce7', fontWeight: '800', marginRight: '4px', fontFamily: 'monospace' }}>RANGE:</span>
              {[10, 15, 20, 25, 30].map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => setDeliveryRadiusKm(km)}
                  style={{
                    background: deliveryRadiusKm === km ? '#ffffff' : 'transparent',
                    color: deliveryRadiusKm === km ? '#15803d' : '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {km}KM
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* Categories Bar */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '14px', marginBottom: '18px' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '9px 20px',
                borderRadius: '24px',
                border: selectedCategory === cat ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: selectedCategory === cat ? '#16a34a' : '#ffffff',
                color: selectedCategory === cat ? '#ffffff' : '#334155',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {cat === 'All' ? '🍽 All Meals' : cat}
            </button>
          ))}
        </div>

        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
            Kitchens Delivering in Your Area — {deliveryRadiusKm} KM ({filteredFoods.length})
          </h2>
          <span style={{ background: '#ecfdf5', color: '#16a34a', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '800', border: '1px solid #86efac' }}>
            ⚡ Live Kitchens
          </span>
        </div>

        {/* Food Items Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
            <span style={{ fontSize: '16px', fontWeight: '700' }}>🔄 Loading fresh menu...</span>
          </div>
        ) : filteredFoods.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: '#ffffff', borderRadius: '16px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '10px' }}>📍</span>
            <h4 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '16px' }}>No dishes found in {deliveryRadiusKm} KM radius</h4>
            <p style={{ margin: 0, fontSize: '13px' }}>Try increasing radius to 20KM or 30KM above.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '22px', width: '100%' }}>
            {filteredFoods.map((item) => {
              const inCart = (cart || []).find((c) => (c._id || c.id) === (item._id || item.id));
              const isWish = (wishlist || []).some((w) => (w._id || w.id) === (item._id || item.id));
              const isAvailable = item.isAvailable !== false;
              const distText = item.distanceKm !== null ? `${item.distanceKm} KM away` : 'Nearby Kitchen';

              return (
                <div
                  key={item._id || item.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                  }}
                >
                  <div style={{ position: 'relative', width: '100%', height: '170px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '50px' }}>🥗</span>
                    )}

                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(15, 23, 42, 0.85)', color: '#ffffff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                      📍 {distText}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleWishlist(item)}
                      style={{ position: 'absolute', top: '10px', right: '10px', background: '#ffffff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
                    >
                      {isWish ? '💚' : '🤍'}
                    </button>
                  </div>

                  <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>{item.title}</h3>
                      <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '700', marginBottom: '6px' }}>
                        👨‍🍳 {item.sellerName || 'Verified Kitchen'}
                      </div>
                      {item.fullLocationText && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                          📍 {item.fullLocationText}
                        </div>
                      )}
                      <p style={{ margin: '0 0 12px 0', color: '#475569', fontSize: '12px', lineHeight: '1.45' }}>
                        {item.description || 'Nutrient-rich healthy meal freshly prepared upon order.'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>₹{item.price}</span>

                      {!isAvailable ? (
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', background: '#fee2e2', padding: '4px 8px', borderRadius: '6px' }}>
                          Sold Out
                        </span>
                      ) : inCart ? (
                        <div style={{ display: 'flex', alignItems: 'center', background: '#ecfdf5', border: '1px solid #86efac', borderRadius: '8px' }}>
                          <button onClick={() => updateQuantity((item._id || item.id), -1)} style={{ background: 'transparent', border: 'none', padding: '6px 12px', color: '#15803d', fontWeight: 'bold', cursor: 'pointer' }}>-</button>
                          <span style={{ padding: '0 4px', fontWeight: '800', color: '#15803d', fontSize: '13px' }}>{inCart.qty}</span>
                          <button onClick={() => updateQuantity((item._id || item.id), 1)} style={{ background: 'transparent', border: 'none', padding: '6px 12px', color: '#15803d', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCartWithAuth(item)}
                          style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
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

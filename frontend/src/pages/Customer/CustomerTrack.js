import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';

const socket = io(window.location.origin, {
  transports: ['websocket', 'polling']
});

// Dynamic Geocoder without hardcoded coordinates
async function getCoordinatesFromAddress(addressText) {
  if (!addressText) return null;
  try {
    const cleanAddr = encodeURIComponent(addressText.replace(/#/g, '').trim());
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${cleanAddr}&limit=1`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.warn("Geocoding failed for:", addressText, e);
  }
  return null;
}

export default function CustomerTrack() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const kitchenMarkerRef = useRef(null);
  const dropMarkerRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const routeLineRef = useRef(null);

  const coordsRef = useRef({
    kitchen: null,
    drop: null
  });

  const fetchOrder = async () => {
    try {
      const res = await axios.get('/api/orders/seller-orders/all');
      const found = (res.data || []).find(o => o._id === orderId);
      if (found) setOrder(found);
    } catch (err) {
      console.error('Fetch Order Error:', err);
    }
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 3000);

    socket.on('order_status_updated', updated => {
      if (updated._id === orderId) setOrder(updated);
    });

    return () => {
      clearInterval(interval);
      socket.off('order_status_updated');
    };
  }, [orderId]);

  useEffect(() => {
    if (!window.L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initDynamicMap();
      document.body.appendChild(script);
    } else {
      initDynamicMap();
    }
  }, [order]);

  const initDynamicMap = async () => {
    if (!window.L || !mapContainerRef.current || !order) return;

    // 1. Resolve Kitchen coordinates directly from order item or geocode area
    let kitchenCoords = null;
    const firstItem = order.items && order.items[0];
    if (firstItem?.lat && firstItem?.lng) {
      kitchenCoords = { lat: Number(firstItem.lat), lng: Number(firstItem.lng) };
    } else if (firstItem?.areaName) {
      const kitchenLocText = [firstItem.areaName, firstItem.city].filter(Boolean).join(', ');
      kitchenCoords = await getCoordinatesFromAddress(kitchenLocText);
    }

    // 2. Resolve Customer Drop coordinates directly from delivery address
    const dropCoords = await getCoordinatesFromAddress(order.deliveryAddress);

    if (!kitchenCoords && dropCoords) kitchenCoords = { lat: dropCoords.lat + 0.015, lng: dropCoords.lng + 0.015 };
    if (!dropCoords && kitchenCoords) return;
    if (!kitchenCoords && !dropCoords) return;

    coordsRef.current = { kitchen: kitchenCoords, drop: dropCoords };

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, { zoomControl: false });
      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const currentStatus = order.orderStatus || 'Preparing';

    // Kitchen Marker
    if (kitchenCoords) {
      if (!kitchenMarkerRef.current) {
        const kitchenIcon = window.L.divIcon({
          className: 'custom-kitchen-marker',
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -20px);">
              <div style="background:#10b981; width:36px; height:36px; border-radius:50%; display:grid; place-items:center; border:2px solid #fff; box-shadow:0 0 14px #10b981; font-size:18px;">🍳</div>
              <span style="background:#0f172a; color:#34d399; font-size:11px; font-weight:800; padding:2px 8px; border-radius:6px; border:1px solid #10b981; margin-top:4px; white-space:nowrap;">Kitchen Hub</span>
            </div>
          `,
          iconSize: [0, 0]
        });
        kitchenMarkerRef.current = window.L.marker([kitchenCoords.lat, kitchenCoords.lng], { icon: kitchenIcon }).addTo(map);
      } else {
        kitchenMarkerRef.current.setLatLng([kitchenCoords.lat, kitchenCoords.lng]);
      }
    }

    // Customer Drop Marker
    if (dropCoords) {
      if (!dropMarkerRef.current) {
        const dropIcon = window.L.divIcon({
          className: 'custom-drop-marker',
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -20px);">
              <div style="background:#ef4444; width:36px; height:36px; border-radius:50%; display:grid; place-items:center; border:2px solid #fff; box-shadow:0 0 14px #ef4444; font-size:18px;">🏡</div>
              <span style="background:#0f172a; color:#f87171; font-size:11px; font-weight:800; padding:2px 8px; border-radius:6px; border:1px solid #ef4444; margin-top:4px; white-space:nowrap;">Delivery Location</span>
            </div>
          `,
          iconSize: [0, 0]
        });
        dropMarkerRef.current = window.L.marker([dropCoords.lat, dropCoords.lng], { icon: dropIcon }).addTo(map);
      } else {
        dropMarkerRef.current.setLatLng([dropCoords.lat, dropCoords.lng]);
      }
    }

    if (kitchenCoords && dropCoords) {
      const bounds = window.L.latLngBounds([
        [kitchenCoords.lat, kitchenCoords.lng],
        [dropCoords.lat, dropCoords.lng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || !order) return;
    const map = mapInstanceRef.current;
    const isOut = order.orderStatus === 'Out for Delivery';
    const { kitchen, drop } = coordsRef.current;

    if (isOut && kitchen && drop) {
      const bikeLat = order.riderLocation?.lat || ((kitchen.lat + drop.lat) / 2);
      const bikeLng = order.riderLocation?.lng || ((kitchen.lng + drop.lng) / 2);

      if (!riderMarkerRef.current) {
        const bikeIcon = window.L.divIcon({
          className: 'custom-bike-pin',
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -20px);">
              <div style="background:#34d399; width:40px; height:40px; border-radius:50%; display:grid; place-items:center; border:2px solid #fff; box-shadow:0 0 16px #34d399; font-size:22px;">🛵</div>
              <span style="background:#0f172a; color:#34d399; font-size:10px; font-weight:800; padding:1px 6px; border-radius:4px; border:1px solid #34d399; margin-top:2px; white-space:nowrap;">Live Rider</span>
            </div>
          `,
          iconSize: [0, 0]
        });

        riderMarkerRef.current = window.L.marker([bikeLat, bikeLng], { icon: bikeIcon }).addTo(map);
        routeLineRef.current = window.L.polyline([
          [kitchen.lat, kitchen.lng],
          [bikeLat, bikeLng],
          [drop.lat, drop.lng]
        ], { color: '#10b981', weight: 4, dashArray: '6, 8', opacity: 0.95 }).addTo(map);
      } else {
        riderMarkerRef.current.setLatLng([bikeLat, bikeLng]);
        if (routeLineRef.current) {
          routeLineRef.current.setLatLngs([
            [kitchen.lat, kitchen.lng],
            [bikeLat, bikeLng],
            [drop.lat, drop.lng]
          ]);
        }
      }
    } else {
      if (riderMarkerRef.current) {
        map.removeLayer(riderMarkerRef.current);
        riderMarkerRef.current = null;
      }
      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
    }
  }, [order]);

  if (!order) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#9aa3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading real-time order tracking...</p>
      </div>
    );
  }

  const isPreparing = order.orderStatus === 'Preparing';
  const isAssigned = order.orderStatus === 'Rider Assigned';
  const isOut = order.orderStatus === 'Out for Delivery';
  const isDelivered = ['Delivered', 'Completed', 'Settled'].includes(order.orderStatus);
  const isCOD = (order.paymentType && order.paymentType.toLowerCase().includes('cash')) || order.paymentStatus?.includes('PENDING');

  const phoneDigits = String(order.customerPhone || '').replace(/\D/g, '');
  const verificationOtp = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : (order.deliveryOtp || '----');

  return (
    <main style={{ minHeight: '100vh', background: '#0b0f19', color: '#f4f4f5', padding: '20px 16px', fontFamily: 'sans-serif' }}>
      <style>{`
        .dark-tiles .leaflet-tile {
          filter: brightness(0.65) invert(1) contrast(3) hue-rotate(200deg) saturate(0.35) !important;
        }
      `}</style>

      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <button
            onClick={() => navigate('/account')}
            style={{ background: '#1a2130', border: '1px solid #262f40', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
          >
            ← My Orders
          </button>
          <span style={{ fontSize: '12px', color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '5px 14px', borderRadius: '20px', fontWeight: 'bold' }}>
            ● DYNAMIC GPS ACTIVE
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', background: '#121826', border: '1px solid #262f40', borderRadius: '20px', overflow: 'hidden' }}>

          <div style={{ height: '420px', width: '100%', position: 'relative' }}>
            <div ref={mapContainerRef} className="dark-tiles" style={{ height: '100%', width: '100%', zIndex: 1 }} />
            <div style={{ position: 'absolute', top: '14px', left: '14px', background: 'rgba(11, 15, 25, 0.85)', backdropFilter: 'blur(8px)', padding: '6px 14px', borderRadius: '20px', fontSize: '11px', color: '#34d399', border: '1px solid #262f40', zIndex: 10 }}>
              {isPreparing ? 'Kitchen is preparing your food' : isAssigned ? 'Rider Assigned: Heading to Kitchen' : isOut ? 'Live: Delivery Partner on the way' : isDelivered ? 'Meal Delivered' : 'Order Placed'}
            </div>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#9aa3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Order #{(order._id || '').slice(-6).toUpperCase()}
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                  {order.orderStatus}
                </span>
              </div>

              <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '8px 0', color: isDelivered ? '#34d399' : '#fff' }}>
                {isDelivered
                  ? 'Delivered to Your Door'
                  : isPreparing
                    ? 'Kitchen is Preparing'
                    : isAssigned
                      ? 'Partner Heading to Store'
                      : <>Arriving in <span style={{ color: '#34d399' }}>12 mins</span></>}
              </h1>
              <p style={{ fontSize: '12px', color: '#9aa3b8', margin: 0 }}>
                📍 Drop: {order.deliveryAddress}
              </p>
            </div>

            {/* OTP BOX */}
            <div style={{ margin: '16px 0', background: 'rgba(52, 211, 153, 0.08)', border: '2px dashed #34d399', borderRadius: '16px', padding: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', color: '#9aa3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                Customer Delivery Verification OTP
              </span>
              <div style={{ fontSize: '42px', fontWeight: '900', letterSpacing: '8px', color: '#34d399', margin: '4px 0' }}>
                {verificationOtp}
              </div>
              <span style={{ fontSize: '11px', color: '#34d399', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                Fixed OTP: Last 4 digits of recipient contact ({phoneDigits.slice(-4)})
              </span>
              <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1' }}>
                Share this 4-digit code with the rider when food arrives.
              </p>
            </div>

            {/* Partner Info */}
            <div style={{ background: '#1a2130', padding: '14px', borderRadius: '12px', border: '1px solid #262f40', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#34d399', color: '#0b0f19', display: 'grid', placeItems: 'center', fontSize: '20px' }}>
                  🛵
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px' }}>
                    {order.assignedRiderName || 'Assigning Partner...'}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#9aa3b8' }}>
                    {isAssigned ? 'Reaching Kitchen Store' : isOut ? 'Live GPS Active' : 'Verified Delivery Partner'}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: isCOD ? '#fbbf24' : '#34d399', display: 'block' }}>
                  {isCOD ? `💵 Pay ₹${order.totalAmount}` : '💳 Paid Online'}
                </span>
                <span style={{ fontSize: '10px', color: '#9aa3b8' }}>
                  {order.paymentType || 'Cash on Delivery'}
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}

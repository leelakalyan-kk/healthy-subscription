import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { isDeliverable } from '../utils/geoMapper';

const CartDrawer = ({ isOpen, onClose, cart = [], updateQuantity, currentLocation }) => {
  const { currentUser } = useContext(AuthContext);
  const user = currentUser || JSON.parse(localStorage.getItem('active_user') || 'null');

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cod'); // Default COD
  const [isPlacing, setIsPlacing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const userIdentifier = user._id || user.id || user.username;

    const savedAddrs = JSON.parse(localStorage.getItem(`user_addresses_${userIdentifier}`) || '[]');
    setAddresses(savedAddrs);

    if (savedAddrs.length > 0) {
      const defaultAddr = savedAddrs.find(a => a.isDefault) || savedAddrs[0];
      setSelectedAddress(defaultAddr.address);
    } else if (currentLocation && currentLocation !== '📍 Select Delivery Location') {
      setSelectedAddress(currentLocation.replace(/📍/g, '').trim());
    } else {
      setSelectedAddress('');
    }

    const wBal = localStorage.getItem(`wallet_${userIdentifier}`);
    setWalletBalance(wBal !== null ? Number(wBal) : Number(user.walletBalance || 0));
  }, [isOpen, user, currentLocation]);

  const rawCart = Array.isArray(cart) && cart.length > 0 ? cart : JSON.parse(localStorage.getItem('user_cart') || '[]');
  const totalItemCount = rawCart.reduce((acc, i) => acc + (Number(i.qty) || 1), 0);

  const undeliverableItems = useMemo(() => {
    if (rawCart.length === 0 || !selectedAddress) return [];
    return rawCart.filter(item => !isDeliverable(selectedAddress, item));
  }, [rawCart, selectedAddress]);

  if (!isOpen) return null;

  const subtotal = rawCart.reduce((sum, item) => sum + (Number(item?.price || 0) * Number(item?.qty || 1)), 0);
  const gstAmount = subtotal > 0 ? Math.round(subtotal * 0.05) : 0;
  const platformFee = subtotal > 0 ? 5 : 0;
  const deliveryFee = subtotal > 0 ? (subtotal < 199 ? 30 : 0) : 0;
  const grandTotal = subtotal + gstAmount + platformFee + deliveryFee;

  const handlePlaceOrder = async () => {
    if (!user) {
      alert('⚠️ Please login or register to place your order!');
      window.location.href = '/login';
      return;
    }

    if (!selectedAddress || selectedAddress.trim() === '') {
      alert('⚠️ Please select or add a valid delivery address.');
      return;
    }

    if (rawCart.length === 0 || isPlacing) return;

    if (undeliverableItems.length > 0) {
      alert(`⚠️ Location Out-of-Range!\n\n"${undeliverableItems.map(i => i.title).join(', ')}" cannot be delivered to "${selectedAddress}".`);
      return;
    }

    if (paymentMode === 'wallet' && walletBalance < grandTotal) {
      alert(`⚠️ Insufficient Wallet Balance (₹${walletBalance}). Please choose COD or UPI.`);
      return;
    }

    setIsPlacing(true);
    const userIdentifier = user._id || user.id || user.username;

    try {
      const sellerId = (rawCart[0] && rawCart[0].sellerId) ? rawCart[0].sellerId : 'tests';

      const isCash = paymentMode === 'cod';
      const orderPayload = {
        userId: userIdentifier,
        customerName: user.username,
        customerPhone: (() => {
          const matched = addresses.find(a => a.address === selectedAddress);
          return (matched && matched.recipientPhone) ? matched.recipientPhone : (user.phone || '8309720219');
        })(),
        deliveryAddress: selectedAddress,
        sellerId: sellerId,
        items: rawCart.map(item => ({
          foodId: item._id || item.id,
          title: item.title || item.name,
          price: Number(item.price),
          qty: Number(item.qty || 1),
          sellerId: item.sellerId || sellerId
        })),
        itemTotal: subtotal,
        gst: gstAmount,
        platformFee: platformFee,
        deliveryFee: deliveryFee,
        totalAmount: grandTotal,
        paymentType: isCash ? 'Cash on Delivery (COD)' : paymentMode === 'card' ? 'Credit / Debit Card' : paymentMode === 'wallet' ? 'HealthyBites Wallet' : 'Instant UPI',
        paymentStatus: isCash ? 'PENDING' : 'PAID',
        orderStatus: 'Ready for Pickup'
      };

      const res = await axios.post('/api/payment/sandbox-pay', orderPayload);
      if (res.data?.success) {
        if (paymentMode === 'wallet') {
          const newBal = walletBalance - grandTotal;
          setWalletBalance(newBal);
          localStorage.setItem(`wallet_${userIdentifier}`, String(newBal));
        }

        localStorage.removeItem('user_cart');
        localStorage.removeItem('cart');
        const newOrderId = res.data.order?._id;

        setIsPlacing(false);
        if (onClose) onClose();
        
        // Direct redirect to live map tracking
        alert(`🎉 Order Placed Successfully!\nPayment: ${orderPayload.paymentType}`);
        window.location.href = `/track/${newOrderId}`;
      }
    } catch (err) {
      setIsPlacing(false);
      alert(`Order error: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', zIndex: 99999, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#ffffff', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 25px rgba(0,0,0,0.15)' }}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>🛒</span>
            <div>
              <strong style={{ fontSize: '16px', color: '#0f172a', display: 'block' }}>Your Meal Cart</strong>
              <span style={{ fontSize: '11px', color: '#64748b' }}>{totalItemCount} item(s) selected</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: '28px', height: '28px', fontSize: '14px', cursor: 'pointer', color: '#475569', fontWeight: 'bold' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {rawCart.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '80px', color: '#64748b' }}>
              <span style={{ fontSize: '54px', display: 'block', marginBottom: '10px' }}>🥗</span>
              <strong style={{ fontSize: '16px', color: '#0f172a', display: 'block' }}>Your cart is empty</strong>
            </div>
          ) : (
            <>
              {/* Item List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {rawCart.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{item.title || item.name}</strong>
                      <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>₹{item.price} each</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '2px 6px' }}>
                      <button type="button" onClick={() => updateQuantity && updateQuantity(item._id || item.id, -1)} style={{ background: 'none', border: 'none', padding: '3px 8px', fontWeight: '800', cursor: 'pointer', color: '#dc2626' }}>-</button>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{item.qty || 1}</span>
                      <button type="button" onClick={() => updateQuantity && updateQuantity(item._id || item.id, 1)} style={{ background: 'none', border: 'none', padding: '3px 8px', fontWeight: '800', cursor: 'pointer', color: '#16a34a' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Address */}
              <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                  📍 Delivery Location:
                </span>
                {addresses.length > 0 ? (
                  <select value={selectedAddress} onChange={e => setSelectedAddress(e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155' }}>
                    {addresses.map(a => (
                      <option key={a.id} value={a.address}>[{a.type}] {a.address}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" placeholder="Enter your delivery address" value={selectedAddress} onChange={e => setSelectedAddress(e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }} required />
                )}
              </div>

              {/* Payment Mode Selection (Includes COD & Card) */}
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                  💳 Payment Method
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  {/* 1. COD */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', background: paymentMode === 'cod' ? '#ecfdf5' : '#fff', border: paymentMode === 'cod' ? '2px solid #16a34a' : '1px solid #cbd5e1', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="pay_mode" checked={paymentMode === 'cod'} onChange={() => setPaymentMode('cod')} />
                    <span style={{ fontWeight: paymentMode === 'cod' ? '700' : '500' }}>💵 Cash on Delivery (Pay at Doorstep)</span>
                  </label>

                  {/* 2. Card */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', background: paymentMode === 'card' ? '#ecfdf5' : '#fff', border: paymentMode === 'card' ? '2px solid #16a34a' : '1px solid #cbd5e1', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="pay_mode" checked={paymentMode === 'card'} onChange={() => setPaymentMode('card')} />
                    <span style={{ fontWeight: paymentMode === 'card' ? '700' : '500' }}>💳 Credit / Debit Card (Visa, Mastercard, RuPay)</span>
                  </label>

                  {/* 3. UPI */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', background: paymentMode === 'upi' ? '#ecfdf5' : '#fff', border: paymentMode === 'upi' ? '2px solid #16a34a' : '1px solid #cbd5e1', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="pay_mode" checked={paymentMode === 'upi'} onChange={() => setPaymentMode('upi')} />
                    <span style={{ fontWeight: paymentMode === 'upi' ? '700' : '500' }}>⚡ Instant UPI (GPay, PhonePe, Paytm)</span>
                  </label>

                  {/* 4. Wallet */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', background: paymentMode === 'wallet' ? '#ecfdf5' : '#fff', border: paymentMode === 'wallet' ? '2px solid #16a34a' : '1px solid #cbd5e1', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="pay_mode" checked={paymentMode === 'wallet'} onChange={() => setPaymentMode('wallet')} />
                    <span style={{ fontWeight: paymentMode === 'wallet' ? '700' : '500' }}>💰 HealthyBites Wallet (Bal: ₹{walletBalance})</span>
                  </label>
                </div>
              </div>

              {/* Bill Details */}
              <div style={{ background: '#f1f5f9', padding: '12px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '12px', color: '#334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Item Subtotal:</span><span style={{ fontWeight: '700' }}>₹{subtotal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>GST (5% Tax):</span><span style={{ fontWeight: '700' }}>₹{gstAmount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Platform Fee:</span><span style={{ fontWeight: '700' }}>₹{platformFee}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Delivery Fee:</span><span style={{ color: deliveryFee === 0 ? '#16a34a' : '#0f172a', fontWeight: '700' }}>{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</span>
                </div>
                <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                  <span>Total Payable:</span><span style={{ color: '#16a34a' }}>₹{grandTotal}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {rawCart.length > 0 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <button
              onClick={handlePlaceOrder}
              disabled={isPlacing || undeliverableItems.length > 0}
              style={{
                width: '100%',
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '13px',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {isPlacing ? 'Placing Order...' : paymentMode === 'cod' ? `Place Cash on Delivery Order (₹${grandTotal})` : `Pay ₹${grandTotal} via ${paymentMode.toUpperCase()}`}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default CartDrawer;

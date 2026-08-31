import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { isDeliverable } from '../utils/geoMapper';

const CartDrawer = ({ isOpen, onClose, cart = [], updateQuantity, currentLocation }) => {
  const { currentUser } = useContext(AuthContext);
  const user = currentUser || JSON.parse(localStorage.getItem('active_user') || '{}');
  const userIdentifier = user._id || user.id || user.username || 'user_1';

  const [addresses, setAddresses] = useState(() => {
    return JSON.parse(localStorage.getItem(`user_addresses_${userIdentifier}`) || '[]');
  });

  const [selectedAddress, setSelectedAddress] = useState(() => {
    return currentLocation?.replace(/📍/g, '').trim() || localStorage.getItem('user_delivery_hub')?.replace(/📍/g, '').trim() || 'Vijayawada';
  });

  const [walletBalance, setWalletBalance] = useState(() => {
    const saved = localStorage.getItem(`wallet_${userIdentifier}`);
    return saved !== null ? Number(saved) : 250;
  });

  const [paymentMode, setPaymentMode] = useState('wallet');
  const [upiId, setUpiId] = useState(user.email ? `${user.username || 'user'}@okhdfcbank` : 'customer@okhdfcbank');
  const [isPlacing, setIsPlacing] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(`user_addresses_${userIdentifier}`) || '[]');
    setAddresses(saved);
    const wBal = localStorage.getItem(`wallet_${userIdentifier}`);
    if (wBal !== null) {
      setWalletBalance(Number(wBal));
    }
    if (currentLocation && currentLocation !== '📍 Select Delivery Location') {
      setSelectedAddress(currentLocation.replace(/📍/g, '').trim());
    }
  }, [isOpen, userIdentifier, currentLocation]);

  const rawCart = Array.isArray(cart) && cart.length > 0 ? cart : JSON.parse(localStorage.getItem('user_cart') || '[]');
  const totalItemCount = rawCart.reduce((acc, i) => acc + (Number(i.qty) || 1), 0);

  // Check deliverability of all cart items to the selected address
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

  const handleSandboxOrder = async () => {
    if (rawCart.length === 0 || isPlacing) return;

    if (undeliverableItems.length > 0) {
      alert(`⚠️ Location Out-of-Range!\n\n"${undeliverableItems.map(i => i.title).join(', ')}" is not delivered to "${selectedAddress}".\n\nPlease select a matching delivery hub or remove the item.`);
      return;
    }

    if (paymentMode === 'wallet' && walletBalance < grandTotal) {
      alert(`⚠️ Insufficient Wallet Balance (₹${walletBalance}). Please Top-Up from Account or choose UPI/Card.`);
      return;
    }

    setIsPlacing(true);

    try {
      const sellerId = (rawCart[0] && rawCart[0].sellerId) ? rawCart[0].sellerId : 'tests';

      const orderPayload = {
        userId: userIdentifier,
        customerName: user.username || user.name || 'Customer',
        customerPhone: user.phone || '8074095895',
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
        paymentType: paymentMode === 'wallet' ? 'HealthyBites Wallet (Instant)' : paymentMode === 'upi' ? `Sandbox UPI (${upiId})` : 'Sandbox Card',
        paymentStatus: 'PAID',
        orderStatus: 'Order Placed'
      };

      const res = await axios.post('/api/payment/sandbox-pay', orderPayload);
      if (res.data?.success) {
        if (paymentMode === 'wallet') {
          const newBal = walletBalance - grandTotal;
          setWalletBalance(newBal);
          localStorage.setItem(`wallet_${userIdentifier}`, String(newBal));

          const existingTxns = JSON.parse(localStorage.getItem(`wallet_txns_${userIdentifier}`) || '[]');
          const newTxn = {
            id: 'TXN_' + Math.floor(100000 + Math.random() * 900000),
            desc: `Food Order #${(res.data.order?._id || '').slice(-6).toUpperCase()}`,
            amount: grandTotal,
            type: 'DR',
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          };
          localStorage.setItem(`wallet_txns_${userIdentifier}`, JSON.stringify([newTxn, ...existingTxns]));
        }

        localStorage.removeItem('user_cart');
        localStorage.removeItem('cart');
        const shortId = (res.data.order?._id || '').slice(-6).toUpperCase();

        setIsPlacing(false);
        if (onClose) onClose();
        alert(`🎉 Order Placed Successfully for ₹${grandTotal}!\nRef ID: #${shortId}`);
        window.location.href = '/account';
      }
    } catch (err) {
      console.error(err);
      setIsPlacing(false);
      alert(`Order error: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', zIndex: 99999, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#ffffff', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 25px rgba(0,0,0,0.15)' }}>

        {/* Header */}
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

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {rawCart.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '80px', color: '#64748b' }}>
              <span style={{ fontSize: '54px', display: 'block', marginBottom: '10px' }}>🥗</span>
              <strong style={{ fontSize: '16px', color: '#0f172a', display: 'block' }}>Your cart is empty</strong>
              <p style={{ marginTop: '4px', fontSize: '13px' }}>Explore delicious healthy meals from menu.</p>
            </div>
          ) : (
            <>
              {/* Deliverability Warning */}
              {undeliverableItems.length > 0 && (
                <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', marginBottom: '12px' }}>
                  ⚠️ {undeliverableItems.length} item(s) cannot be delivered to "{selectedAddress}". Switch location or remove them to proceed.
                </div>
              )}

              {/* Item List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {rawCart.map((item, idx) => {
                  const itemId = item._id || item.id;
                  const itemQty = Number(item.qty) || 1;
                  const itemValid = isDeliverable(selectedAddress, item);

                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: itemValid ? '#f8fafc' : '#fff1f2', padding: '12px 14px', borderRadius: '12px', border: itemValid ? '1px solid #e2e8f0' : '1px solid #fca5a5' }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{item.title || item.name}</strong>
                        <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>₹{item.price} each</span>
                        {!itemValid && (
                          <span style={{ display: 'block', fontSize: '10px', color: '#dc2626', fontWeight: '800', marginTop: '2px' }}>
                            🔴 Out of Delivery Range ({item.city || 'Kitchen'} area)
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '2px 6px' }}>
                        <button
                          type="button"
                          onClick={() => updateQuantity && updateQuantity(itemId, -1)}
                          style={{ background: 'none', border: 'none', padding: '3px 8px', fontWeight: '800', cursor: 'pointer', color: '#dc2626' }}
                        >
                          -
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{itemQty}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity && updateQuantity(itemId, 1)}
                          style={{ background: 'none', border: 'none', padding: '3px 8px', fontWeight: '800', cursor: 'pointer', color: '#16a34a' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Delivery Address Selector */}
              <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                  📍 Delivery Location:
                </span>
                {addresses.length > 0 ? (
                  <select
                    value={selectedAddress}
                    onChange={e => setSelectedAddress(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155' }}
                  >
                    {addresses.map(a => (
                      <option key={a.id} value={a.address}>
                        [{a.type}] {a.address}
                      </option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    value={selectedAddress}
                    onChange={e => setSelectedAddress(e.target.value)}
                    style={{ width: '100%', fontSize: '12px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                    rows="2"
                  />
                )}
              </div>

              {/* Bill Details */}
              <div style={{ background: '#f1f5f9', padding: '12px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '12px', color: '#334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Item Subtotal:</span>
                  <span style={{ fontWeight: '700' }}>₹{subtotal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>GST (5% Restaurant Tax):</span>
                  <span style={{ fontWeight: '700' }}>₹{gstAmount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Platform Fee:</span>
                  <span style={{ fontWeight: '700' }}>₹{platformFee}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Delivery Partner Fee:</span>
                  <span style={{ color: deliveryFee === 0 ? '#16a34a' : '#0f172a', fontWeight: '700' }}>
                    {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                  </span>
                </div>
                <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                  <span>To Pay:</span>
                  <span style={{ color: '#16a34a' }}>₹{grandTotal}</span>
                </div>
              </div>

              {/* Payment Mode */}
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                  💳 Select Payment <span style={{ color: '#ea580c', fontSize: '10px' }}>(SANDBOX)</span>
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { id: 'wallet', label: `💰 HealthyBites Wallet (Bal: ₹${walletBalance})` },
                    { id: 'upi', label: '⚡ Instant UPI (GPay / PhonePe / Paytm)' },
                    { id: 'card', label: '💳 Test Debit / Credit Card' }
                  ].map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', background: paymentMode === m.id ? '#ecfdf5' : '#fff', border: paymentMode === m.id ? '1px solid #16a34a' : '1px solid #cbd5e1', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer' }}>
                      <input type="radio" name="pay_mode" checked={paymentMode === m.id} onChange={() => setPaymentMode(m.id)} />
                      <span style={{ fontWeight: paymentMode === m.id ? '700' : '500' }}>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {paymentMode === 'upi' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '3px' }}>Sandbox UPI ID</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {rawCart.length > 0 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Final Total:</span>
              <strong style={{ fontSize: '20px', color: '#16a34a' }}>₹{grandTotal}</strong>
            </div>
            <button
              onClick={handleSandboxOrder}
              disabled={isPlacing || undeliverableItems.length > 0}
              style={{
                width: '100%',
                background: (isPlacing || undeliverableItems.length > 0) ? '#94a3b8' : '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: (isPlacing || undeliverableItems.length > 0) ? 'not-allowed' : 'pointer'
              }}
            >
              {undeliverableItems.length > 0 ? '⚠️ Remove Out-of-Range Items' : isPlacing ? 'Processing Order...' : `Pay ₹${grandTotal} via ${paymentMode === 'wallet' ? 'Wallet' : paymentMode === 'upi' ? 'UPI' : 'Card'}`}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default CartDrawer;

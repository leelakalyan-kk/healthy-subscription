import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';

const socket = io(window.location.origin, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

const Account = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('orders');
  const [addresses, setAddresses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Wallet & Payment State
  const [walletBalance, setWalletBalance] = useState(250);
  const [savedUpi, setSavedUpi] = useState(['kalyan@okhdfcbank', '8074095895@ybl']);
  const [newUpiInput, setNewUpiInput] = useState('');
  const [refunds, setRefunds] = useState([
    { id: 'REF_98124', orderId: '863F94', amount: 54, status: 'Refund Completed', date: '25 Aug 2026', source: 'Healthy Wallet' }
  ]);

  // Add Address Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddr, setNewAddr] = useState({
    tag: 'Home',
    flatNo: '',
    area: '',
    landmark: '',
    city: '',
    pincode: '',
    phone: ''
  });

  const activeUser = currentUser || JSON.parse(localStorage.getItem('active_user') || '{}');
  const customerName = activeUser.username || activeUser.name || 'kalyan';

  const loadOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoadingOrders(true);
    try {
      const res = await axios.get(`/api/orders/user-orders/${customerName}`);
      if (Array.isArray(res.data)) {
        setOrders(res.data);
      }
    } catch (err) {
      console.error("Error loading customer orders:", err);
    } finally {
      if (!isSilent) setLoadingOrders(false);
    }
  }, [customerName]);

  useEffect(() => {
    // 1. Initial Load
    const saved = JSON.parse(localStorage.getItem(`user_addresses_${customerName}`) || '[]');
    setAddresses(saved);
    loadOrders(false);

    // 2. Auto-Fetch Polling
    const pollTimer = setInterval(() => {
      loadOrders(true);
    }, 3000);

    // 3. Live Socket.IO Listeners
    socket.on('order_status_updated', (updatedOrder) => {
      setOrders(prev =>
        prev.map(o => (o._id === updatedOrder._id ? updatedOrder : o))
      );
    });

    socket.on('new_order_placed', (newOrder) => {
      const isMine =
        newOrder.customerName?.toLowerCase() === customerName.toLowerCase() ||
        newOrder.userId === customerName;
      if (isMine) {
        setOrders(prev => [newOrder, ...prev.filter(o => o._id !== newOrder._id)]);
      }
    });

    return () => {
      clearInterval(pollTimer);
      socket.off('order_status_updated');
      socket.off('new_order_placed');
    };
  }, [customerName, loadOrders]);

  const handleSetActive = (id) => {
    const updated = addresses.map(addr => {
      const active = addr.id === id;
      if (active) {
        localStorage.setItem('user_delivery_hub', addr.formattedAddress);
      }
      return { ...addr, isActive: active };
    });
    setAddresses(updated);
    localStorage.setItem(`user_addresses_${customerName}`, JSON.stringify(updated));
    window.location.reload();
  };

  const handleAddAddress = (e) => {
    e.preventDefault();
    if (!newAddr.flatNo.trim()) return alert('Please enter Flat / House / Door Number');
    if (!newAddr.area.trim()) return alert('Please enter Area / Street / Locality');
    if (!newAddr.city.trim()) return alert('Please enter City');
    if (!newAddr.pincode.trim() || newAddr.pincode.length !== 6) return alert('Please enter a valid 6-digit PIN code');

    const formattedAddress = `${newAddr.flatNo.trim()}, ${newAddr.area.trim()}${newAddr.landmark.trim() ? `, Near ${newAddr.landmark.trim()}` : ''}, ${newAddr.city.trim()} - ${newAddr.pincode.trim()}`;

    const newItem = {
      id: Date.now().toString(),
      tag: newAddr.tag,
      formattedAddress,
      phone: newAddr.phone.trim() || activeUser.phone || '',
      isActive: addresses.length === 0
    };

    const updated = [...addresses, newItem];
    setAddresses(updated);
    localStorage.setItem(`user_addresses_${customerName}`, JSON.stringify(updated));
    if (addresses.length === 0) {
      localStorage.setItem('user_delivery_hub', formattedAddress);
    }

    setNewAddr({ tag: 'Home', flatNo: '', area: '', landmark: '', city: '', pincode: '', phone: '' });
    setShowAddForm(false);
    alert('✅ Delivery address added successfully!');
  };

  const handleDeleteAddress = (id) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    const updated = addresses.filter(a => a.id !== id);
    setAddresses(updated);
    localStorage.setItem(`user_addresses_${customerName}`, JSON.stringify(updated));
  };

  const handleAddUpi = (e) => {
    e.preventDefault();
    if (!newUpiInput.trim() || !newUpiInput.includes('@')) return alert('Please enter a valid UPI ID (e.g. name@upi)');
    setSavedUpi([...savedUpi, newUpiInput.trim()]);
    setNewUpiInput('');
    alert('✅ UPI ID linked successfully!');
  };

  const getBadgeColors = (status) => {
    switch (status) {
      case 'Preparing':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
      case 'Ready for Pickup':
        return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
      case 'Out for Delivery':
        return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' };
      case 'Delivered':
        return { bg: '#ecfdf5', text: '#15803d', border: '#86efac' };
      case 'Cancelled':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
      default:
        return { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px 14px', boxSizing: 'border-box' }}>
      
      {/* Clean Profile Header (Badge Removed) */}
      <div style={{
        background: '#0f172a',
        color: '#ffffff',
        padding: '20px 24px',
        borderRadius: '16px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '800' }}>
            👤 {customerName}
          </h2>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {activeUser.email || 'customer@healthybites.local'} • {activeUser.phone || 'Phone not set'}
          </span>
        </div>
        <button
          onClick={logout}
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          🚪 Logout
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '20px' }}>
        {[
          { id: 'orders', label: `📦 Orders (${orders.length})` },
          { id: 'addresses', label: `📍 Saved Addresses (${addresses.length})` },
          { id: 'payments', label: '💳 Payment Modes' },
          { id: 'wallet', label: `💰 Wallet (₹${walletBalance})` },
          { id: 'refunds', label: `🔄 Refunds (${refunds.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: activeTab === tab.id ? '2px solid #16a34a' : '1px solid #cbd5e1',
              background: activeTab === tab.id ? '#ecfdf5' : '#ffffff',
              color: activeTab === tab.id ? '#16a34a' : '#475569',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. ORDERS TAB */}
      {activeTab === 'orders' && (
        <div>
          {loadingOrders ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <span>🔄 Loading past orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: '#fff', borderRadius: '14px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
              <span style={{ fontSize: '42px', display: 'block', marginBottom: '8px' }}>🍲</span>
              <h4 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: '16px' }}>No orders placed yet</h4>
              <p style={{ margin: 0, fontSize: '13px' }}>Your ordered healthy meals will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {orders.map(o => {
                const badge = getBadgeColors(o.orderStatus);
                return (
                  <div
                    key={o._id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '16px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '15px', color: '#0f172a' }}>Order #{o._id.slice(-6).toUpperCase()}</strong>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                          📅 {new Date(o.createdAt || Date.now()).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '17px', fontWeight: '800', color: '#16a34a' }}>₹{o.totalAmount}</span>
                        <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                          {o.paymentType || 'Sandbox Paid'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      {o.items?.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155' }}>
                          <span>🥗 <strong>{item.title}</strong> × {item.qty}</span>
                          <span style={{ fontWeight: '600', color: '#475569' }}>₹{item.price * item.qty}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#475569' }}>
                        <strong>📍 Delivered To:</strong> {o.deliveryAddress || 'Saved Customer Location'}
                      </div>
                      <div>
                        <span style={{
                          background: badge.bg,
                          color: badge.text,
                          border: `1px solid ${badge.border}`,
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '800'
                        }}>
                          ● {o.orderStatus || 'Order Placed'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. SAVED ADDRESSES TAB */}
      {activeTab === 'addresses' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>Saved Delivery Locations</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {showAddForm ? '✕ Close Form' : '➕ Add New Address'}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddAddress} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {['Home', 'Work', 'Friends & Family', 'Other'].map(tag => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => setNewAddr({ ...newAddr, tag })}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      border: newAddr.tag === tag ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      background: newAddr.tag === tag ? '#ecfdf5' : '#f8fafc',
                      color: newAddr.tag === tag ? '#16a34a' : '#475569',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <input type="text" placeholder="Flat / House / Door No *" value={newAddr.flatNo} onChange={e => setNewAddr({ ...newAddr, flatNo: e.target.value })} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} required />
                <input type="text" placeholder="Area / Street / Locality *" value={newAddr.area} onChange={e => setNewAddr({ ...newAddr, area: e.target.value })} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <input type="text" placeholder="Landmark (Optional)" value={newAddr.landmark} onChange={e => setNewAddr({ ...newAddr, landmark: e.target.value })} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                <input type="text" placeholder="City *" value={newAddr.city} onChange={e => setNewAddr({ ...newAddr, city: e.target.value })} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} required />
                <input type="text" placeholder="Pincode (6-digit) *" maxLength="6" value={newAddr.pincode} onChange={e => setNewAddr({ ...newAddr, pincode: e.target.value })} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} required />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="tel" placeholder="Receiver Mobile No" value={newAddr.phone} onChange={e => setNewAddr({ ...newAddr, phone: e.target.value })} style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                <button type="submit" style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>Save Address</button>
              </div>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {addresses.map(addr => (
              <div
                key={addr.id}
                style={{
                  background: '#ffffff',
                  border: addr.isActive ? '2px solid #16a34a' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ flex: 1, paddingRight: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                      {addr.tag === 'Home' ? '🏠 Home' : addr.tag === 'Work' ? '💼 Work' : '📍 ' + (addr.tag || 'Address')}
                    </strong>
                    {addr.isActive && (
                      <span style={{ background: '#16a34a', color: '#fff', fontSize: '10px', padding: '3px 8px', borderRadius: '12px', fontWeight: '800' }}>
                        ACTIVE DELIVER TO
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#334155', lineHeight: '1.4' }}>
                    {addr.formattedAddress}
                  </p>
                  {addr.phone && <span style={{ fontSize: '12px', color: '#64748b' }}>📞 {addr.phone}</span>}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {!addr.isActive && (
                    <button
                      onClick={() => handleSetActive(addr.id)}
                      style={{ background: '#ecfdf5', color: '#16a34a', border: '1px solid #86efac', padding: '6px 14px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Deliver Here
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. PAYMENT MODES TAB */}
      {activeTab === 'payments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a' }}>⚡ Saved UPI IDs (1-Click Pay)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {savedUpi.map((upi, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>📱 {upi}</span>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700' }}>Verified</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddUpi} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Enter new UPI ID (e.g. mobile@upi)"
                value={newUpiInput}
                onChange={e => setNewUpiInput(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
              <button type="submit" style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                Link UPI
              </button>
            </form>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a' }}>💳 Saved Debit & Credit Cards</h4>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>HDFC Bank Visa Card</strong>
                <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>•••• •••• •••• 4012 (Exp: 12/28)</span>
              </div>
              <span style={{ background: '#ecfdf5', color: '#16a34a', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700' }}>Sandbox Tokenized</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. WALLET TAB */}
      {activeTab === 'wallet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', padding: '24px', borderRadius: '16px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>HEALTHYBITES WALLET BALANCE</span>
            <div style={{ fontSize: '32px', fontWeight: '800', margin: '6px 0 16px 0', color: '#4ade80' }}>
              ₹{walletBalance}.00
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setWalletBalance(b => b + 200); alert('✅ ₹200 added to wallet!'); }}
                style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
              >
                + Top-up ₹200
              </button>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#0f172a' }}>⚡ Wallet Benefits</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
              <li><strong>Zero OTP Checkout:</strong> 1-Click instant payments on lunch & dinner meal plans.</li>
              <li><strong>Instant Refunds:</strong> Cancelled orders are instantly credited back to your wallet.</li>
            </ul>
          </div>
        </div>
      )}

      {/* 5. REFUNDS TAB */}
      {activeTab === 'refunds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {refunds.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>Refund for Order #{r.orderId}</strong>
                  <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>📅 {r.date} • Ref: {r.id}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '16px', fontWeight: '800', color: '#16a34a' }}>+₹{r.amount}</span>
                  <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>To {r.source}</span>
                </div>
              </div>
              <div style={{ marginTop: '8px', background: '#ecfdf5', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', color: '#16a34a', fontWeight: '700', display: 'inline-block' }}>
                ● {r.status}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default Account;

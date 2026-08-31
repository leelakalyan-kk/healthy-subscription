import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';

const socket = io(window.location.origin, {
  transports: ['websocket', 'polling']
});

const COMMISSION_RATE = 0.10;

const SellerHome = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useContext(AuthContext);
  const activeUser = currentUser || JSON.parse(localStorage.getItem('active_user') || 'null');

  useEffect(() => {
    if (!activeUser || (activeUser.role && activeUser.role !== 'seller' && activeUser.role !== 'admin')) {
      navigate('/login');
    }
  }, [activeUser, navigate]);

  const [activeTab, setActiveTab] = useState('orders');
  const [orderFilter, setOrderFilter] = useState('ALL');

  const sellerDisplayName = activeUser?.username || activeUser?.name || 'Kitchen Partner';
  const sellerIdentifier = activeUser?._id || activeUser?.id || activeUser?.username || 'seller_1';

  const [isKitchenOnline, setIsKitchenOnline] = useState(() => {
    const saved = localStorage.getItem(`kitchen_online_${sellerIdentifier}`);
    return saved === null ? true : saved === 'true';
  });

  const [orders, setOrders] = useState([]);
  const [foods, setFoods] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payoutUpi, setPayoutUpi] = useState(activeUser?.email ? `${sellerDisplayName}@upi` : 'seller@upi');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [isTogglingKitchen, setIsTogglingKitchen] = useState(false);

  const [showAddDish, setShowAddDish] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [editingDishId, setEditingDishId] = useState(null);
  const [editFormData, setEditFormData] = useState({ price: '', description: '' });

  const [dish, setDish] = useState({
    title: '',
    description: '',
    price: '',
    protein: 'High Protein',
    imageUrl: '',
    sellerName: sellerDisplayName,
    branchName: 'Main Outlet',
    areaName: '',
    city: '',
    pincode: '',
    isAvailable: true
  });

  useEffect(() => {
    if (sellerDisplayName) {
      setDish(prev => ({ ...prev, sellerName: sellerDisplayName }));
    }
  }, [sellerDisplayName]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get(`/api/orders/seller-orders/${sellerIdentifier}`);
      if (Array.isArray(res.data)) setOrders(res.data);
    } catch (err) {
      console.error('Error fetching seller orders:', err);
    }
  }, [sellerIdentifier]);

  const fetchFoods = useCallback(async () => {
    try {
      const res = await axios.get(`/api/food/all`);
      if (Array.isArray(res.data)) {
        setFoods(res.data.map(f => ({ ...f, isAvailable: f.isAvailable !== false })));
      }
    } catch (err) {
      console.error('Error fetching foods:', err);
    }
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    try {
      const res = await axios.get(`/api/withdraw/history/${sellerIdentifier}`);
      if (Array.isArray(res.data)) setWithdrawals(res.data);
    } catch (err) {
      console.error('Error fetching withdrawals:', err);
    }
  }, [sellerIdentifier]);

  useEffect(() => {
    if (!activeUser) return;
    fetchOrders();
    fetchFoods();
    fetchWithdrawals();

    const interval = setInterval(() => {
      fetchOrders();
      fetchFoods();
      fetchWithdrawals();
    }, 3000);

    socket.on('new_order_placed', (order) => {
      setOrders((prev) => [order, ...prev.filter((o) => o._id !== order._id)]);
    });

    socket.on('order_status_updated', (updatedOrder) => {
      setOrders((prev) => prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o)));
    });

    socket.on('food_added', (newDish) => {
      setFoods((prev) => [newDish, ...prev.filter((f) => f._id !== newDish._id)]);
    });

    socket.on('food_updated', (updatedDish) => {
      setFoods((prev) => prev.map((f) => (f._id === updatedDish._id ? updatedDish : f)));
    });

    socket.on('foods_bulk_updated', (allFoods) => {
      if (Array.isArray(allFoods)) setFoods(allFoods);
    });

    socket.on('food_deleted', (deletedId) => {
      setFoods((prev) => prev.filter((f) => f._id !== deletedId));
    });

    socket.on('withdrawal_requested', (w) => {
      setWithdrawals(prev => [w, ...prev.filter(item => item._id !== w._id)]);
    });

    return () => {
      clearInterval(interval);
      socket.off('new_order_placed');
      socket.off('order_status_updated');
      socket.off('food_added');
      socket.off('food_updated');
      socket.off('foods_bulk_updated');
      socket.off('food_deleted');
      socket.off('withdrawal_requested');
    };
  }, [activeUser, fetchOrders, fetchFoods, fetchWithdrawals]);

  if (!activeUser) return null;

  const handleLogout = () => {
    if (logout) logout();
    localStorage.removeItem('active_user');
    localStorage.removeItem('token');
    navigate('/login');
  };

  const toggleKitchenOnline = async () => {
    const nextState = !isKitchenOnline;
    setIsTogglingKitchen(true);

    try {
      await axios.put(`/api/food/toggle-kitchen/${sellerIdentifier}`, { isOnline: nextState });
      setIsKitchenOnline(nextState);
      localStorage.setItem(`kitchen_online_${sellerIdentifier}`, nextState ? 'true' : 'false');
      alert(nextState ? '🟢 Kitchen is now OPEN! Dishes are available for orders.' : '⏸️ Kitchen is PAUSED. Customers cannot place orders.');
      fetchFoods();
    } catch (err) {
      alert('Failed to toggle kitchen status: ' + err.message);
    } finally {
      setIsTogglingKitchen(false);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await axios.put(`/api/orders/status/${orderId}`, { status: newStatus });
      if (res.data?.success) {
        setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, orderStatus: newStatus } : o)));
      }
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRequestWithdraw = async (e) => {
    e.preventDefault();
    if (!withdrawAmount || Number(withdrawAmount) <= 0) return alert('Please enter a valid payout amount');
    setIsSubmittingWithdraw(true);

    try {
      const res = await axios.post('/api/withdraw/request', {
        sellerId: sellerIdentifier,
        amount: Number(withdrawAmount),
        upiId: payoutUpi
      });

      if (res.data?.success) {
        setWithdrawals(prev => [res.data.withdrawal, ...prev]);
        setWithdrawAmount('');
        alert('✅ ₹' + res.data.withdrawal.amount + ' withdrawn successfully to ' + payoutUpi);
      }
    } catch (err) {
      alert('Withdrawal failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const stats = useMemo(() => {
    const validOrders = orders.filter(o => o.orderStatus !== 'Cancelled');

    let totalGrossSales = 0;
    let totalCommissionDeducted = 0;
    let totalNetEarned = 0;

    validOrders.forEach(o => {
      const itemsSubtotal = (o.items || []).reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0);
      const foodRevenue = itemsSubtotal > 0 ? itemsSubtotal : Number(o.itemTotal || o.totalAmount || 0);
      const commission = Math.round(foodRevenue * COMMISSION_RATE);
      const net = foodRevenue - commission;

      totalGrossSales += foodRevenue;
      totalCommissionDeducted += commission;
      totalNetEarned += net;
    });

    const totalWithdrawnAmount = withdrawals
      .filter(w => w.status !== 'Failed' && w.status !== 'Cancelled')
      .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

    const availableBalance = Math.max(0, totalNetEarned - totalWithdrawnAmount);
    const activeCount = orders.filter(o => ['Order Placed', 'Preparing', 'Ready for Pickup'].includes(o.orderStatus || 'Order Placed')).length;

    return {
      grossSales: totalGrossSales,
      commissionPaid: totalCommissionDeducted,
      netEarned: totalNetEarned,
      totalWithdrawn: totalWithdrawnAmount,
      available: availableBalance,
      active: activeCount,
      totalDishes: foods.length
    };
  }, [orders, foods, withdrawals]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const st = o.orderStatus || 'Order Placed';
      if (orderFilter === 'PLACED') return st === 'Order Placed';
      if (orderFilter === 'PREPARING') return st === 'Preparing';
      if (orderFilter === 'READY') return st === 'Ready for Pickup';
      if (orderFilter === 'COMPLETED') return ['Delivered', 'Completed', 'Cancelled'].includes(st);
      return true;
    });
  }, [orders, orderFilter]);

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDish(prev => ({ ...prev, imageUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddDish = async (e) => {
    e.preventDefault();
    if (!dish.title.trim()) return alert('Please enter dish title');
    if (!dish.price) return alert('Please enter price');
    if (!dish.areaName.trim()) return alert('Please enter Area / Locality');
    if (!dish.city.trim()) return alert('Please enter City');

    try {
      const res = await axios.post('/api/food/add', {
        title: dish.title.trim(),
        description: dish.description.trim(),
        price: Number(dish.price),
        protein: dish.protein,
        imageUrl: dish.imageUrl,
        sellerId: sellerIdentifier,
        sellerName: dish.sellerName || sellerDisplayName,
        branchName: dish.branchName || 'Main Kitchen',
        areaName: dish.areaName.trim(),
        city: dish.city.trim(),
        pincode: dish.pincode.trim()
      });

      if (res.data?.success) {
        setFoods(prev => [res.data.food, ...prev]);
        setShowAddDish(false);
        setDish({
          title: '',
          description: '',
          price: '',
          protein: 'High Protein',
          imageUrl: '',
          sellerName: sellerDisplayName,
          branchName: 'Main Kitchen',
          areaName: '',
          city: '',
          pincode: '',
          isAvailable: true
        });
        alert('✅ Dish published successfully!');
      }
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleToggleStock = async (dishId, currentStatus) => {
    try {
      const res = await axios.put(`/api/food/update/${dishId}`, { isAvailable: !currentStatus });
      if (res.data?.success) {
        setFoods(prev => prev.map(f => f._id === dishId ? { ...f, isAvailable: !currentStatus } : f));
      }
    } catch (err) {
      alert('Stock update failed: ' + err.message);
    }
  };

  const handleSaveEditDish = async (dishId) => {
    try {
      const res = await axios.put(`/api/food/update/${dishId}`, {
        price: Number(editFormData.price),
        description: editFormData.description
      });
      if (res.data?.success) {
        setFoods(prev => prev.map(f => f._id === dishId ? res.data.food : f));
        setEditingDishId(null);
        alert('✅ Dish updated successfully!');
      }
    } catch (err) {
      alert('Edit save failed: ' + err.message);
    }
  };

  const handleDeleteDish = async (id) => {
    if (!window.confirm('Delete this dish permanently?')) return;
    try {
      await axios.delete(`/api/food/${id}`);
      setFoods(foods.filter((f) => f._id !== id));
    } catch (err) {
      console.error('Error deleting food:', err);
    }
  };

  const getBadgeColors = (status) => {
    switch (status) {
      case 'Preparing':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
      case 'Ready for Pickup':
        return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
      case 'Delivered':
      case 'Completed':
        return { bg: '#ecfdf5', text: '#15803d', border: '#86efac' };
      case 'Cancelled':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
      default:
        return { bg: '#f1f5f9', text: '#15803d', border: '#86efac' };
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 14px', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{
        background: '#0f172a',
        color: '#fff',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', background: '#16a34a', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontWeight: '800' }}>
              VERIFIED PARTNER KITCHEN
            </span>
            <span style={{
              fontSize: '11px',
              background: isKitchenOnline ? '#22c55e' : '#ef4444',
              color: '#fff',
              padding: '3px 10px',
              borderRadius: '12px',
              fontWeight: '800'
            }}>
              {isKitchenOnline ? '🟢 KITCHEN ONLINE' : '🔴 OFFLINE'}
            </span>
          </div>
          <h2 style={{ margin: '8px 0 2px 0', fontSize: '22px', fontWeight: '800' }}>
            👨‍🍳 {sellerDisplayName} Operations Desk
          </h2>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            Live Kitchen Orders • 10% Flat Platform Commission Model
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={toggleKitchenOnline}
            disabled={isTogglingKitchen}
            style={{
              background: isKitchenOnline ? '#15803d' : '#b91c1c',
              color: '#ffffff',
              border: isKitchenOnline ? '1px solid #86efac' : '1px solid #f87171',
              padding: '8px 16px',
              borderRadius: '24px',
              fontWeight: '800',
              fontSize: '12px',
              cursor: isTogglingKitchen ? 'not-allowed' : 'pointer'
            }}
          >
            {isTogglingKitchen ? 'Updating...' : isKitchenOnline ? '⚡ Kitchen Online (Click to Pause)' : '⏸️ Kitchen Paused (Click to Open)'}
          </button>

          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            🚪 Exit
          </button>
        </div>
      </div>

      {/* Persistent Accounting Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px', borderRadius: '14px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>💰 TOTAL GROSS SALES</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>₹{stats.grossSales}</div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Lifetime volume</span>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #fed7aa', padding: '16px 18px', borderRadius: '14px' }}>
          <span style={{ fontSize: '12px', color: '#c2410c', fontWeight: '700' }}>📉 PLATFORM FEE (10%)</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#ea580c', marginTop: '4px' }}>- ₹{stats.commissionPaid}</div>
          <span style={{ fontSize: '11px', color: '#9a3412' }}>Service deduction</span>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '16px 18px', borderRadius: '14px' }}>
          <span style={{ fontSize: '12px', color: '#475569', fontWeight: '700' }}>💸 TOTAL PAID OUT</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#334155', marginTop: '4px' }}>₹{stats.totalWithdrawn}</div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Settled to bank/UPI</span>
        </div>

        <div style={{ background: stats.available > 0 ? '#ecfdf5' : '#f8fafc', border: stats.available > 0 ? '2px solid #86efac' : '1px solid #e2e8f0', padding: '16px 18px', borderRadius: '14px' }}>
          <span style={{ fontSize: '12px', color: stats.available > 0 ? '#15803d' : '#64748b', fontWeight: '700' }}>⚡ AVAILABLE BALANCE</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: stats.available > 0 ? '#16a34a' : '#64748b', marginTop: '4px' }}>₹{stats.available}</div>
          <span style={{ fontSize: '11px', color: stats.available > 0 ? '#15803d' : '#94a3b8' }}>
            {stats.available === 0 ? '✓ All Settled' : 'Ready to Withdraw'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setActiveTab('orders'); setShowAddDish(false); }}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: activeTab === 'orders' ? '2px solid #16a34a' : '1px solid #cbd5e1',
              background: activeTab === 'orders' ? '#ecfdf5' : '#fff',
              color: activeTab === 'orders' ? '#16a34a' : '#475569',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            📥 Orders Desk ({orders.length})
          </button>
          <button
            onClick={() => { setActiveTab('menu'); setShowAddDish(false); }}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: activeTab === 'menu' ? '2px solid #16a34a' : '1px solid #cbd5e1',
              background: activeTab === 'menu' ? '#ecfdf5' : '#fff',
              color: activeTab === 'menu' ? '#16a34a' : '#475569',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            🍽️ Menu Management ({foods.length})
          </button>
          <button
            onClick={() => { setActiveTab('withdraw'); setShowAddDish(false); }}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: activeTab === 'withdraw' ? '2px solid #16a34a' : '1px solid #cbd5e1',
              background: activeTab === 'withdraw' ? '#ecfdf5' : '#fff',
              color: activeTab === 'withdraw' ? '#16a34a' : '#475569',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            💸 Withdraw & Payouts ({withdrawals.length})
          </button>
        </div>

        {activeTab === 'menu' && (
          <button
            onClick={() => setShowAddDish(!showAddDish)}
            style={{
              background: '#16a34a',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {showAddDish ? '✕ Close Form' : '➕ Add New Dish'}
          </button>
        )}
      </div>

      {/* 1. ORDERS TAB */}
      {activeTab === 'orders' && (
        <div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px' }}>
            {[
              { key: 'ALL', label: `All Orders (${orders.length})` },
              { key: 'PLACED', label: `🆕 New Placed (${orders.filter(o => (o.orderStatus || 'Order Placed') === 'Order Placed').length})` },
              { key: 'PREPARING', label: `👨‍🍳 In Kitchen (${orders.filter(o => o.orderStatus === 'Preparing').length})` },
              { key: 'READY', label: `📦 Ready for Pickup (${orders.filter(o => o.orderStatus === 'Ready for Pickup').length})` },
              { key: 'COMPLETED', label: `Past Completed / Cancelled` }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setOrderFilter(tab.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: orderFilter === tab.key ? '2px solid #0f172a' : '1px solid #cbd5e1',
                  background: orderFilter === tab.key ? '#0f172a' : '#ffffff',
                  color: orderFilter === tab.key ? '#ffffff' : '#475569',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', background: '#fff', borderRadius: '14px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '8px' }}>🍲</span>
                <h4 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>No orders in this category</h4>
              </div>
            ) : (
              filteredOrders.map((o) => {
                const badge = getBadgeColors(o.orderStatus);
                const itemsSubtotal = (o.items || []).reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0);
                const foodGross = itemsSubtotal > 0 ? itemsSubtotal : Number(o.itemTotal || o.totalAmount || 0);
                const commission = Math.round(foodGross * COMMISSION_RATE);
                const sellerNetPayout = foodGross - commission;

                return (
                  <div
                    key={o._id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '10px' }}>
                      <div>
                        <strong style={{ fontSize: '16px', color: '#0f172a' }}>Order #{(o._id || '').slice(-6).toUpperCase()}</strong>
                        <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>
                          Customer: <strong style={{ color: '#0f172a' }}>{o.customerName || 'Customer'}</strong>
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a' }}>₹{sellerNetPayout}</span>
                        <span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>
                          (Gross: ₹{foodGross} - 10% Comm: ₹{commission})
                        </span>
                        <span style={{ display: 'inline-block', fontSize: '11px', background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`, padding: '2px 8px', borderRadius: '10px', fontWeight: '700', marginTop: '2px' }}>
                          ● {o.orderStatus || 'Order Placed'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                      {o.items?.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155' }}>
                          <span>🥗 <strong>{item.title}</strong> (x{item.qty})</span>
                          <span style={{ fontWeight: '600', color: '#475569' }}>₹{item.price * item.qty}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
                      <strong>📍 Delivery Address:</strong> {o.deliveryAddress || 'Saved Customer Location'}
                    </div>

                    <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>Set Kitchen Status:</span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleUpdateStatus(o._id, 'Preparing')}
                          disabled={updatingId === o._id}
                          style={{ background: '#fef3c7', color: '#92400e', border: o.orderStatus === 'Preparing' ? '2px solid #f59e0b' : '1px solid #fde68a', padding: '7px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '11px', cursor: 'pointer' }}
                        >
                          👨‍🍳 Accept & Prepare
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(o._id, 'Ready for Pickup')}
                          disabled={updatingId === o._id}
                          style={{ background: '#e0f2fe', color: '#075985', border: o.orderStatus === 'Ready for Pickup' ? '2px solid #0284c7' : '1px solid #bae6fd', padding: '7px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '11px', cursor: 'pointer' }}
                        >
                          📦 Ready for Pickup
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(o._id, 'Cancelled')}
                          disabled={updatingId === o._id}
                          style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #ef4444', padding: '7px 10px', borderRadius: '8px', fontWeight: '800', fontSize: '11px', cursor: 'pointer' }}
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 2. MENU MANAGEMENT TAB */}
      {activeTab === 'menu' && (
        <div>
          {showAddDish && (
            <form onSubmit={handleAddDish} style={{ background: '#ffffff', border: '2px solid #16a34a', borderRadius: '14px', padding: '20px', marginBottom: '22px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>➕ Add New Dish</h4>

              <div style={{ marginBottom: '14px' }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Category:</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['High Protein', 'Salad', 'Keto', 'Bowl'].map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setDish({ ...dish, protein: cat })}
                      style={{
                        padding: '6px 18px',
                        borderRadius: '20px',
                        border: dish.protein === cat ? '2px solid #16a34a' : '1px solid #cbd5e1',
                        background: dish.protein === cat ? '#ecfdf5' : '#f8fafc',
                        color: dish.protein === cat ? '#16a34a' : '#475569',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Brand / Kitchen Name *</label>
                  <input
                    type="text"
                    value={dish.sellerName}
                    onChange={(e) => setDish({ ...dish, sellerName: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Branch / Outlet Name *</label>
                  <input
                    type="text"
                    value={dish.branchName}
                    onChange={(e) => setDish({ ...dish, branchName: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Dish Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Quinoa Veggie Bowl"
                    value={dish.title}
                    onChange={(e) => setDish({ ...dish, title: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Price (₹) *</label>
                  <input
                    type="number"
                    placeholder="₹ 180"
                    value={dish.price}
                    onChange={(e) => setDish({ ...dish, price: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Description *</label>
                <textarea
                  placeholder="Ingredients and nutritional info"
                  value={dish.description}
                  onChange={(e) => setDish({ ...dish, description: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box', minHeight: '60px' }}
                  required
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                  📍 Kitchen Location Details:
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#475569', fontWeight: '700', display: 'block', marginBottom: '2px' }}>Area / Locality *</label>
                    <input
                      type="text"
                      placeholder="e.g. Brigade Road"
                      value={dish.areaName}
                      onChange={e => setDish({ ...dish, areaName: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#475569', fontWeight: '700', display: 'block', marginBottom: '2px' }}>City *</label>
                    <input
                      type="text"
                      placeholder="e.g. Bengaluru"
                      value={dish.city}
                      onChange={e => setDish({ ...dish, city: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#475569', fontWeight: '700', display: 'block', marginBottom: '2px' }}>PIN Code</label>
                    <input
                      type="text"
                      maxLength="6"
                      placeholder="560001"
                      value={dish.pincode}
                      onChange={e => setDish({ ...dish, pincode: e.target.value })}
                      style={{ width: '100%', padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px dashed #94a3b8' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  📷 Upload Dish Image:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  style={{ fontSize: '12px', color: '#475569' }}
                />
                {dish.imageUrl && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={dish.imageUrl} alt="Preview" style={{ width: '70px', height: '55px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #16a34a' }} />
                    <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700' }}>✅ Photo selected</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                style={{
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                💾 Publish Dish
              </button>
            </form>
          )}

          {/* Dish List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {foods.map((f) => {
              const isEditing = editingDishId === f._id;
              const locationStr = [f.areaName, f.city].filter(Boolean).join(', ') || 'Local Hub';
              return (
                <div
                  key={f._id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    opacity: f.isAvailable ? 1 : 0.75
                  }}
                >
                  <div style={{ position: 'relative', height: '140px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {f.imageUrl ? (
                      <img src={f.imageUrl} alt={f.title} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '42px' }}>🥗</span>
                    )}
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      background: f.isAvailable ? '#16a34a' : '#ef4444',
                      color: '#ffffff',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      {f.isAvailable ? 'IN STOCK' : 'OUT OF STOCK'}
                    </div>
                  </div>

                  <div style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '15px', color: '#0f172a' }}>{f.title}</strong>
                      {!isEditing ? (
                        <span style={{ fontWeight: '800', color: '#16a34a', fontSize: '16px' }}>₹{f.price}</span>
                      ) : (
                        <input
                          type="number"
                          value={editFormData.price}
                          onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                          style={{ width: '70px', padding: '4px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                      )}
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                      📍 {locationStr} {f.pincode ? `(${f.pincode})` : ''}
                    </div>

                    {!isEditing ? (
                      <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                        {f.description}
                      </p>
                    ) : (
                      <textarea
                        value={editFormData.description}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        style={{ width: '100%', padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', marginBottom: '10px' }}
                      />
                    )}

                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        onClick={() => handleToggleStock(f._id, f.isAvailable)}
                        style={{
                          background: f.isAvailable ? '#fef2f2' : '#ecfdf5',
                          color: f.isAvailable ? '#dc2626' : '#16a34a',
                          border: `1px solid ${f.isAvailable ? '#fca5a5' : '#86efac'}`,
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        {f.isAvailable ? '⏸️ Mark as Out of Stock' : '✅ Mark as In Stock'}
                      </button>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {!isEditing ? (
                          <button
                            onClick={() => {
                              setEditingDishId(f._id);
                              setEditFormData({ price: f.price, description: f.description });
                            }}
                            style={{ flex: 1, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '5px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            ✏️ Edit Price
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSaveEditDish(f._id)}
                            style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', padding: '5px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            💾 Save
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteDish(f._id)}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. WITHDRAW & PAYOUTS TAB */}
      {activeTab === 'withdraw' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#ffffff', border: '2px solid #16a34a', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              💸 Request Kitchen Revenue Payout
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Transfer your remaining net earned revenue directly to your UPI ID.
            </p>

            <form onSubmit={handleRequestWithdraw} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr', gap: '12px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Payout Amount (₹) *
                </label>
                <input
                  type="number"
                  placeholder={`Max ₹${stats.available}`}
                  value={withdrawAmount}
                  max={stats.available > 0 ? stats.available : 0}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Receiver UPI ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. kitchen@upi"
                  value={payoutUpi}
                  onChange={e => setPayoutUpi(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmittingWithdraw || stats.available <= 0}
                  style={{
                    width: '100%',
                    background: stats.available > 0 ? '#16a34a' : '#94a3b8',
                    color: '#ffffff',
                    border: 'none',
                    padding: '11px',
                    borderRadius: '8px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: stats.available > 0 ? 'pointer' : 'not-allowed'
                  }}
                >
                  {isSubmittingWithdraw ? 'Processing...' : '⚡ Instant Withdraw'}
                </button>
              </div>
            </form>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              📑 Payouts & Settlement History ({withdrawals.length})
            </h4>

            {withdrawals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
                <span>No withdrawal payouts requested yet.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {withdrawals.map((w) => (
                  <div
                    key={w._id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 16px',
                      background: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                        Ref #{w.referenceId || (w._id || '').slice(-6).toUpperCase()}
                      </strong>
                      <span style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Transfer to: <strong>{w.payoutDetails || 'UPI ID'}</strong> • {new Date(w.requestedAt || Date.now()).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: '#16a34a' }}>
                        ₹{w.amount}
                      </span>
                      <span style={{ display: 'block', fontSize: '11px', background: '#ecfdf5', color: '#16a34a', padding: '2px 8px', borderRadius: '10px', fontWeight: '700', marginTop: '3px' }}>
                        ● {w.status || 'Completed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};

export default SellerHome;

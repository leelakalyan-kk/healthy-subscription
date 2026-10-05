import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';
import RiderApprovals from './RiderApprovals';

const socket = io(window.location.origin, {
  transports: ['websocket', 'polling']
});

const COMMISSION_RATE = 0.10;
const PLATFORM_FEE_PER_ORDER = 5;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useContext(AuthContext);
  const activeUser = currentUser || JSON.parse(localStorage.getItem('active_user') || 'null');

  const isSuperAdmin = activeUser?.role === 'admin' || activeUser?.username === 'admin';
  const isHelpdeskAgent = activeUser?.role === 'helpdesk';

  useEffect(() => {
    if (!activeUser || (!isSuperAdmin && !isHelpdeskAgent)) {
      navigate('/admin-login');
    }
  }, [activeUser, isSuperAdmin, isHelpdeskAgent, navigate]);

  const [activePage, setActivePage] = useState(isHelpdeskAgent ? 'Orders & Support' : 'Overview');
  const [orderFilter, setOrderFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [exported, setExported] = useState(false);
  const [trendDays, setTrendDays] = useState(7);

  // Modals & Actions
  const [selectedSupportOrder, setSelectedSupportOrder] = useState(null);
  const [supportActionType, setSupportActionType] = useState('CANCEL_AND_REFUND');
  const [refundReason, setRefundReason] = useState('Food quality / transit spill');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [adminWithdrawAmt, setAdminWithdrawAmt] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffFormData, setStaffFormData] = useState({ username: '', password: '', agentName: '', phone: '' });
  const [staffList, setStaffList] = useState([]);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  const [resetTargetStaff, setResetTargetStaff] = useState(null);
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [isResettingPass, setIsResettingPass] = useState(false);

  const [orders, setOrders] = useState([]);
  const [foods, setFoods] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [riderSettlements, setRiderSettlements] = useState([]);

  const fetchAllData = useCallback(async () => {
    try {
      const [ordersRes, foodsRes, withdrawRes, staffRes, fleetRes, ticketsRes] = await Promise.all([
        axios.get('/api/orders/seller-orders/all').catch(() => ({ data: [] })),
        axios.get('/api/food/all').catch(() => ({ data: [] })),
        axios.get('/api/withdraw/history/all').catch(() => ({ data: [] })),
        axios.get('/api/auth/helpdesk-list').catch(() => ({ data: [] })),
        axios.get('/api/withdraw/rider-fleet-summary').catch(() => ({ data: {} })),
        axios.get('/api/extra/support/tickets/all').catch(() => ({ data: [] }))
      ]);

      if (Array.isArray(ordersRes.data)) setOrders(ordersRes.data);
      if (Array.isArray(foodsRes.data)) setFoods(foodsRes.data);
      if (Array.isArray(withdrawRes.data)) setWithdrawals(withdrawRes.data);
      if (Array.isArray(staffRes.data)) setStaffList(staffRes.data);
      if (fleetRes.data?.settlements) setRiderSettlements(fleetRes.data.settlements);
      if (Array.isArray(ticketsRes.data)) setSupportTickets(ticketsRes.data);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);

    socket.on('new_order_placed', (o) => setOrders(prev => [o, ...prev.filter(x => x._id !== o._id)]));
    socket.on('order_status_updated', (u) => setOrders(prev => prev.map(o => o._id === u._id ? u : o)));
    socket.on('food_added', (f) => setFoods(prev => [f, ...prev.filter(x => x._id !== f._id)]));
    socket.on('kitchen_status_changed', ({ sellerId, isOnline }) => {
      setFoods(prev => prev.map(f => String(f.sellerId) === String(sellerId) ? { ...f, isAvailable: isOnline } : f));
    });
    socket.on('withdrawal_requested', (w) => setWithdrawals(prev => [w, ...prev.filter(x => x._id !== w._id)]));
    socket.on('new_support_ticket', (t) => setSupportTickets(prev => [t, ...prev.filter(x => x._id !== t._id)]));

    return () => {
      clearInterval(interval);
      socket.off('new_order_placed');
      socket.off('order_status_updated');
      socket.off('food_added');
      socket.off('kitchen_status_changed');
      socket.off('withdrawal_requested');
      socket.off('new_support_ticket');
    };
  }, [fetchAllData]);

  const stats = useMemo(() => {
    const validOrders = orders.filter(o => o.orderStatus !== 'Cancelled');
    const cancelledOrders = orders.filter(o => o.orderStatus === 'Cancelled');

    const gmv = validOrders.reduce((sum, o) => {
      const itSub = (o.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 1)), 0);
      return sum + Number(o.totalAmount || o.itemTotal || itSub || 0);
    }, 0);

    const commission = Math.round(gmv * COMMISSION_RATE);
    const platformFees = validOrders.length * PLATFORM_FEE_PER_ORDER;
    const totalPlatformProfit = commission + platformFees;

    const adminWithdrawn = withdrawals
      .filter(w => (w.type === 'ADMIN_PROFIT_WITHDRAW' || w.sellerId === 'COMPANY_ADMIN') && w.status !== 'Failed')
      .reduce((sum, w) => sum + Number(w.amount || 0), 0);

    const availableCorporateBalance = Math.max(0, totalPlatformProfit - adminWithdrawn);

    const activeProcessing = orders.filter(o => ['Order Placed', 'Preparing', 'Ready for Pickup', 'Rider Assigned', 'Out for Delivery'].includes(o.orderStatus)).length;
    const cancellationRate = orders.length > 0 ? ((cancelledOrders.length / orders.length) * 100).toFixed(1) : '0.0';

    const kitchenMap = new Map();
    foods.forEach(f => {
      const name = (f.sellerName || 'Kitchen Partner').trim();
      const sId = String(f.sellerId || 'tests').trim();

      if (!kitchenMap.has(name)) {
        kitchenMap.set(name, {
          name,
          sellerIds: new Set([sId]),
          area: f.areaName || f.city || 'Local Area',
          city: f.city || 'Vijayawada',
          isOnline: f.isAvailable !== false,
          ordersCount: 0,
          totalSales: 0,
          rating: '4.9'
        });
      } else {
        kitchenMap.get(name).sellerIds.add(sId);
      }
    });

    validOrders.forEach(o => {
      const ordSellerId = String(o.sellerId || '').trim();
      const ordSellerName = String(o.items && o.items[0]?.sellerName || '').trim();
      const itSub = (o.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 1)), 0);
      const amount = Number(o.totalAmount || o.itemTotal || itSub || 0);

      let matched = false;
      for (const [name, kData] of kitchenMap.entries()) {
        if (name === ordSellerName || kData.sellerIds.has(ordSellerId) || (o.items || []).some(it => kData.sellerIds.has(String(it.sellerId || '')))) {
          kData.totalSales += amount;
          kData.ordersCount += 1;
          matched = true;
          break;
        }
      }
      if (!matched && kitchenMap.size > 0) {
        const first = kitchenMap.values().next().value;
        first.totalSales += amount;
        first.ordersCount += 1;
      }
    });

    return {
      gmv,
      totalPlatformProfit,
      availableCorporateBalance,
      totalOrders: orders.length,
      activeProcessing,
      cancelledCount: cancelledOrders.length,
      cancellationRate,
      kitchensList: Array.from(kitchenMap.values())
    };
  }, [orders, foods, withdrawals]);

  const handleToggleKitchenStatus = async (sellerId, currentOnline) => {
    try {
      const nextState = !currentOnline;
      await axios.put(`/api/food/toggle-kitchen/${sellerId}`, { isOnline: nextState });
      fetchAllData();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const handleExecuteSupportAction = async (e) => {
    e.preventDefault();
    if (!selectedSupportOrder) return;
    setIsProcessingAction(true);
    try {
      const res = await axios.put(`/api/orders/support-action/${selectedSupportOrder._id}`, {
        action: supportActionType,
        refundAmount: selectedSupportOrder.totalAmount,
        reason: refundReason
      });
      if (res.data?.success) {
        alert('✅ Action executed!');
        setSelectedSupportOrder(null);
        fetchAllData();
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleAdminWithdrawProfit = async (e) => {
    e.preventDefault();
    const amt = Number(adminWithdrawAmt);
    if (!amt || amt <= 0 || amt > stats.availableCorporateBalance) return alert('Enter valid amount');
    setIsProcessingWithdraw(true);
    try {
      const res = await axios.post('/api/withdraw/admin-withdraw', {
        amount: amt,
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        accountHolder: accountHolder.trim()
      });
      if (res.data?.success) {
        setWithdrawals(prev => [res.data.withdrawal, ...prev]);
        setAdminWithdrawAmt('');
        alert(`✅ ₹${amt} transferred to bank!`);
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setIsProcessingWithdraw(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    const cleanPhone = String(staffFormData.phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return alert('Phone must be 10 digits');
    setIsCreatingStaff(true);
    try {
      const res = await axios.post('/api/auth/create-helpdesk', staffFormData);
      if (res.data?.success) {
        setStaffList(prev => [res.data.staff, ...prev]);
        setStaffFormData({ username: '', password: '', agentName: '', phone: '' });
        setShowAddStaff(false);
        alert('Agent created');
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setIsCreatingStaff(false);
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm('Delete this agent?')) return;
    try {
      await axios.delete(`/api/auth/helpdesk/${staffId}`);
      setStaffList(prev => prev.filter(s => s._id !== staffId));
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

  const handleSaveResetPassword = async (e) => {
    e.preventDefault();
    if (!newAgentPassword.trim() || !resetTargetStaff) return;
    setIsResettingPass(true);
    try {
      await axios.put('/api/auth/helpdesk-reset-password', {
        staffId: resetTargetStaff._id,
        newPassword: newAgentPassword
      });
      alert('Password updated');
      setResetTargetStaff(null);
      setNewAgentPassword('');
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setIsResettingPass(false);
    }
  };

  const handleExportReport = () => {
    setExported(true);
    let csv = "Order ID,Customer Name,Phone,Delivery Address,Total (INR),Commission (10%),Status,Time\n";
    orders.forEach(o => {
      const shortId = (o._id || '').slice(-6).toUpperCase();
      const amt = Number(o.totalAmount || o.itemTotal || 0);
      csv += `"${shortId}","${o.customerName || 'Customer'}","${o.customerPhone || '18002022026'}","${(o.deliveryAddress || '').replace(/"/g, '""')}","${amt}","${Math.round(amt * 0.1)}","${o.orderStatus || 'Placed'}","${new Date(o.createdAt || Date.now()).toLocaleString()}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `HealthyBites_Report_${Date.now()}.csv`;
    link.click();
    setTimeout(() => setExported(false), 2000);
  };

  const trendChartData = useMemo(() => {
    const daysArr = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      daysArr.push({
        dateStr: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
        rawDate: d.toDateString(),
        revenue: 0,
        orders: 0
      });
    }
    orders.forEach(o => {
      const oDate = new Date(o.createdAt || Date.now()).toDateString();
      const matched = daysArr.find(item => item.rawDate === oDate);
      if (matched && o.orderStatus !== 'Cancelled') {
        matched.revenue += Number(o.totalAmount || o.itemTotal || 0);
        matched.orders += 1;
      }
    });
    const maxRev = Math.max(...daysArr.map(d => d.revenue), 500);
    const maxOrders = Math.max(...daysArr.map(d => d.orders), 5);
    return daysArr.map(item => ({
      ...item,
      revHeight: Math.min(100, Math.max(16, Math.round((item.revenue / maxRev) * 90))),
      orderHeight: Math.min(100, Math.max(12, Math.round((item.orders / maxOrders) * 75)))
    }));
  }, [orders, trendDays]);

  const visibleOrders = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter(order => {
      const shortId = (order._id || '').slice(-6).toLowerCase();
      const cust = (order.customerName || '').toLowerCase();
      const matchesSearch = !q || shortId.includes(q) || cust.includes(q);
      if (orderFilter === 'Live') return matchesSearch && ['Order Placed', 'Preparing', 'Ready for Pickup', 'Out for Delivery'].includes(order.orderStatus);
      if (orderFilter === 'Delivered') return matchesSearch && ['Delivered', 'Completed', 'Settled'].includes(order.orderStatus);
      if (orderFilter === 'Cancelled') return matchesSearch && order.orderStatus === 'Cancelled';
      return matchesSearch;
    });
  }, [orders, orderFilter, search]);

  const navigation = useMemo(() => {
    if (isHelpdeskAgent) {
      return [
        { label: "Orders & Support", icon: "📦" },
        { label: "Restaurants", icon: "👨‍🍳" }
      ];
    }
    return [
      { label: "Overview", icon: "🎛️" },
      { label: "Orders & Support", icon: "📦" },
      { label: "Restaurants", icon: "👨‍🍳" },
      { label: "Delivery Fleet (KYC & COD)", icon: "🛵" },
      { label: "Corporate Banking & Payouts", icon: "💰" },
      { label: "Helpdesk & Roles", icon: "👥" }
    ];
  }, [isHelpdeskAgent]);

  return (
    <div style={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', background: '#0b0e11', color: '#f1f5f9', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', fontFamily: '"Space Grotesk", sans-serif', boxSizing: 'border-box' }}>

      {/* 1. SIDEBAR (Fully Responsive) */}
      <aside style={{ width: '240px', minWidth: '220px', background: '#090c0f', borderRight: '1px solid #1e293b', padding: '16px 12px', display: 'flex', flexDirection: 'column', flexShrink: 0, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px 24px 8px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '16px' }}>H</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff' }}>HealthyBites</div>
            <div style={{ fontSize: '10px', color: isSuperAdmin ? '#22c55e' : '#38bdf8', fontFamily: 'monospace' }}>
              {isSuperAdmin ? 'SUPER ADMIN CONSOLE' : 'SUPPORT HELPDESK'}
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navigation.map((item) => (
            <button
              key={item.label}
              onClick={() => setActivePage(item.label)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px', borderRadius: '8px',
                border: activePage === item.label ? '1px solid #334155' : '1px solid transparent',
                background: activePage === item.label ? '#1e293b' : 'transparent',
                color: activePage === item.label ? '#22c55e' : '#94a3b8',
                fontWeight: '700', fontSize: '13px', textAlign: 'left', cursor: 'pointer'
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', background: '#131920', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px' }}>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>{isSuperAdmin ? 'Platform Admin' : 'Agent'}</span>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>{activeUser?.username || 'Admin'}</div>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("auth_token");
              localStorage.removeItem("active_user");
              if (logout) logout();
              navigate('/admin-login', { replace: true });
            }}
            style={{ marginTop: '10px', width: '100%', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '7px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
          >
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* 2. MAIN OPERATIONS AREA (Full-Width Responsive Auto-Flow) */}
      <main style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <header style={{ borderBottom: '1px solid #1e293b', background: 'rgba(15, 23, 42, 0.95)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', position: 'sticky', top: 0, zIndex: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>{activePage}</h1>
            <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>Real-time Operations Engine</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#131920', border: '1px solid #1e293b', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
              <span>{stats.activeProcessing} Active Processing</span>
            </div>

            {isSuperAdmin && (
              <button onClick={handleExportReport} style={{ background: '#22c55e', color: '#052e16', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}>
                📥 {exported ? 'Exported' : 'Export CSV (Audit & GST)'}
              </button>
            )}
          </div>
        </header>

        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>

          {/* KPI CARDS */}
          {isSuperAdmin && (
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#131920', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px 18px' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', fontFamily: 'monospace' }}>GROSS MERCHANDISE VALUE (GMV)</span>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#ffffff', marginTop: '6px', fontFamily: 'monospace' }}>₹{stats.gmv}</div>
                <span style={{ fontSize: '11px', color: '#22c55e', fontFamily: 'monospace' }}>▲ Total platform billing</span>
              </div>

              <div style={{ background: '#131920', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: '12px', padding: '16px 18px' }}>
                <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '800', fontFamily: 'monospace' }}>NET COMMISSION & FEES</span>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#22c55e', marginTop: '6px', fontFamily: 'monospace' }}>₹{stats.totalPlatformProfit}</div>
                <span style={{ fontSize: '11px', color: '#86efac', fontFamily: 'monospace' }}>10% Pct + ₹5 Order Surcharges</span>
              </div>

              <div style={{ background: '#131920', border: '1px solid #38bdf8', borderRadius: '12px', padding: '16px 18px' }}>
                <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '800', fontFamily: 'monospace' }}>WITHDRAWABLE CORPORATE BALANCE</span>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#38bdf8', marginTop: '6px', fontFamily: 'monospace' }}>₹{stats.availableCorporateBalance}</div>
                <span style={{ fontSize: '11px', color: '#7dd3fc', fontFamily: 'monospace' }}>Net Profit Ready for Bank</span>
              </div>

              <div style={{ background: '#131920', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px 18px' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', fontFamily: 'monospace' }}>TOTAL ORDERS & VOLUME</span>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#ffffff', marginTop: '6px', fontFamily: 'monospace' }}>{stats.totalOrders}</div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>Cancelled: {stats.cancelledCount} ({stats.cancellationRate}%)</span>
              </div>
            </section>
          )}

          {/* TAB: OVERVIEW */}
          {activePage === 'Overview' && isSuperAdmin && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
              <div style={{ background: '#131920', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>Revenue & Volume Trend</h3>
                    <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>Turnover ₹ (Green) vs Orders (Gray)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[7, 30].map(d => (
                      <button
                        key={d}
                        onClick={() => setTrendDays(d)}
                        style={{ background: trendDays === d ? '#22c55e' : '#1e293b', color: trendDays === d ? '#052e16' : '#94a3b8', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        {d} Days
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ position: 'relative', height: '210px', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '10px 4px 0 4px', borderBottom: '1px solid #1e293b', overflow: 'hidden' }}>
                  {trendChartData.map((item, idx) => (
                    <div key={idx} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: trendDays === 30 ? '2px' : '4px', minWidth: 0 }}>
                      <div title={`${item.rawDate} - ₹${item.revenue}`} style={{ width: trendDays === 30 ? '5px' : '14px', height: `${item.revHeight}%`, background: '#22c55e', borderRadius: '2px 2px 0 0', flexShrink: 0 }} />
                      <div title={`${item.rawDate} - ${item.orders} Orders`} style={{ width: trendDays === 30 ? '5px' : '14px', height: `${item.orderHeight}%`, background: '#475569', borderRadius: '2px 2px 0 0', flexShrink: 0 }} />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', padding: '0 4px', fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                  {trendChartData.map((item, idx) => {
                    const shouldShow = trendDays === 7 || idx % 5 === 0 || idx === trendChartData.length - 1;
                    return (
                      <span key={idx} style={{ flex: 1, textAlign: 'center', visibility: shouldShow ? 'visible' : 'hidden' }}>
                        {trendDays === 30 ? item.dateStr.split(' ')[1] : item.dateStr}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div style={{ background: '#131920', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>Live Kitchen Stream</h3>
                  <span style={{ fontSize: '10px', color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)', padding: '2px 8px', borderRadius: '10px', fontWeight: '800' }}>● REALTIME</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '230px' }}>
                  {orders.slice(0, 5).map((o, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#0b0e11', borderRadius: '8px', border: '1px solid #1e293b' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#ffffff', display: 'block' }}>{(o.items && o.items[0]?.sellerName) || o.sellerId || 'tests'}</strong>
                        <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>#{(o._id || '').slice(-6).toUpperCase()} · ₹{o.totalAmount}</span>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '800', fontFamily: 'monospace', padding: '2px 8px', borderRadius: '6px', color: '#22c55e', background: 'rgba(34,197,94,0.1)' }}>
                        {o.orderStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ORDERS & SUPPORT DESK */}
          {activePage === 'Orders & Support' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#131920', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '17px', color: '#ffffff' }}>Customer Support Desk & Order Lookup</h2>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Search caller by 6-Digit Order ID, Phone number, Customer Name or Address</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['All', 'Live', 'Delivered', 'Cancelled'].map(flt => (
                      <button
                        key={flt}
                        onClick={() => setOrderFilter(flt)}
                        style={{ background: orderFilter === flt ? '#22c55e' : '#0b0e11', color: orderFilter === flt ? '#052e16' : '#94a3b8', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        {flt}
                      </button>
                    ))}
                    <input
                      type="text"
                      placeholder="🔍 Search Order ID, Name..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ background: '#0b0e11', border: '1px solid #334155', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', width: '220px', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {visibleOrders.map(o => (
                    <div key={o._id} style={{ background: '#0b0e11', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', color: '#22c55e', fontWeight: '800', fontFamily: 'monospace' }}>#{(o._id || '').slice(-6).toUpperCase()}</span>
                          <strong style={{ fontSize: '14px', color: '#ffffff' }}>• {o.customerName || 'Customer'}</strong>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>({o.customerPhone || 'No contact'})</span>
                          <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>OTP: {o.deliveryOtp || '----'}</span>
                        </div>
                        <span style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '3px' }}>📍 {o.deliveryAddress}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <strong style={{ fontSize: '16px', color: '#fff', fontFamily: 'monospace' }}>₹{o.totalAmount}</strong>
                        <span style={{ fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '6px', color: o.orderStatus === 'Delivered' ? '#22c55e' : o.orderStatus === 'Cancelled' ? '#ef4444' : '#fbbf24', background: 'rgba(255,255,255,0.06)' }}>
                          ● {o.orderStatus}
                        </span>
                        <button
                          onClick={() => setSelectedSupportOrder(o)}
                          style={{ background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', padding: '7px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          ⚡ Support Override
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Support Tickets Queue */}
              <div style={{ background: '#131920', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#ffffff' }}>🎧 Support Tickets Queue</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Assistance tickets raised by Customers & Kitchen Sellers</span>
                  </div>
                  <span style={{ fontSize: '11px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '3px 8px', borderRadius: '6px', fontWeight: '800' }}>
                    {supportTickets.filter(t => t.status === 'OPEN').length} Open
                  </span>
                </div>

                {supportTickets.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No active customer or kitchen tickets.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {supportTickets.map(t => (
                      <div key={t._id} style={{ background: '#0b0e11', border: t.status === 'OPEN' ? '1px solid #38bdf8' : '1px solid #1e293b', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: '800', background: t.senderRole === 'seller' ? '#fef3c7' : '#e0f2fe', color: t.senderRole === 'seller' ? '#92400e' : '#0369a1', padding: '2px 6px', borderRadius: '4px' }}>
                            {t.senderRole === 'seller' ? '👨‍🍳 KITCHEN' : '👤 CUSTOMER'}
                          </span>
                          <strong style={{ fontSize: '13px', color: '#fff', marginLeft: '8px' }}>{t.senderName} ({t.senderContact})</strong>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#cbd5e1' }}><strong>Issue:</strong> [{t.issueType}] {t.message}</p>
                        </div>
                        {t.status === 'OPEN' ? (
                          <button
                            onClick={async () => {
                              await axios.put(`/api/extra/support/ticket/resolve/${t._id}`);
                              setSupportTickets(prev => prev.map(item => item._id === t._id ? { ...item, status: 'RESOLVED' } : item));
                            }}
                            style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                          >
                            ✓ Mark Resolved
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>● Resolved</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: RESTAURANTS */}
          {activePage === 'Restaurants' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {stats.kitchensList.map((k, idx) => (
                <div key={idx} style={{ background: '#131920', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '16px', color: '#ffffff' }}>👨‍🍳 {k.name}</strong>
                      <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '12px', color: k.isOnline ? '#22c55e' : '#ef4444', background: k.isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
                        {k.isOnline ? 'ONLINE' : 'PAUSED'}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#94a3b8' }}>📍 Hub: {k.area}, {k.city}</p>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8' }}>📦 Orders: <strong>{k.ordersCount}</strong></p>
                    <div style={{ fontSize: '16px', color: '#22c55e', fontWeight: '900', fontFamily: 'monospace' }}>
                      Gross Sales: ₹{k.totalSales}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #1e293b', paddingTop: '14px', marginTop: '14px' }}>
                    <button
                      onClick={() => handleToggleKitchenStatus(Array.from(k.sellerIds)[0], k.isOnline)}
                      style={{ width: '100%', background: k.isOnline ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: k.isOnline ? '#f87171' : '#86efac', border: `1px solid ${k.isOnline ? '#ef4444' : '#22c55e'}`, padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      {k.isOnline ? '⏸️ Pause Kitchen Orders' : '▶️ Resume Kitchen Online'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: DELIVERY FLEET */}
          {activePage === 'Delivery Fleet (KYC & COD)' && isSuperAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#131920', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px' }}>
                <RiderApprovals />
              </div>
              <div style={{ background: '#131920', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#ffffff' }}>COD Deposit & Settlement Audit Trail</h3>
                {riderSettlements.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '13px' }}>All rider COD floats within safety limit (₹2,000).</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {riderSettlements.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#0b0e11', borderRadius: '8px', border: '1px solid #1e293b', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '13px', color: '#fff' }}>#{s.referenceId} · {s.riderName}</strong>
                          <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>{s.paymentMethod}</span>
                        </div>
                        <span style={{ color: '#22c55e', fontWeight: '800', fontFamily: 'monospace', fontSize: '14px' }}>₹{s.totalCodSettled} Settled</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: CORPORATE BANKING */}
          {activePage === 'Corporate Banking & Payouts' && isSuperAdmin && (
            <div style={{ background: '#131920', border: '2px solid #22c55e', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>
                    🏦 Withdraw Platform Retained Profits
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                    Transfer accumulated 10% commission balance directly to corporate bank account.
                  </p>
                </div>
                <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', borderRadius: '10px', padding: '8px 16px', textAlign: 'right' }}>
                  <span style={{ fontSize: '10px', color: '#86efac', fontWeight: '800', textTransform: 'uppercase', fontFamily: 'monospace' }}>Available Profit</span>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#22c55e', fontFamily: 'monospace' }}>₹{stats.availableCorporateBalance}</div>
                </div>
              </div>

              <form onSubmit={handleAdminWithdrawProfit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#cbd5e1', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '6px' }}>
                    Withdrawal Amount (INR) *
                  </label>
                  <input
                    type="number"
                    placeholder={`Max ₹${stats.availableCorporateBalance}`}
                    value={adminWithdrawAmt}
                    onChange={e => setAdminWithdrawAmt(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', background: '#0b0e11', color: '#ffffff', fontSize: '15px', fontWeight: '800', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <input
                    type="text"
                    placeholder="Beneficiary Entity Name"
                    value={accountHolder}
                    onChange={e => setAccountHolder(e.target.value)}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #334155', background: '#0b0e11', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Corporate Account Number"
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #334155', background: '#0b0e11', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <input
                  type="text"
                  placeholder="Bank IFSC Code"
                  value={ifscCode}
                  onChange={e => setIfscCode(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #334155', background: '#0b0e11', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                  required
                />

                <button
                  type="submit"
                  disabled={isProcessingWithdraw || stats.availableCorporateBalance <= 0}
                  style={{ marginTop: '6px', background: stats.availableCorporateBalance > 0 ? '#22c55e' : '#475569', color: '#052e16', border: 'none', padding: '13px', borderRadius: '8px', fontWeight: '800', fontSize: '14px', cursor: stats.availableCorporateBalance > 0 ? 'pointer' : 'not-allowed' }}
                >
                  {isProcessingWithdraw ? 'Processing Settlement...' : `⚡ Transfer ₹${adminWithdrawAmt || '0'} to Corporate Account`}
                </button>
              </form>
            </div>
          )}

          {/* TAB: HELPDESK & ROLES */}
          {activePage === 'Helpdesk & Roles' && isSuperAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#ffffff' }}>Customer Support Staff Logins</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Provision agent accounts for Support Portal (/support-login)</span>
                </div>
                <button onClick={() => setShowAddStaff(!showAddStaff)} style={{ background: '#22c55e', color: '#052e16', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}>
                  {showAddStaff ? '✕ Close' : '➕ Create Agent Account'}
                </button>
              </div>

              {showAddStaff && (
                <form onSubmit={handleCreateStaff} style={{ background: '#131920', border: '2px solid #22c55e', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <input type="text" placeholder="Agent Full Name" value={staffFormData.agentName} onChange={e => setStaffFormData({ ...staffFormData, agentName: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: '#0b0e11', color: '#fff', fontSize: '13px' }} required />
                    <input type="text" placeholder="Agent Username" value={staffFormData.username} onChange={e => setStaffFormData({ ...staffFormData, username: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: '#0b0e11', color: '#fff', fontSize: '13px' }} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <input type="password" placeholder="Password" value={staffFormData.password} onChange={e => setStaffFormData({ ...staffFormData, password: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: '#0b0e11', color: '#fff', fontSize: '13px' }} required />
                    <input type="tel" maxLength="10" placeholder="10-Digit Phone *" value={staffFormData.phone} onChange={e => setStaffFormData({ ...staffFormData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: '#0b0e11', color: '#fff', fontSize: '13px' }} required />
                  </div>
                  <button type="submit" disabled={isCreatingStaff} style={{ background: '#22c55e', color: '#052e16', border: 'none', padding: '11px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>Save Agent</button>
                </form>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {staffList.map((s) => (
                  <div key={s._id} style={{ background: '#131920', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '15px', color: '#ffffff' }}>🎧 {s.agentName || s.username}</strong>
                      <span style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        📞 {s.phone || 'No phone recorded'} • Added {new Date(s.createdAt || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setResetTargetStaff(s)} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                        🔑 Reset Password
                      </button>
                      <button onClick={() => handleDeleteStaff(s._id)} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* SUPPORT OVERRIDE & REFUND MODAL */}
      {selectedSupportOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '16px' }}>
          <form onSubmit={handleExecuteSupportAction} style={{ maxWidth: '440px', width: '100%', background: '#131920', border: '1px solid #334155', borderRadius: '14px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', color: '#ffffff' }}>
              Support Override: #{selectedSupportOrder._id.slice(-6).toUpperCase()}
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#94a3b8' }}>
              Customer: {selectedSupportOrder.customerName} ({selectedSupportOrder.customerPhone || 'N/A'})
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px' }}>
                SELECT SUPPORT ACTION:
              </label>
              <select
                value={supportActionType}
                onChange={e => setSupportActionType(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0b0e11', color: '#fff', border: '1px solid #334155', fontSize: '13px' }}
              >
                <option value="CANCEL_AND_REFUND">❌ Cancel Order & Refund to Customer Wallet (₹{selectedSupportOrder.totalAmount})</option>
                <option value="FORCE_DELIVER">✓ Force Mark as Delivered (Support Override)</option>
                <option value="FORCE_CANCEL">✕ Force Mark as Cancelled (No Refund)</option>
              </select>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px' }}>
                RESOLUTION NOTE:
              </label>
              <textarea
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                rows="2"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0b0e11', color: '#fff', border: '1px solid #334155', fontSize: '12px', boxSizing: 'border-box' }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setSelectedSupportOrder(null)}
                style={{ flex: 1, padding: '10px', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessingAction}
                style={{ flex: 1.5, padding: '10px', background: '#22c55e', border: 'none', color: '#052e16', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
              >
                {isProcessingAction ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetTargetStaff && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '16px' }}>
          <form onSubmit={handleSaveResetPassword} style={{ maxWidth: '380px', width: '100%', background: '#131920', border: '1px solid #334155', borderRadius: '14px', padding: '22px' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#ffffff' }}>Reset Password</h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#94a3b8' }}>Agent: {resetTargetStaff.username}</p>
            <input
              type="password"
              placeholder="Enter new password"
              value={newAgentPassword}
              onChange={e => setNewAgentPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0b0e11', color: '#fff', border: '1px solid #334155', fontSize: '13px', boxSizing: 'border-box', marginBottom: '14px' }}
              required
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setResetTargetStaff(null)} style={{ flex: 1, padding: '8px', background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={isResettingPass} style={{ flex: 1, padding: '8px', background: '#38bdf8', color: '#082f49', fontWeight: '800', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Save</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;

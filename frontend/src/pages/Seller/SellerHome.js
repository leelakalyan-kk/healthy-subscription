import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';
import FloatingChatbot from '../../components/FloatingChatbot';
import GuidedTour from '../../components/GuidedTour';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const socket = io(window.location.origin, {
  transports: ['websocket', 'polling']
});

const COMMISSION_RATE = 0.10;

const sellerTourSteps = [
  { icon: '🟢', title: 'Kitchen Online/Offline Toggle', desc: 'Toggle your cloud kitchen Online or Pause incoming orders anytime with 1-click.' },
  { icon: '📦', title: 'Order Flow Management', desc: 'Accept orders, move them to Preparing, and mark Ready for Pickup when packaging is done.' },
  { icon: '🍽️', title: 'Dish Catalog', desc: 'Add nutritious meals, set prices, and edit dishes anytime.' },
  { icon: '💸', title: 'Instant 90% Payouts', desc: 'Your 90% net sales reflect in Available Balance instantly for withdrawal directly to UPI.' }
];

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
  const nowActual = new Date();
  const [showMonthPopover, setShowMonthPopover] = useState(false);
  const [pickerYear, setPickerYear] = useState(nowActual.getFullYear());
  const [selectedStatementDate, setSelectedStatementDate] = useState(new Date(nowActual.getFullYear(), nowActual.getMonth(), 1));
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowMonthPopover(false);
      }
    };
    if (showMonthPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMonthPopover]);

  const sellerDisplayName = activeUser?.kitchenName || activeUser?.username || '';
  const sellerIdentifier = String(activeUser?._id || activeUser?.id || activeUser?.username || '');

  const [isKitchenOnline, setIsKitchenOnline] = useState(() => {
    const saved = localStorage.getItem(`kitchen_online_${sellerIdentifier}`);
    return saved === null ? true : saved === 'true';
  });

  const [orders, setOrders] = useState([]);
  const [foods, setFoods] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payoutUpi, setPayoutUpi] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [isTogglingKitchen, setIsTogglingKitchen] = useState(false);

  const [showAddDish, setShowAddDish] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [isUploadingDish, setIsUploadingDish] = useState(false);

  const [dish, setDish] = useState({
    title: '',
    description: '',
    price: '',
    protein: 'High Protein',
    imageUrl: '',
    sellerName: sellerDisplayName,
    branchName: activeUser?.branchName || '',
    areaName: activeUser?.areaName || '',
    city: activeUser?.city || '',
    pincode: activeUser?.pincode || '',
    isAvailable: true
  });

  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get('/api/orders/seller-orders/' + sellerIdentifier);
      if (Array.isArray(res.data)) {
        const myOrders = res.data.filter(o => {
          const sId = String(o.sellerId || '').trim();
          const curId = String(sellerIdentifier || '').trim();
          const curUser = String(activeUser?.username || '').trim().toLowerCase();
          const curKitchen = String(activeUser?.kitchenName || '').trim().toLowerCase();

          const matchesItem = (o.items || []).some(it => {
            const itId = String(it.sellerId || '').trim();
            const itName = String(it.sellerName || '').trim().toLowerCase();
            return (curId && itId === curId) ||
                   (curUser && itId.toLowerCase() === curUser) ||
                   (curKitchen && itName === curKitchen);
          });

          return (curId && sId === curId) ||
                 (curUser && sId.toLowerCase() === curUser) ||
                 matchesItem;
        });
        setOrders(myOrders);
      }
    } catch (err) {
      console.error('Error fetching seller orders:', err);
    }
  }, [sellerIdentifier, activeUser]);

  const fetchFoods = useCallback(async () => {
    try {
      const res = await axios.get('/api/food/all');
      if (Array.isArray(res.data)) {
        const myFoods = (res.data || []).filter(f => {
          const sId = String(f.sellerId || '').trim();
          const sName = String(f.sellerName || '').trim().toLowerCase();
          const curId = String(sellerIdentifier || '').trim();
          const curUser = String(activeUser?.username || '').trim().toLowerCase();
          const curKitchen = String(activeUser?.kitchenName || '').trim().toLowerCase();

          return (curId && sId === curId) ||
                 (curUser && sId.toLowerCase() === curUser) ||
                 (curKitchen && sName === curKitchen);
        });
        setFoods(myFoods.map(f => ({ ...f, isAvailable: f.isAvailable !== false })));
      }
    } catch (err) {
      console.error('Error fetching foods:', err);
    }
  }, [sellerIdentifier, activeUser]);

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
      const isForMe = (order.items || []).some(it => String(it.sellerId) === sellerIdentifier) || String(order.sellerId) === sellerIdentifier;
      if (isForMe) {
        setOrders((prev) => [order, ...prev.filter((o) => o._id !== order._id)]);
      }
    });

    socket.on('order_status_updated', (updatedOrder) => {
      setOrders((prev) => prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o)));
    });

    socket.on('food_added', (newDish) => {
      if (String(newDish.sellerId) === sellerIdentifier) {
        setFoods((prev) => [newDish, ...prev.filter((f) => f._id !== newDish._id)]);
      }
    });

    socket.on('food_updated', (updatedDish) => {
      setFoods((prev) => prev.map((f) => (f._id === updatedDish._id ? updatedDish : f)));
    });

    socket.on('food_deleted', (deletedId) => {
      setFoods((prev) => prev.filter((f) => f._id !== deletedId));
    });

    socket.on('withdrawal_requested', (w) => {
      if (String(w.sellerId) === sellerIdentifier) {
        setWithdrawals(prev => [w, ...prev.filter(item => item._id !== w._id)]);
      }
    });

    return () => {
      clearInterval(interval);
      socket.off('new_order_placed');
      socket.off('order_status_updated');
      socket.off('food_added');
      socket.off('food_updated');
      socket.off('food_deleted');
      socket.off('withdrawal_requested');
    };
  }, [activeUser, sellerIdentifier, fetchOrders, fetchFoods, fetchWithdrawals]);

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
      alert(nextState ? '🟢 Kitchen is now OPEN! Dishes are live.' : '⏸️ Kitchen is PAUSED.');
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
    if (!payoutUpi.trim()) return alert('Please enter your receiver UPI ID');
    setIsSubmittingWithdraw(true);

    try {
      const res = await axios.post('/api/withdraw/request', {
        sellerId: sellerIdentifier,
        amount: Number(withdrawAmount),
        upiId: payoutUpi.trim()
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

    const now = new Date();
    const todayStr = now.toDateString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let todayNet = 0;
    let weekNet = 0;
    let monthNet = 0;

    validOrders.forEach(o => {
      const oDate = new Date(o.createdAt || Date.now());
      const itemsSubtotal = (o.items || []).reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0);
      const foodRevenue = itemsSubtotal > 0 ? itemsSubtotal : Number(o.itemTotal || o.totalAmount || 0);

      const commission = Math.round(foodRevenue * COMMISSION_RATE);
      const net = foodRevenue - commission;

      totalGrossSales += foodRevenue;
      totalCommissionDeducted += commission;
      totalNetEarned += net;

      // 📅 Daily reset at 00:00 midnight
      if (oDate.toDateString() === todayStr) {
        todayNet += net;
      }
      // 🗓️ Rolling 7 days
      if (oDate >= sevenDaysAgo) {
        weekNet += net;
      }
      // 📆 Monthly reset on 1st of month
      if (oDate.getMonth() === currentMonth && oDate.getFullYear() === currentYear) {
        monthNet += net;
      }
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
      totalDishes: foods.length,
      todayNet,
      weekNet,
      monthNet
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

  // Robust Client-Side Canvas Resizer
  const handleImageFileChange = (e, isEdit = false) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 1000;
        let w = image.width;
        let h = image.height;

        if (w > h) {
          if (w > maxDimension) {
            h = Math.round((h * maxDimension) / w);
            w = maxDimension;
          }
        } else {
          if (h > maxDimension) {
            w = Math.round((w * maxDimension) / h);
            h = maxDimension;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, w, h);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        if (isEdit) {
          setEditingDish(prev => ({ ...prev, imageUrl: compressedDataUrl }));
        } else {
          setDish(prev => ({ ...prev, imageUrl: compressedDataUrl }));
        }
      };
      image.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleAddDish = async (e) => {
    e.preventDefault();
    if (!dish.title.trim()) return alert('Please enter dish title');
    if (!dish.price) return alert('Please enter price');
    if (!dish.areaName.trim()) return alert('Please enter Area / Locality');
    if (!dish.city.trim()) return alert('Please enter City');

    setIsUploadingDish(true);
    try {
      const res = await axios.post('/api/food/add', {
        title: dish.title.trim(),
        description: dish.description.trim(),
        price: Number(dish.price),
        protein: dish.protein,
        imageUrl: dish.imageUrl,
        sellerId: sellerIdentifier,
        sellerName: sellerDisplayName,
        branchName: dish.branchName || '',
        areaName: dish.areaName.trim(),
        city: dish.city.trim(),
        pincode: dish.pincode.trim()
      });

      if (res.data?.success) {
        setFoods(prev => [res.data.food, ...prev]);
        fetchFoods();
        setShowAddDish(false);
        setDish({
          title: '',
          description: '',
          price: '',
          protein: 'High Protein',
          imageUrl: '',
          sellerName: sellerDisplayName,
          branchName: activeUser?.branchName || '',
          areaName: activeUser?.areaName || '',
          city: activeUser?.city || '',
          pincode: activeUser?.pincode || '',
          isAvailable: true
        });
        alert('✅ Dish published successfully!');
      }
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUploadingDish(false);
    }
  };

  const handleUpdateDish = async (e) => {
    e.preventDefault();
    if (!editingDish || !editingDish._id) return;
    setIsUploadingDish(true);
    try {
      const res = await axios.put(`/api/food/update/${editingDish._id}`, {
        title: editingDish.title.trim(),
        description: editingDish.description.trim(),
        price: Number(editingDish.price),
        protein: editingDish.protein,
        imageUrl: editingDish.imageUrl,
        areaName: editingDish.areaName?.trim(),
        city: editingDish.city?.trim(),
        pincode: editingDish.pincode?.trim()
      });
      if (res.data?.success) {
        setFoods(prev => prev.map(f => f._id === editingDish._id ? res.data.food : f));
        setEditingDish(null);
        alert('✅ Dish updated successfully!');
      }
    } catch (err) {
      alert('Update failed: ' + err.message);
    } finally {
      setIsUploadingDish(false);
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

  const handleDeleteDish = async (id) => {
    if (!window.confirm('Delete this dish permanently?')) return;
    try {
      await axios.delete(`/api/food/${id}`);
      setFoods(foods.filter((f) => f._id !== id));
    } catch (err) {
      console.error('Error deleting food:', err);
    }
  };

  
  

  
    const downloadTaxStatementPDF = () => {
    try {
      const dObj = selectedStatementDate || new Date();
      const filterYear = dObj.getFullYear();
      const filterMonth = dObj.getMonth() + 1;
      const periodLabel = dObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      const doc = new jsPDF();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 26, 'F');

      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text("HealthyBites — OFFICIAL SELLER TAX & REVENUE STATEMENT", 14, 16);

      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text("Kitchen Partner: " + (sellerDisplayName || 'Partner'), 14, 34);
      doc.text("Seller Partner ID: " + String(sellerIdentifier || ''), 14, 40);
      doc.text("Branch / Area: " + (activeUser?.areaName || 'Local Hub') + ", " + (activeUser?.city || ''), 14, 46);
      doc.text("Statement Period: " + periodLabel, 14, 52);
      doc.text("Generated On: " + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), 14, 58);

      const targetOrders = (orders || []).filter(o => {
        if (o.orderStatus === 'Cancelled') return false;
        const orderDate = o.createdAt ? new Date(o.createdAt) : null;
        if (!orderDate || isNaN(orderDate.getTime())) return false;
        return orderDate.getFullYear() === filterYear && (orderDate.getMonth() + 1) === filterMonth;
      });

      let periodGross = 0;
      let periodCommission = 0;
      let periodNet = 0;

      const tableRows = targetOrders.map((o, idx) => {
        const itSub = (o.items || []).reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0);
        const foodGross = itSub > 0 ? itSub : Number(o.itemTotal || o.totalAmount || 0);
        const commission = Math.round(foodGross * COMMISSION_RATE);
        const net = foodGross - commission;
        const d = new Date(o.createdAt || Date.now());

        periodGross += foodGross;
        periodCommission += commission;
        periodNet += net;

        return [
          idx + 1,
          String(o._id || '').slice(-6).toUpperCase(),
          d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          "Rs. " + foodGross,
          "Rs. " + commission,
          "Rs. " + net,
          o.orderStatus || 'Delivered'
        ];
      });

      autoTable(doc, {
        startY: 64,
        head: [['#', 'Order ID', 'Date', 'Gross Billing', 'Platform Fee (10%)', 'Net Income', 'Status']],
        body: tableRows.length > 0 ? tableRows : [[1, 'N/A', 'N/A', 'Rs. 0', 'Rs. 0', 'Rs. 0', 'No orders in ' + periodLabel]],
        headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      let finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("Period Gross Turn-over (Sales):", 120, finalY);
      doc.text("Rs. " + periodGross, 185, finalY, { align: 'right' });

      finalY += 6;
      doc.text("Platform Commission Retained (10%):", 120, finalY);
      doc.text("- Rs. " + periodCommission, 185, finalY, { align: 'right' });

      finalY += 4;
      doc.setDrawColor(203, 213, 225);
      doc.line(120, finalY, 185, finalY);

      finalY += 6;
      doc.setFontSize(12);
      doc.setTextColor(22, 163, 74);
      doc.text("Net Taxable Business Income:", 120, finalY);
      doc.text("Rs. " + periodNet, 185, finalY, { align: 'right' });

      finalY += 14;
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("This computer-generated statement serves as verified revenue proof for Income Tax (ITR) audit & GST compliance.", 14, finalY);

      const safePartnerName = (sellerDisplayName || 'Kitchen').replace(/\s+/g, '_');
      const safePeriod = periodLabel.replace(/\s+/g, '_');
      doc.save("Tax_Statement_" + safePartnerName + "_" + safePeriod + ".pdf");
    } catch (e) {
      alert("PDF Statement Error: " + e.message);
    }
  };


  return (
    <>
      <GuidedTour tourKey="seller_v1" steps={sellerTourSteps} />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 14px', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
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
                VERIFIED KITCHEN PARTNER
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
              👨‍🍳 {sellerDisplayName || 'Kitchen'} Operations Desk
            </h2>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              ID: {sellerIdentifier} • 10% Flat Platform Commission
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
              onClick={async () => {
                if (!window.confirm("⚠️ SCHEDULE KITCHEN PARTNER DELETION?\n\nNotice: Your kitchen account and dish catalog will be permanently removed after 30 days.\nIf you log back in within 30 days, your account will be automatically restored.")) return;
                try {
                  const res = await axios.post('/api/auth/request-deletion', { userId: sellerIdentifier });
                  alert(res.data?.message || "Deletion scheduled.");
                  handleLogout();
                } catch(e) { alert("Failed: " + e.message); }
              }}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              🗑️ Delete Kitchen (30-Day Notice)
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
              🚪 Logout
            </button>
          </div>
        </div>

        {/* PERIODIC EARNINGS & TAX DISPATCH CARD */}
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '14px', padding: '16px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>📅 Today's Net</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#15803d' }}>₹{stats.todayNet || 0}</div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Resets daily at 00:00</span>
            </div>
            <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '18px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>🗓️ Last 7 Days</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#0369a1' }}>₹{stats.weekNet || 0}</div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Rolling 7 days</span>
            </div>
            <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '18px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>📆 This Month</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#7c3aed' }}>₹{stats.monthNet || 0}</div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Resets on 1st of month</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Popover Month Trigger Button */}
            <div style={{ position: 'relative' }} ref={popoverRef}>
              <button
                type="button"
                onClick={() => setShowMonthPopover(!showMonthPopover)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  padding: '9px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#0f172a',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
                aria-label="Choose order history month"
              >
                <span>📅</span>
                <span>{selectedStatementDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>▼</span>
              </button>

              {/* Popover Content (Month & Year Calendar Grid without day selection) */}
              {showMonthPopover && (
                <div style={{
                  position: 'absolute',
                  top: '46px',
                  right: 0,
                  width: '270px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '14px',
                  boxShadow: '0 15px 35px rgba(0,0,0,0.15)',
                  zIndex: 9999,
                  padding: '14px'
                }}>
                  {/* Year Header with Next/Prev Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <button
                      type="button"
                      onClick={() => setPickerYear(prev => prev - 1)}
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      ◀
                    </button>
                    <strong style={{ fontSize: '15px', color: '#0f172a' }}>{pickerYear}</strong>
                    <button
                      type="button"
                      disabled={pickerYear >= nowActual.getFullYear()}
                      onClick={() => setPickerYear(prev => prev + 1)}
                      style={{ background: pickerYear >= nowActual.getFullYear() ? '#f1f5f9' : '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', cursor: pickerYear >= nowActual.getFullYear() ? 'not-allowed' : 'pointer', fontWeight: 'bold', color: pickerYear >= nowActual.getFullYear() ? '#cbd5e1' : '#0f172a' }}
                    >
                      ▶
                    </button>
                  </div>

                  {/* 12 Months Grid (No dates/days) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[
                      { idx: 0, name: 'Jan' },
                      { idx: 1, name: 'Feb' },
                      { idx: 2, name: 'Mar' },
                      { idx: 3, name: 'Apr' },
                      { idx: 4, name: 'May' },
                      { idx: 5, name: 'Jun' },
                      { idx: 6, name: 'Jul' },
                      { idx: 7, name: 'Aug' },
                      { idx: 8, name: 'Sep' },
                      { idx: 9, name: 'Oct' },
                      { idx: 10, name: 'Nov' },
                      { idx: 11, name: 'Dec' }
                    ].map(m => {
                      const isSelected = selectedStatementDate.getFullYear() === pickerYear && selectedStatementDate.getMonth() === m.idx;
                      const isFuture = pickerYear === nowActual.getFullYear() && m.idx > nowActual.getMonth();

                      return (
                        <button
                          key={m.idx}
                          type="button"
                          disabled={isFuture}
                          onClick={() => {
                            setSelectedStatementDate(new Date(pickerYear, m.idx, 1));
                            setShowMonthPopover(false);
                          }}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid #16a34a' : '1px solid #f1f5f9',
                            background: isSelected ? '#ecfdf5' : '#f8fafc',
                            color: isFuture ? '#cbd5e1' : (isSelected ? '#16a34a' : '#334155'),
                            fontWeight: isSelected ? '800' : '600',
                            fontSize: '12px',
                            cursor: isFuture ? 'not-allowed' : 'pointer',
                            textAlign: 'center'
                          }}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '8px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStatementDate(new Date(nowActual.getFullYear(), nowActual.getMonth(), 1));
                        setPickerYear(nowActual.getFullYear());
                        setShowMonthPopover(false);
                      }}
                      style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      Jump to This Month
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Download Action Button */}
            <button
              type="button"
              onClick={() => downloadTaxStatementPDF()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            >
              <span>📑</span>
              <span>Download Statement (PDF)</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '22px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px', borderRadius: '14px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>💰 TOTAL GROSS SALES</span>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>₹{stats.grossSales}</div>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Gross billing volume</span>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #fed7aa', padding: '16px 18px', borderRadius: '14px' }}>
            <span style={{ fontSize: '12px', color: '#c2410c', fontWeight: '700' }}>📉 PLATFORM FEE (10%)</span>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#ea580c', marginTop: '4px' }}>- ₹{stats.commissionPaid}</div>
            <span style={{ fontSize: '11px', color: '#9a3412' }}>Retained commission</span>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '16px 18px', borderRadius: '14px' }}>
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: '700' }}>💸 TOTAL PAID OUT</span>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#334155', marginTop: '4px' }}>₹{stats.totalWithdrawn}</div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Settled to UPI</span>
          </div>

          <div style={{ background: stats.available > 0 ? '#ecfdf5' : '#f8fafc', border: stats.available > 0 ? '2px solid #86efac' : '1px solid #e2e8f0', padding: '16px 18px', borderRadius: '14px' }}>
            <span style={{ fontSize: '12px', color: stats.available > 0 ? '#15803d' : '#64748b', fontWeight: '700' }}>⚡ AVAILABLE BALANCE</span>
            <div style={{ fontSize: '22px', fontWeight: '800', color: stats.available > 0 ? '#16a34a' : '#64748b', marginTop: '4px' }}>₹{stats.available}</div>
            <span style={{ fontSize: '11px', color: stats.available > 0 ? '#15803d' : '#94a3b8' }}>
              {stats.available === 0 ? '✓ All Settled' : 'Ready to Withdraw'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setActiveTab('orders'); setShowAddDish(false); setEditingDish(null); }}
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
              onClick={() => { setActiveTab('menu'); setShowAddDish(false); setEditingDish(null); }}
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
              🍽️ My Dishes ({foods.length})
            </button>
            <button
              onClick={() => { setActiveTab('withdraw'); setShowAddDish(false); setEditingDish(null); }}
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
              onClick={() => { setShowAddDish(!showAddDish); setEditingDish(null); }}
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

        {activeTab === 'orders' && (
          <div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px' }}>
              {[
                { key: 'ALL', label: `All (${orders.length})` },
                { key: 'PLACED', label: `🆕 New Placed (${orders.filter(o => (o.orderStatus || 'Order Placed') === 'Order Placed').length})` },
                { key: 'PREPARING', label: `👨‍🍳 In Kitchen (${orders.filter(o => o.orderStatus === 'Preparing').length})` },
                { key: 'READY', label: `📦 Ready for Pickup (${orders.filter(o => o.orderStatus === 'Ready for Pickup').length})` },
                { key: 'COMPLETED', label: 'Completed / Cancelled' }
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
                  <h4 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>No orders assigned to your kitchen yet</h4>
                </div>
              ) : (
                filteredOrders.map((o) => {
                  const itemsSubtotal = (o.items || []).reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0);
                  const foodGross = itemsSubtotal > 0 ? itemsSubtotal : Number(o.itemTotal || o.totalAmount || 0);
                  const commission = Math.round(foodGross * COMMISSION_RATE);
                  const sellerNetPayout = foodGross - commission;
                  const status = o.orderStatus || 'Order Placed';

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
                          <span style={{ display: 'block', fontSize: '12px', color: '#15803d', fontWeight: '700', marginBottom: '2px' }}>
                            📅 {new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(o.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                          <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>
                            Customer: <strong style={{ color: '#0f172a' }}>{o.customerName || 'Customer'}</strong> ({o.customerPhone || 'No phone recorded'})
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a' }}>₹{sellerNetPayout}</span>
                          <span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>
                            (Gross: ₹{foodGross} - 10% Platform Fee: ₹{commission})
                          </span>
                          <span style={{ display: 'inline-block', fontSize: '11px', background: '#ecfdf5', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '10px', fontWeight: '700', marginTop: '2px' }}>
                            ● {status}
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
                        <strong>📍 Delivery Address:</strong> {o.deliveryAddress}
                      </div>

                      <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>Kitchen Action:</span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {status === 'Order Placed' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(o._id, 'Preparing')}
                                disabled={updatingId === o._id}
                                style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '7px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '11px', cursor: 'pointer' }}
                              >
                                👨‍🍳 Accept & Prepare
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(o._id, 'Cancelled')}
                                disabled={updatingId === o._id}
                                style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #ef4444', padding: '7px 10px', borderRadius: '8px', fontWeight: '800', fontSize: '11px', cursor: 'pointer' }}
                              >
                                ❌ Cancel
                              </button>
                            </>
                          )}

                          {status === 'Preparing' && (
                            <button
                              onClick={() => handleUpdateStatus(o._id, 'Ready for Pickup')}
                              disabled={updatingId === o._id}
                              style={{ background: '#e0f2fe', color: '#075985', border: '1px solid #bae6fd', padding: '7px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '11px', cursor: 'pointer' }}
                            >
                              📦 Ready for Pickup
                            </button>
                          )}

                          {(status === 'Ready for Pickup' || status === 'Rider Assigned' || status === 'Out for Delivery') && (
                            <span style={{ fontSize: '11px', color: '#0284c7', background: '#e0f2fe', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold' }}>
                              🛵 Waiting for Rider Pickup
                            </span>
                          )}

                          {(status === 'Delivered' || status === 'Cancelled') && (
                            <span style={{ fontSize: '11px', color: status === 'Delivered' ? '#16a34a' : '#dc2626', background: status === 'Delivered' ? '#ecfdf5' : '#fee2e2', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold' }}>
                              {status === 'Delivered' ? '✓ Completed' : '✕ Cancelled'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div>
            {showAddDish && (
              <form onSubmit={handleAddDish} style={{ background: '#ffffff', border: '2px solid #16a34a', borderRadius: '14px', padding: '20px', marginBottom: '22px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>➕ Add New Dish for {sellerDisplayName || 'Kitchen'}</h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Meal Category *</label>
                    <select
                      value={dish.protein}
                      onChange={(e) => setDish({ ...dish, protein: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', background: '#fff', fontWeight: 'bold' }}
                    >
                      <option value="High Protein">High Protein</option>
                      <option value="Salad">Salad</option>
                      <option value="Keto">Keto</option>
                      <option value="Bowl">Bowl</option>
                    </select>
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
                    📍 Kitchen Hub Location:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="Area / Street *"
                      value={dish.areaName}
                      onChange={e => setDish({ ...dish, areaName: e.target.value })}
                      style={{ padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      required
                    />
                    <input
                      type="text"
                      placeholder="City *"
                      value={dish.city}
                      onChange={e => setDish({ ...dish, city: e.target.value })}
                      style={{ padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      required
                    />
                    <input
                      type="text"
                      maxLength="6"
                      placeholder="PIN Code"
                      value={dish.pincode}
                      onChange={e => setDish({ ...dish, pincode: e.target.value })}
                      style={{ padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px dashed #94a3b8' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                    📷 Upload Dish Image (Auto-Compress Enabled):
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageFileChange(e, false)}
                    style={{ fontSize: '12px', color: '#475569' }}
                  />
                  {dish.imageUrl && (
                    <div style={{ marginTop: '8px' }}>
                      <img src={dish.imageUrl} alt="Preview" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: '#16a34a', fontWeight: '700' }}>✓ Image ready</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isUploadingDish}
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: isUploadingDish ? 'not-allowed' : 'pointer',
                    width: '100%'
                  }}
                >
                  {isUploadingDish ? 'Uploading & Publishing...' : '💾 Publish Dish'}
                </button>
              </form>
            )}

            {editingDish && (
              <form onSubmit={handleUpdateDish} style={{ background: '#ffffff', border: '2px solid #0284c7', borderRadius: '14px', padding: '20px', marginBottom: '22px', boxShadow: '0 4px 15px rgba(2, 132, 199, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#0284c7', fontWeight: '800' }}>✏️ Edit Dish: {editingDish.title}</h4>
                  <button type="button" onClick={() => setEditingDish(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 'bold' }}>✕ Close</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Dish Name *</label>
                    <input
                      type="text"
                      value={editingDish.title}
                      onChange={(e) => setEditingDish({ ...editingDish, title: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Meal Category *</label>
                    <select
                      value={editingDish.protein}
                      onChange={(e) => setEditingDish({ ...editingDish, protein: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', background: '#fff', fontWeight: 'bold' }}
                    >
                      <option value="High Protein">High Protein</option>
                      <option value="Salad">Salad</option>
                      <option value="Keto">Keto</option>
                      <option value="Bowl">Bowl</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Price (₹) *</label>
                    <input
                      type="number"
                      value={editingDish.price}
                      onChange={(e) => setEditingDish({ ...editingDish, price: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Description *</label>
                  <textarea
                    value={editingDish.description || ''}
                    onChange={(e) => setEditingDish({ ...editingDish, description: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box', minHeight: '60px' }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                  <input
                    type="text"
                    placeholder="Area / Street *"
                    value={editingDish.areaName || ''}
                    onChange={e => setEditingDish({ ...editingDish, areaName: e.target.value })}
                    style={{ padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="City *"
                    value={editingDish.city || ''}
                    onChange={e => setEditingDish({ ...editingDish, city: e.target.value })}
                    style={{ padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    required
                  />
                  <input
                    type="text"
                    maxLength="6"
                    placeholder="PIN Code"
                    value={editingDish.pincode || ''}
                    onChange={e => setEditingDish({ ...editingDish, pincode: e.target.value })}
                    style={{ padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px dashed #94a3b8' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                    📷 Change Dish Image:
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageFileChange(e, true)}
                    style={{ fontSize: '12px', color: '#475569' }}
                  />
                  {editingDish.imageUrl && (
                    <div style={{ marginTop: '8px' }}>
                      <img src={editingDish.imageUrl} alt="Preview" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setEditingDish(null)} style={{ flex: 1, padding: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={isUploadingDish} style={{ flex: 2, padding: '11px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: isUploadingDish ? 'not-allowed' : 'pointer' }}>
                    {isUploadingDish ? 'Saving Changes...' : '💾 Update Dish Changes'}
                  </button>
                </div>
              </form>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {foods.map((f) => (
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
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ position: 'relative', height: '140px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {f.imageUrl ? (
                      <img src={f.imageUrl} alt={f.title} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '42px' }}>🥗</span>
                    )}
                  </div>

                  <div style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '15px', color: '#0f172a' }}>{f.title}</strong>
                      <span style={{ fontWeight: '800', color: '#16a34a', fontSize: '16px' }}>₹{f.price}</span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                      📍 {[f.areaName, f.city].filter(Boolean).join(', ')} • <strong>{f.protein}</strong>
                    </div>

                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                      {f.description}
                    </p>

                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleToggleStock(f._id, f.isAvailable)}
                        style={{
                          flex: 1,
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
                        {f.isAvailable ? 'Out of Stock' : 'In Stock'}
                      </button>
                      <button
                        onClick={() => { setEditingDish({ ...f }); setShowAddDish(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                        title="Edit Dish Details"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteDish(f._id)}
                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        title="Delete Dish"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#ffffff', border: '2px solid #16a34a', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                💸 Request Kitchen Revenue Payout
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                Transfer your 90% net earned revenue directly to your UPI ID.
              </p>

              <form onSubmit={handleRequestWithdraw} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Payout Amount (₹) * (Max ₹{stats.available})
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
                    placeholder="e.g. mobile@upi"
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
                📑 Payouts History ({withdrawals.length})
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
                          Transfer to: <strong>{w.payoutDetails}</strong> • {new Date(w.requestedAt || Date.now()).toLocaleString()}
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

        <FloatingChatbot mode="seller" />
      </div>
    </>
  );
};

export default SellerHome;

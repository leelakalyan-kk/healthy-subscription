import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const socket = io(window.location.origin, {
  transports: ['websocket', 'polling']
});

const MEAL_TIERS = [
  { id: 'detox', name: 'Detox & Salad Meal', ratePerDay: 120, maxDishPrice: 140, tag: 'Dishes up to ₹140' },
  { id: 'protein', name: 'High Protein Lunch Box', ratePerDay: 180, maxDishPrice: 220, tag: 'Dishes up to ₹220' },
  { id: 'keto', name: 'Premium Gourmet Bowl', ratePerDay: 250, maxDishPrice: 350, tag: 'Dishes up to ₹350' }
];

const Account = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const user = currentUser || JSON.parse(localStorage.getItem('active_user') || '{}');

  const userEmail = user.email || (user.username ? `${user.username}@healthybites.com` : 'user@healthybites.com');
  const userName = user.username || user.name || 'Customer';
  const userPhone = user.phone || '8074095895';
  const userIdentifier = user._id || user.id || user.username || 'user_1';

  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [menuFoods, setMenuFoods] = useState([]);

  // Persistent Wallet State
  const [walletBalance, setWalletBalance] = useState(() => {
    const saved = localStorage.getItem(`wallet_${userIdentifier}`);
    if (saved !== null) return Number(saved);
    localStorage.setItem(`wallet_${userIdentifier}`, '250');
    return 250;
  });

  const [topupAmount, setTopupAmount] = useState('');
  const [walletTxns, setWalletTxns] = useState(() => {
    return JSON.parse(localStorage.getItem(`wallet_txns_${userIdentifier}`) || '[{"id":"TXN_INIT","desc":"Welcome Bonus","amount":250,"type":"CR","time":"Joined"}]');
  });

  // Saved Addresses State
  const [addresses, setAddresses] = useState(() => {
    return JSON.parse(localStorage.getItem(`user_addresses_${userIdentifier}`) || JSON.stringify([
      { id: 'addr_1', type: 'Home', address: 'D.No: 19-14/1-142A, Arundalpet, Near Water Tank, Vijayawada - 520002', isDefault: true }
    ]));
  });
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({ type: 'Home', flat: '', street: '', landmark: '', area: '', city: 'Vijayawada', pin: '520002' });

  // Tomorrow Meal Customizer
  const [customizingSub, setCustomizingSub] = useState(null);
  const [chosenMeal, setChosenMeal] = useState('');
  const [isSavingMeal, setIsSavingMeal] = useState(false);

  // Review State
  const [selectedOrderForReview, setSelectedOrderForReview] = useState(null);
  const [ratingVal, setRatingVal] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Subscription Creation State
  const [showSubModal, setShowSubModal] = useState(false);
  const [planDuration, setPlanDuration] = useState(7);
  const [selectedTier, setSelectedTier] = useState(MEAL_TIERS[0]);
  const [deliverySlot, setDeliverySlot] = useState('12:30 PM - 01:30 PM');
  const [paymentMode, setPaymentMode] = useState('wallet');
  const [upiId, setUpiId] = useState(`${userName.toLowerCase()}@okhdfcbank`);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const fetchUserData = useCallback(async () => {
    try {
      const ordersRes = await axios.get(`/api/orders/user-orders/${userIdentifier}`);
      if (Array.isArray(ordersRes.data)) {
        const regularFoodOrders = ordersRes.data.filter(o =>
          !o.items?.some(it => (it.title || '').toLowerCase().includes('pass') || (it.title || '').toLowerCase().includes('subscription'))
        );
        setOrders(regularFoodOrders);
      }

      if (userEmail) {
        const subRes = await axios.get(`/api/extra/subscription/user/${userEmail}`);
        if (Array.isArray(subRes.data)) setSubscriptions(subRes.data);
      }

      const foodsRes = await axios.get(`/api/food/all`);
      if (Array.isArray(foodsRes.data)) setMenuFoods(foodsRes.data);
    } catch (err) {
      console.error('Error fetching account data:', err);
    }
  }, [userIdentifier, userEmail]);

  useEffect(() => {
    fetchUserData();

    const interval = setInterval(() => {
      fetchUserData();
    }, 3000);

    socket.on('order_status_updated', (updatedOrder) => {
      if (!updatedOrder) return;
      setOrders((prev) =>
        prev.map((o) => (String(o._id) === String(updatedOrder._id) ? { ...o, ...updatedOrder } : o))
      );
    });

    socket.on('new_order_placed', (newOrder) => {
      if (!newOrder) return;
      setOrders((prev) => [newOrder, ...prev.filter(o => String(o._id) !== String(newOrder._id))]);
    });

    return () => {
      clearInterval(interval);
      socket.off('order_status_updated');
      socket.off('new_order_placed');
    };
  }, [fetchUserData]);

  // Sync wallet changes from storage
  useEffect(() => {
    const handleStorage = () => {
      const currentBal = Number(localStorage.getItem(`wallet_${userIdentifier}`)) || 0;
      setWalletBalance(currentBal);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userIdentifier]);

  // Wallet Handlers
  const handleTopupWallet = (amt) => {
    const addAmt = Number(amt || topupAmount);
    if (!addAmt || addAmt <= 0) return alert('Enter valid amount');
    const newBal = walletBalance + addAmt;
    setWalletBalance(newBal);
    localStorage.setItem(`wallet_${userIdentifier}`, String(newBal));

    const newTxn = {
      id: 'TXN_' + Math.floor(100000 + Math.random() * 900000),
      desc: 'Wallet Top-up',
      amount: addAmt,
      type: 'CR',
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };
    const updatedTxns = [newTxn, ...walletTxns];
    setWalletTxns(updatedTxns);
    localStorage.setItem(`wallet_txns_${userIdentifier}`, JSON.stringify(updatedTxns));
    setTopupAmount('');
    alert(`🎉 ₹${addAmt} added to your Wallet! New Balance: ₹${newBal}`);
  };

  // Address Handlers
  const handleSaveNewAddress = (e) => {
    e.preventDefault();
    const formatted = `${newAddr.flat ? newAddr.flat + ', ' : ''}${newAddr.street}, ${newAddr.landmark ? 'Near ' + newAddr.landmark + ', ' : ''}${newAddr.area}, ${newAddr.city} - ${newAddr.pin}`;
    const newAddressObj = {
      id: 'addr_' + Date.now(),
      type: newAddr.type,
      address: formatted,
      isDefault: addresses.length === 0
    };
    const updated = [...addresses, newAddressObj];
    setAddresses(updated);
    localStorage.setItem(`user_addresses_${userIdentifier}`, JSON.stringify(updated));
    const loc = `📍 ${formatted}`;
    localStorage.setItem('user_delivery_hub', loc);
    window.dispatchEvent(new CustomEvent('location_changed', { detail: loc }));
    setShowAddAddress(false);
    setNewAddr({ type: 'Home', flat: '', street: '', landmark: '', area: '', city: 'Vijayawada', pin: '520002' });
    alert('📍 New address saved and updated live!');
  };

  const handleDeleteAddress = (addrId) => {
    const updated = addresses.filter(a => a.id !== addrId);
    setAddresses(updated);
    localStorage.setItem(`user_addresses_${userIdentifier}`, JSON.stringify(updated));
  };

  const handleSetDefaultAddress = (addr) => {
    const updated = addresses.map(a => ({ ...a, isDefault: a.id === addr.id }));
    setAddresses(updated);
    localStorage.setItem(`user_addresses_${userIdentifier}`, JSON.stringify(updated));
    const newLoc = `📍 ${addr.address}`;
    localStorage.setItem('user_delivery_hub', newLoc);
    window.dispatchEvent(new CustomEvent('location_changed', { detail: newLoc }));
    alert('✅ Delivery address updated live to: ' + addr.type);
  };

  const calculateBillDetails = (order) => {
    const rawSubtotal = (order.items || []).reduce((sum, item) => sum + (Number(item.price) * Number(item.qty || 1)), 0);
    const subtotal = rawSubtotal > 0 ? rawSubtotal : Number(order.itemTotal || order.totalAmount || 0);
    const gstAmount = Math.round(subtotal * 0.05);
    const platformFee = 5;
    const deliveryFee = subtotal < 199 ? 30 : 0;
    const grandTotal = subtotal + gstAmount + platformFee + deliveryFee;

    return {
      subtotal,
      gstAmount,
      platformFee,
      deliveryFee,
      grandTotal: Math.max(grandTotal, Number(order.totalAmount || grandTotal))
    };
  };

  const downloadInvoicePDF = (order) => {
    try {
      const bill = calculateBillDetails(order);
      const doc = new jsPDF();
      const orderFullId = order._id || 'ORD_' + Math.floor(100000 + Math.random() * 900000);
      const orderShortId = orderFullId.slice(-6).toUpperCase();

      doc.setFillColor(22, 163, 74);
      doc.rect(0, 0, 210, 26, 'F');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('HealthyBites - TAX INVOICE & RECEIPT', 14, 16);

      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`Order Reference ID: #${orderFullId}`, 14, 35);
      doc.text(`Invoice Number: HB-INV-${orderShortId}`, 14, 41);
      doc.text(`Order Date & Time: ${new Date(order.createdAt || Date.now()).toLocaleString('en-IN', { hour12: true })}`, 14, 47);
      doc.text(`Customer: ${userName} (${userEmail})`, 14, 53);
      doc.text(`Payment: ${order.paymentType || 'Sandbox (UPI)'} [PAID]`, 14, 59);
      doc.text(`Address: ${order.deliveryAddress || 'Saved Customer Location'}`, 14, 65);

      const tableRows = (order.items || []).map((item, idx) => [
        idx + 1,
        item.title || 'Healthy Meal Dish',
        item.qty || 1,
        `Rs. ${item.price}`,
        `Rs. ${(Number(item.price) * Number(item.qty || 1))}`
      ]);

      autoTable(doc, {
        startY: 72,
        head: [['#', 'Item Description', 'Qty', 'Rate', 'Amount']],
        body: tableRows.length > 0 ? tableRows : [[1, 'Fresh Meal', 1, `Rs. ${bill.subtotal}`, `Rs. ${bill.subtotal}`]],
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      let currentY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Item Subtotal:`, 130, currentY);
      doc.text(`Rs. ${bill.subtotal}`, 180, currentY, { align: 'right' });

      currentY += 6;
      doc.text(`GST (5% Restaurant Tax):`, 130, currentY);
      doc.text(`Rs. ${bill.gstAmount}`, 180, currentY, { align: 'right' });

      currentY += 6;
      doc.text(`Platform Fee:`, 130, currentY);
      doc.text(`Rs. ${bill.platformFee}`, 180, currentY, { align: 'right' });

      currentY += 6;
      doc.text(`Delivery Partner Fee:`, 130, currentY);
      doc.text(bill.deliveryFee === 0 ? 'FREE' : `Rs. ${bill.deliveryFee}`, 180, currentY, { align: 'right' });

      currentY += 4;
      doc.setDrawColor(203, 213, 225);
      doc.line(130, currentY, 185, currentY);

      currentY += 6;
      doc.setFontSize(12);
      doc.setTextColor(22, 163, 74);
      doc.text(`Grand Total Paid:`, 130, currentY);
      doc.text(`Rs. ${bill.grandTotal}`, 180, currentY, { align: 'right' });

      doc.save(`HealthyBites_Invoice_${orderShortId}.pdf`);
    } catch (err) {
      alert('PDF Error: ' + err.message);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrderForReview || !selectedOrderForReview.items?.[0]) return;
    setIsSubmittingReview(true);
    try {
      const foodId = selectedOrderForReview.items[0].foodId || selectedOrderForReview.items[0]._id;
      const res = await axios.post('/api/extra/review/add', {
        foodId: foodId,
        customerName: userName,
        rating: ratingVal,
        reviewText: reviewComment
      });
      if (res.data?.success) {
        alert('⭐ Review submitted successfully!');
        setSelectedOrderForReview(null);
        setReviewComment('');
      }
    } catch (err) {
      alert('Review error: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSaveTomorrowMeal = async (e) => {
    e.preventDefault();
    if (!chosenMeal || !customizingSub) return;
    setIsSavingMeal(true);

    try {
      const res = await axios.put(`/api/extra/subscription/customize-meal/${customizingSub._id}`, {
        selectedMeal: chosenMeal
      });

      if (res.data?.success) {
        setSubscriptions(prev => prev.map(s => s._id === customizingSub._id ? res.data.subscription : s));
        alert(`✅ Tomorrow's meal updated to: "${chosenMeal}"!`);
        setCustomizingSub(null);
      }
    } catch (err) {
      alert('Failed to update meal: ' + err.message);
    } finally {
      setIsSavingMeal(false);
    }
  };

  const handlePayAndActivateSubscription = async (e) => {
    e.preventDefault();
    const rate = selectedTier.ratePerDay;
    const totalAmount = planDuration * rate;

    if (paymentMode === 'wallet' && walletBalance < totalAmount) {
      alert(`⚠️ Insufficient Wallet Balance (₹${walletBalance}). Please Top-Up from Wallet tab or choose UPI.`);
      return;
    }

    setIsProcessingPayment(true);

    const matchingDishes = menuFoods.filter(f => Number(f.price) <= selectedTier.maxDishPrice);
    const defaultMeal = matchingDishes.length > 0 ? matchingDishes[0].title : `${selectedTier.name} (Chef Special)`;
    const defaultAddr = addresses.find(a => a.isDefault)?.address || localStorage.getItem('user_delivery_hub')?.replace(/📍/g, '').trim() || 'Vijayawada';

    try {
      const txnId = 'TXN_SUB_' + Math.floor(100000 + Math.random() * 900000);

      const res = await axios.post('/api/extra/subscription/create', {
        customerName: userName,
        customerEmail: userEmail,
        planType: `${planDuration}-Day ${selectedTier.name}`,
        durationDays: planDuration,
        defaultDish: defaultMeal,
        transactionId: txnId,
        paymentMethod: paymentMode === 'wallet' ? 'HealthyBites Wallet' : `Sandbox UPI (${upiId})`,
        paymentStatus: 'PAID',
        items: [{ title: `${selectedTier.name} (₹${rate}/day)`, qty: planDuration, price: rate }],
        totalAmount: totalAmount,
        deliveryTime: deliverySlot,
        deliveryAddress: defaultAddr
      });

      if (res.data?.success) {
        if (paymentMode === 'wallet') {
          const newBal = walletBalance - totalAmount;
          setWalletBalance(newBal);
          localStorage.setItem(`wallet_${userIdentifier}`, String(newBal));
          const newTxn = {
            id: txnId,
            desc: `Subscription: ${planDuration}-Day ${selectedTier.name}`,
            amount: totalAmount,
            type: 'DR',
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          };
          const updatedTxns = [newTxn, ...walletTxns];
          setWalletTxns(updatedTxns);
          localStorage.setItem(`wallet_txns_${userIdentifier}`, JSON.stringify(updatedTxns));
        }

        setSubscriptions([res.data.subscription, ...subscriptions]);
        setShowSubModal(false);
        alert(`🎉 Subscription Activated for ₹${totalAmount} All-Inclusive!\nTxn Ref: ${txnId}`);
        setActiveTab('subscriptions');
      }
    } catch (err) {
      alert('Subscription Error: ' + err.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getMaxAllowedForSub = (sub) => {
    if (!sub) return 140;
    const pType = (sub.planType || '').toLowerCase();
    if (pType.includes('keto') || pType.includes('gourmet')) return 350;
    if (pType.includes('protein')) return 220;
    return 140;
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
        return { bg: '#ecfdf5', text: '#15803d', border: '#86efac' };
    }
  };

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto', padding: '24px 16px' }}>

      {/* Profile Header */}
      <div style={{
        background: '#0f172a',
        color: '#fff',
        padding: '22px 26px',
        borderRadius: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px' }}>{userName}</h3>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{userEmail} • {userPhone}</span>
          </div>
        </div>

        <button onClick={logout} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'orders', label: `📦 Orders (${orders.length})` },
          { id: 'subscriptions', label: `🥗 Meal Subscriptions (${subscriptions.length})` },
          { id: 'wallet', label: `💰 Wallet (₹${walletBalance})` },
          { id: 'addresses', label: `📍 Saved Addresses (${addresses.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: activeTab === tab.id ? '2px solid #16a34a' : '1px solid #cbd5e1',
              background: activeTab === tab.id ? '#ecfdf5' : '#ffffff',
              color: activeTab === tab.id ? '#16a34a' : '#475569',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. ORDERS TAB */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: '#fff', borderRadius: '14px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '8px' }}>🛍️</span>
              <h4 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>No regular on-demand food orders</h4>
              <p style={{ margin: 0, fontSize: '12px' }}>Your active recurring subscriptions are in the "Meal Subscriptions" tab.</p>
            </div>
          ) : (
            orders.map((o) => {
              const bill = calculateBillDetails(o);
              const badge = getBadgeColors(o.orderStatus || 'Order Placed');
              const formattedDate = new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              const formattedTime = new Date(o.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

              return (
                <div key={o._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '16px', color: '#0f172a' }}>Order #{(o._id || '').slice(-6).toUpperCase()}</strong>
                        <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>ID: {o._id}</span>
                      </div>
                      <span style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        📅 <strong>{formattedDate}</strong> at <strong>{formattedTime}</strong> • {o.paymentType || 'Sandbox (UPI)'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a' }}>₹{bill.grandTotal}</span>
                      <span style={{ display: 'inline-block', fontSize: '11px', background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`, padding: '3px 10px', borderRadius: '12px', fontWeight: '800', marginTop: '2px' }}>
                        ● {o.orderStatus || 'Order Placed'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                    {o.items?.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155' }}>
                        <span>🥗 <strong>{item.title}</strong> (x{item.qty})</span>
                        <span style={{ fontWeight: '700' }}>₹{item.price * item.qty}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span>Item Subtotal:</span><span>₹{bill.subtotal}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span>GST (5% Restaurant Tax):</span><span>₹{bill.gstAmount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span>Platform Fee:</span><span>₹{bill.platformFee}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Delivery Fee ({bill.subtotal < 199 ? '< ₹199' : 'Free above ₹199'}):</span>
                      <span style={{ color: bill.deliveryFee === 0 ? '#16a34a' : '#475569', fontWeight: '700' }}>{bill.deliveryFee === 0 ? 'FREE' : `₹${bill.deliveryFee}`}</span>
                    </div>
                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: '#0f172a' }}>
                      <span>Total Paid:</span><span style={{ color: '#16a34a' }}>₹{bill.grandTotal}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                    <button onClick={() => downloadInvoicePDF(o)} style={{ flex: 1, background: '#0f172a', color: '#ffffff', border: 'none', padding: '10px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                      📄 Download Tax Invoice (PDF)
                    </button>
                    <button onClick={() => setSelectedOrderForReview(o)} style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '10px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                      ⭐ Rate & Review
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. MEAL SUBSCRIPTIONS TAB */}
      {activeTab === 'subscriptions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>🥗 Active Healthy Meal Plans</h4>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Automated daily healthy lunch & dinner delivery</span>
            </div>
            <button onClick={() => setShowSubModal(true)} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
              ➕ Subscribe New Plan
            </button>
          </div>

          {subscriptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 10px', background: '#fff', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '10px' }}>🗓️</span>
              <strong style={{ fontSize: '16px', color: '#0f172a', display: 'block' }}>No Active Recurring Meal Plan</strong>
              <p style={{ margin: '6px 0 16px 0', color: '#64748b', fontSize: '13px' }}>Subscribe to 7-Day, 14-Day or 30-Day Healthy Plan with 0 Delivery Fee!</p>
              <button onClick={() => setShowSubModal(true)} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
                ⚡ Explore Subscription Plans
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {subscriptions.map((s) => (
                <div key={s._id} style={{ background: '#fff', border: '2px solid #86efac', borderRadius: '16px', padding: '18px', boxShadow: '0 4px 15px rgba(22, 163, 74, 0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong style={{ fontSize: '16px', color: '#0f172a' }}>{s.planType}</strong>
                    <span style={{ background: '#ecfdf5', color: '#16a34a', border: '1px solid #86efac', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                      ● ACTIVE
                    </span>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>🍲 TOMORROW'S SCHEDULED MEAL:</span>
                      <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>Auto-Dispatch</span>
                    </div>
                    <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>
                      🥗 {s.selectedTomorrowMeal || 'Chef Special High Protein Bowl'}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#15803d', display: 'block', marginTop: '2px' }}>
                      (You can change this from eligible dishes before 8:00 PM today)
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '6px' }}>
                    🕒 Delivery Slot: <strong>{s.deliveryTime}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
                    📅 Valid till: <strong>{new Date(s.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: '#16a34a', display: 'block' }}>₹{s.totalAmount} (Paid)</span>
                      <span style={{ fontSize: '10px', color: '#15803d', fontWeight: '700' }}>⚡ Zero Delivery & Platform Fee</span>
                    </div>
                    <button
                      onClick={() => { setCustomizingSub(s); setChosenMeal(s.selectedTomorrowMeal || ''); }}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      ✏️ Change Dish
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. WALLET TAB */}
      {activeTab === 'wallet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>AVAILABLE WALLET CASH</span>
              <h2 style={{ fontSize: '36px', margin: '6px 0 2px 0', color: '#22c55e', fontWeight: '900' }}>₹{walletBalance}</h2>
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Instant 1-Click Checkout on HealthyBites</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[100, 200, 500, 1000].map(amt => (
                <button
                  key={amt}
                  onClick={() => handleTopupWallet(amt)}
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                >
                  + ₹{amt}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#0f172a' }}>⚡ Instant Sandbox Wallet Top-Up</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="number"
                placeholder="Enter custom amount in ₹"
                value={topupAmount}
                onChange={e => setTopupAmount(e.target.value)}
                style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
              <button
                onClick={() => handleTopupWallet(topupAmount)}
                style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '10px 22px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
              >
                Top-Up Now
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#0f172a' }}>📑 Wallet Passbook History</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {walletTxns.map((t, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{t.desc}</strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Ref: #{t.id} • {t.time}</span>
                  </div>
                  <strong style={{ fontSize: '14px', color: t.type === 'CR' ? '#16a34a' : '#dc2626' }}>
                    {t.type === 'CR' ? '+ ' : '- '}₹{t.amount}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. SAVED ADDRESSES TAB */}
      {activeTab === 'addresses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>📍 Your Delivery Addresses</h4>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Manage your home, office and other delivery hubs</span>
            </div>
            <button
              onClick={() => setShowAddAddress(!showAddAddress)}
              style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
            >
              {showAddAddress ? '✕ Cancel' : '➕ Add New Address'}
            </button>
          </div>

          {showAddAddress && (
            <form onSubmit={handleSaveNewAddress} style={{ background: '#ffffff', border: '2px solid #16a34a', borderRadius: '14px', padding: '20px', boxShadow: '0 4px 15px rgba(22, 163, 74, 0.1)' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#0f172a' }}>🏠 Save New Delivery Address</h4>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {['Home', 'Work', 'Other'].map(type => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setNewAddr({ ...newAddr, type })}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: newAddr.type === type ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      background: newAddr.type === type ? '#ecfdf5' : '#fff',
                      color: newAddr.type === type ? '#16a34a' : '#475569',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {type === 'Home' ? '🏡 Home' : type === 'Work' ? '💼 Work' : '📍 Other'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder="House / Flat / Block No."
                  value={newAddr.flat}
                  onChange={e => setNewAddr({ ...newAddr, flat: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  required
                />
                <input
                  type="text"
                  placeholder="Street / Road / Society *"
                  value={newAddr.street}
                  onChange={e => setNewAddr({ ...newAddr, street: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <input
                  type="text"
                  placeholder="Area / Locality (e.g. Benz Circle) *"
                  value={newAddr.area}
                  onChange={e => setNewAddr({ ...newAddr, area: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  required
                />
                <input
                  type="text"
                  placeholder="City *"
                  value={newAddr.city}
                  onChange={e => setNewAddr({ ...newAddr, city: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  required
                />
                <input
                  type="text"
                  maxLength="6"
                  placeholder="PIN Code *"
                  value={newAddr.pin}
                  onChange={e => setNewAddr({ ...newAddr, pin: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  required
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', background: '#16a34a', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
              >
                💾 Save Delivery Address
              </button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {addresses.map((a) => (
              <div key={a.id} style={{ background: '#ffffff', border: a.isDefault ? '2px solid #16a34a' : '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                      {a.type === 'Home' ? '🏡 HOME' : a.type === 'Work' ? '💼 WORK' : '📍 OTHER'}
                    </span>
                    {a.isDefault && (
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '800' }}>✓ ACTIVE DEFAULT</span>
                    )}
                  </div>
                  <p style={{ margin: '0', fontSize: '13px', color: '#334155', lineHeight: '1.4' }}>{a.address}</p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {!a.isDefault && (
                    <button
                      onClick={() => handleSetDefaultAddress(a)}
                      style={{ background: '#ecfdf5', color: '#16a34a', border: '1px solid #86efac', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteAddress(a.id)}
                    style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* CREATE MEAL SUBSCRIPTION MODAL */}
      {showSubModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '14px' }}>
          <form onSubmit={handlePayAndActivateSubscription} style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>🌱 Subscribe Healthy Meal Plan</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Automated fresh daily lunch delivery</span>
              </div>
              <button type="button" onClick={() => setShowSubModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            {/* Select Meal Tier */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>1. Select Meal Tier:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {MEAL_TIERS.map(tier => (
                  <label key={tier.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', border: selectedTier.id === tier.id ? '2px solid #16a34a' : '1px solid #cbd5e1', background: selectedTier.id === tier.id ? '#ecfdf5' : '#fff', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="radio" name="sub_tier" checked={selectedTier.id === tier.id} onChange={() => setSelectedTier(tier)} />
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{tier.name}</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{tier.tag}</span>
                      </div>
                    </div>
                    <strong style={{ fontSize: '14px', color: '#16a34a' }}>₹{tier.ratePerDay}/day</strong>
                  </label>
                ))}
              </div>
            </div>

            {/* Select Plan Duration */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>2. Select Plan Duration:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[7, 14, 30].map(days => (
                  <button
                    type="button"
                    key={days}
                    onClick={() => setPlanDuration(days)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: planDuration === days ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      background: planDuration === days ? '#ecfdf5' : '#fff',
                      color: planDuration === days ? '#16a34a' : '#475569',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {days} Days Plan
                    <span style={{ display: 'block', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>₹{days * selectedTier.ratePerDay} Total</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Delivery Slot */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>3. Preferred Delivery Slot:</label>
              <select value={deliverySlot} onChange={e => setDeliverySlot(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                <option value="12:30 PM - 01:30 PM">🕛 Lunch Slot (12:30 PM - 01:30 PM)</option>
                <option value="07:30 PM - 08:30 PM">🌙 Dinner Slot (07:30 PM - 08:30 PM)</option>
              </select>
            </div>

            {/* Payment Method */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>4. Payment Mode:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: paymentMode === 'wallet' ? '1px solid #16a34a' : '1px solid #cbd5e1', background: paymentMode === 'wallet' ? '#ecfdf5' : '#fff', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="radio" name="sub_pay" checked={paymentMode === 'wallet'} onChange={() => setPaymentMode('wallet')} />
                  <span>💰 HealthyBites Wallet (Available Bal: ₹{walletBalance})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: paymentMode === 'upi' ? '1px solid #16a34a' : '1px solid #cbd5e1', background: paymentMode === 'upi' ? '#ecfdf5' : '#fff', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="radio" name="sub_pay" checked={paymentMode === 'upi'} onChange={() => setPaymentMode('upi')} />
                  <span>⚡ Instant UPI (GPay / PhonePe / Paytm)</span>
                </label>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Total All-Inclusive Amount:</span>
              <strong style={{ fontSize: '20px', color: '#16a34a' }}>₹{planDuration * selectedTier.ratePerDay}</strong>
            </div>

            <button
              type="submit"
              disabled={isProcessingPayment}
              style={{
                width: '100%',
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: isProcessingPayment ? 'not-allowed' : 'pointer'
              }}
            >
              {isProcessingPayment ? 'Activating Subscription...' : `Pay ₹${planDuration * selectedTier.ratePerDay} & Activate Plan`}
            </button>
          </form>
        </div>
      )}

      {/* Change Tomorrow Meal Modal */}
      {customizingSub && (() => {
        const maxPrice = getMaxAllowedForSub(customizingSub);
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '14px' }}>
            <form onSubmit={handleSaveTomorrowMeal} style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#0f172a' }}>🍲 Choose Tomorrow's Meal</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b' }}>
                Your active plan covers dishes valued up to <strong>₹{maxPrice}</strong>.
              </p>

              <div style={{ marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {menuFoods.map((dish) => {
                  const isEligible = Number(dish.price) <= maxPrice;
                  return (
                    <label
                      key={dish._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: chosenMeal === dish.title ? '2px solid #16a34a' : '1px solid #cbd5e1',
                        background: !isEligible ? '#f1f5f9' : (chosenMeal === dish.title ? '#ecfdf5' : '#ffffff'),
                        opacity: isEligible ? 1 : 0.6,
                        cursor: isEligible ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="radio"
                          name="meal_pick"
                          disabled={!isEligible}
                          checked={chosenMeal === dish.title}
                          onChange={() => isEligible && setChosenMeal(dish.title)}
                        />
                        <div>
                          <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{dish.title}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Menu Price: ₹{dish.price}</span>
                        </div>
                      </div>
                      {isEligible ? (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '800' }}>✓ Plan Covered</span>
                      ) : (
                        <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: '700', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                          Exceeds Limit
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setCustomizingSub(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSavingMeal || !chosenMeal} style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}>
                  {isSavingMeal ? 'Updating...' : 'Confirm Meal'}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* Review Modal */}
      {selectedOrderForReview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '14px' }}>
          <form onSubmit={handleReviewSubmit} style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#0f172a' }}>⭐ Rate Your Delivered Meal</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>Help other health-conscious foodies know how fresh it was!</p>

            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRatingVal(star)}
                  style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: star <= ratingVal ? '#f59e0b' : '#cbd5e1' }}
                >
                  ★
                </button>
              ))}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Your Feedback</label>
              <textarea
                placeholder="Delicious, fresh, high protein, perfectly cooked..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                rows="3"
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setSelectedOrderForReview(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={isSubmittingReview} style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}>
                {isSubmittingReview ? 'Posting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default Account;

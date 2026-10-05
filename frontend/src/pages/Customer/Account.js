import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
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

  const userEmail = user.email || (user.username ? user.username + '@healthybites.com' : '');
  const userName = user.username || user.name || 'Customer';
  const userPhone = user.phone || '';
  const userIdentifier = user._id || user.id || user.username || 'user';

  const [activeTab, setActiveTab] = useState('addresses');
  const [orders, setOrders] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [menuFoods, setMenuFoods] = useState([]);

  // Wallet
  const [walletBalance, setWalletBalance] = useState(() => {
    const saved = localStorage.getItem('wallet_' + userIdentifier);
    return saved !== null ? Number(saved) : (Number(user.walletBalance) || 0);
  });
  const [topupAmount, setTopupAmount] = useState('');
  const [showSandboxGateway, setShowSandboxGateway] = useState(false);
  const [pendingTopupAmt, setPendingTopupAmt] = useState(0);
  const [sandboxPayMethod, setSandboxPayMethod] = useState('UPI');
  const [sandboxUpiId, setSandboxUpiId] = useState(userName ? userName.toLowerCase() + '@okhdfcbank' : 'customer@upi');
  const [isProcessingSandbox, setIsProcessingSandbox] = useState(false);
  const [walletTxns, setWalletTxns] = useState(() => {
    return JSON.parse(localStorage.getItem('wallet_txns_' + userIdentifier) || '[]');
  });

  // Saved Addresses
  const [addresses, setAddresses] = useState([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapAddressLoading, setMapAddressLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [customTypeLabel, setCustomTypeLabel] = useState('');

  const [newAddr, setNewAddr] = useState({
    type: 'Home',
    recipientPhone: user.phone || '',
    flat: '',
    street: '',
    landmark: '',
    area: user.areaName || '',
    city: user.city || '',
    pin: user.pincode || '',
    lat: null,
    lng: null
  });

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Sync addresses directly from Database
  const fetchSavedAddresses = useCallback(async () => {
    try {
      const res = await axios.get('/api/auth/get-addresses/' + userIdentifier).catch(() => ({ data: [] }));
      const dbList = Array.isArray(res.data) ? res.data : [];
      if (dbList.length > 0) {
        setAddresses(dbList);
        localStorage.setItem('user_addresses_' + userIdentifier, JSON.stringify(dbList));
      } else {
        const localList = JSON.parse(localStorage.getItem('user_addresses_' + userIdentifier) || '[]');
        setAddresses(localList);
      }
    } catch (e) {
      const localList = JSON.parse(localStorage.getItem('user_addresses_' + userIdentifier) || '[]');
      setAddresses(localList);
    }
  }, [userIdentifier]);

  // Reverse Geocoding
  const reverseGeocodeCoords = async (lat, lng) => {
    setMapAddressLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        setNewAddr(prev => ({
          ...prev,
          street: a.road || a.suburb || prev.street,
          area: a.neighbourhood || a.suburb || a.residential || a.village || prev.area,
          city: a.city || a.town || a.county || prev.city,
          pin: String(a.postcode || '').replace(/\D/g, '').slice(0, 6) || prev.pin,
          lat,
          lng
        }));
      }
    } catch (e) {
      console.warn("Geocoding failed:", e);
    } finally {
      setMapAddressLoading(false);
    }
  };

  // Leaflet Map Initialization with Fix for Blank Tiles
  useEffect(() => {
    if (!showMapPicker || !mapContainerRef.current) return;

    const startLeaflet = (lat, lng) => {
      if (!window.L || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = window.L.map(mapContainerRef.current).setView([lat, lng], 15);

      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      const marker = window.L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.bindPopup("📍 Drag pin to your doorstep").openPopup();

      marker.on('dragend', (e) => {
        const coords = e.target.getLatLng();
        reverseGeocodeCoords(coords.lat, coords.lng);
      });

      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        reverseGeocodeCoords(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Crucial Fix: Force redraw map tiles after container expansion
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 300);
    };

    const loadLeafletAssets = () => {
      let defaultLat = 16.5062;
      let defaultLng = 80.6480;

      if (newAddr.lat && newAddr.lng) {
        defaultLat = Number(newAddr.lat);
        defaultLng = Number(newAddr.lng);
      }

      if (!window.L) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => startLeaflet(defaultLat, defaultLng);
        document.body.appendChild(script);
      } else {
        startLeaflet(defaultLat, defaultLng);
      }
    };

    loadLeafletAssets();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [showMapPicker]);

  const handlePincodeChange = async (e) => {
    const rawPin = e.target.value.replace(/\D/g, '').slice(0, 6);
    setNewAddr(prev => ({ ...prev, pin: rawPin }));

    if (rawPin.length === 6) {
      setPinLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${rawPin}`);
        const data = await res.json();
        if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          setNewAddr(prev => ({
            ...prev,
            area: po.Name || prev.area,
            city: po.District || po.Block || prev.city
          }));
        }
      } catch (err) {
        console.warn('Pincode lookup error:', err);
      } finally {
        setPinLoading(false);
      }
    }
  };

  const [customizingSub, setCustomizingSub] = useState(null);
  const [chosenMeal, setChosenMeal] = useState('');
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState(null);
  const [selectedOrderForRider, setSelectedOrderForRider] = useState(null);
  const [ratingVal, setRatingVal] = useState(5);
  const [riderRatingVal, setRiderRatingVal] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [riderComment, setRiderComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteMyAccount = async () => {
    if (!window.confirm("⚠️ ARE YOU SURE YOU WANT TO DELETE YOUR ACCOUNT?\n\nNotice: Your account will be scheduled for permanent deletion in 30 days.\nIf you change your mind, simply log back in within 30 days to cancel and restore!")) return;
    setIsDeletingAccount(true);
    try {
      const res = await axios.post('/api/auth/request-deletion', { userId: userIdentifier });
      alert(res.data?.message || "Deletion request submitted.");
      if (logout) logout();
      window.location.href = '/login';
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleRiderReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrderForRider) return;
    setIsSubmittingReview(true);
    try {
      await axios.post('/api/extra/rider-feedback/add', {
        orderId: selectedOrderForRider._id,
        riderName: selectedOrderForRider.assignedRiderName || 'Delivery Partner',
        customerName: userName,
        rating: riderRatingVal,
        feedbackText: riderComment
      });
      alert('🛵 Feedback for delivery partner recorded!');
      setSelectedOrderForRider(null);
      setRiderComment('');
    } catch (err) {
      alert('Feedback error: ' + err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const [showSubModal, setShowSubModal] = useState(false);
  const [planDuration, setPlanDuration] = useState(7);
  const [selectedTier, setSelectedTier] = useState(MEAL_TIERS[0]);
  const [deliverySlot, setDeliverySlot] = useState('12:30 PM - 01:30 PM');
  const [paymentMode, setPaymentMode] = useState('wallet');
  const [upiId, setUpiId] = useState(userName ? userName.toLowerCase() + '@okhdfcbank' : 'customer@upi');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (!userIdentifier) return;
    try {
      const ordersRes = await axios.get('/api/orders/user-orders/' + userIdentifier);
      if (Array.isArray(ordersRes.data)) setOrders(ordersRes.data);

      if (userEmail) {
        const subRes = await axios.get('/api/extra/subscription/user/' + userEmail);
        if (Array.isArray(subRes.data)) setSubscriptions(subRes.data);
      }

      const foodsRes = await axios.get('/api/food/all');
      if (Array.isArray(foodsRes.data)) setMenuFoods(foodsRes.data);
    } catch (err) {
      console.error('Error fetching account data:', err);
    }
  }, [userIdentifier, userEmail]);

  useEffect(() => {
    fetchSavedAddresses();
    fetchUserData();

    const interval = setInterval(() => {
      fetchUserData();
    }, 4000);

    socket.on('order_status_updated', (updatedOrder) => {
      if (!updatedOrder) return;
      setOrders(prev => prev.map(o => String(o._id) === String(updatedOrder._id) ? { ...o, ...updatedOrder } : o));
    });

    socket.on('new_order_placed', (newOrder) => {
      if (!newOrder) return;
      setOrders(prev => [newOrder, ...prev.filter(o => String(o._id) !== String(newOrder._id))]);
    });

    return () => {
      clearInterval(interval);
      socket.off('order_status_updated');
      socket.off('new_order_placed');
    };
  }, [fetchSavedAddresses, fetchUserData]);

  const handleTopupWallet = (amt) => {
    const addAmt = Number(amt || topupAmount);
    if (!addAmt || isNaN(addAmt) || addAmt <= 0) return alert('⚠️ Please enter a valid top-up amount');
    setPendingTopupAmt(addAmt);
    setShowSandboxGateway(true);
  };

  const handleSandboxPaymentSuccess = () => {
    if (sandboxPayMethod === 'UPI' && !sandboxUpiId.trim()) return alert('⚠️ Please enter your UPI ID');
    setIsProcessingSandbox(true);

    setTimeout(() => {
      const addAmt = Number(pendingTopupAmt);
      const current = Number(localStorage.getItem('wallet_' + userIdentifier)) || walletBalance;
      const updatedBalance = current + addAmt;

      setWalletBalance(updatedBalance);
      localStorage.setItem('wallet_' + userIdentifier, String(updatedBalance));

      const txnId = 'TXN_SANDBOX_' + Math.floor(100000 + Math.random() * 900000);
      const newTxn = {
        id: txnId,
        desc: 'Wallet Top-Up via ' + sandboxPayMethod + ' (Sandbox)',
        amount: addAmt,
        type: 'CR',
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      };

      const updatedHistory = [newTxn, ...walletTxns];
      setWalletTxns(updatedHistory);
      localStorage.setItem('wallet_txns_' + userIdentifier, JSON.stringify(updatedHistory));

      setIsProcessingSandbox(false);
      setShowSandboxGateway(false);
      setTopupAmount('');
      alert('🎉 ₹' + addAmt + ' added to HealthyBites Wallet successfully!\nRef: ' + txnId);
    }, 1000);
  };

  const handleSaveNewAddress = async (e) => {
    e.preventDefault();
    const cleanPhone = String(newAddr.recipientPhone || userPhone || '').replace(/\D/g, '').slice(-10);

    if (cleanPhone.length !== 10) {
      return alert('⚠️ Please enter a valid 10-digit mobile number.');
    }
    if (!newAddr.street.trim() || !newAddr.area.trim() || !newAddr.city.trim()) {
      return alert('⚠️ Please fill in Street, Area, and City.');
    }

    const cleanPincode = String(newAddr.pin || '').replace(/\D/g, '').slice(0, 6);
    const finalType = (newAddr.type === 'Other' && customTypeLabel.trim()) ? customTypeLabel.trim() : newAddr.type;
    const formatted = (newAddr.flat ? newAddr.flat + ', ' : '') + newAddr.street + (newAddr.landmark ? ', Near ' + newAddr.landmark : '') + ', ' + newAddr.area + ', ' + newAddr.city + (cleanPincode ? ' - ' + cleanPincode : '');

    const newAddressObj = {
      id: 'addr_' + Date.now(),
      type: finalType,
      recipientPhone: cleanPhone,
      address: formatted,
      flat: newAddr.flat,
      street: newAddr.street,
      area: newAddr.area,
      city: newAddr.city,
      pin: cleanPincode,
      lat: newAddr.lat ? Number(newAddr.lat) : null,
      lng: newAddr.lng ? Number(newAddr.lng) : null,
      isDefault: addresses.length === 0
    };

    try {
      const res = await axios.post('/api/auth/save-address', {
        userId: userIdentifier,
        addressObj: newAddressObj
      });

      if (res.data?.success) {
        const freshList = res.data.addresses || [newAddressObj, ...addresses];
        setAddresses(freshList);
        localStorage.setItem('user_addresses_' + userIdentifier, JSON.stringify(freshList));

        const loc = '📍 ' + formatted;
        localStorage.setItem('user_delivery_hub', loc);
        window.dispatchEvent(new CustomEvent('location_changed', { detail: loc }));

        setShowAddAddress(false);
        setShowMapPicker(false);
        setCustomTypeLabel('');
        setNewAddr({ type: 'Home', recipientPhone: userPhone, flat: '', street: '', landmark: '', area: '', city: '', pin: '', lat: null, lng: null });
        alert('📍 Address saved successfully!');
      }
    } catch (err) {
      alert('Failed to save address: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteAddress = async (addrId) => {
    try {
      const res = await axios.delete(`/api/auth/delete-address/${userIdentifier}/${addrId}`);
      if (res.data?.success) {
        const freshList = res.data.addresses || [];
        setAddresses(freshList);
        localStorage.setItem('user_addresses_' + userIdentifier, JSON.stringify(freshList));
      }
    } catch (e) {
      alert('Delete error: ' + e.message);
    }
  };

  const handleSetDefaultAddress = async (addr) => {
    try {
      const res = await axios.put(`/api/auth/set-default-address/${userIdentifier}/${addr.id}`);
      if (res.data?.success) {
        const freshList = res.data.addresses || [];
        setAddresses(freshList);
        localStorage.setItem('user_addresses_' + userIdentifier, JSON.stringify(freshList));
        const newLoc = '📍 ' + addr.address;
        localStorage.setItem('user_delivery_hub', newLoc);
        window.dispatchEvent(new CustomEvent('location_changed', { detail: newLoc }));
        alert('✅ Default address set to: ' + addr.type);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
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
      doc.text('Order Reference ID: #' + orderFullId, 14, 35);
      doc.text('Invoice Number: HB-INV-' + orderShortId, 14, 41);
      doc.text('Order Date: ' + new Date(order.createdAt || Date.now()).toLocaleString('en-IN', { hour12: true }), 14, 47);
      doc.text('Customer: ' + userName + (userEmail ? ' (' + userEmail + ')' : ''), 14, 53);
      doc.text('Payment: ' + (order.paymentType || 'Paid') + ' [COMPLETED]', 14, 59);
      doc.text('Address: ' + (order.deliveryAddress || 'Saved Address'), 14, 65);

      const tableRows = (order.items || []).map((item, idx) => [
        idx + 1,
        item.title || 'Healthy Meal Dish',
        item.qty || 1,
        'Rs. ' + item.price,
        'Rs. ' + (Number(item.price) * Number(item.qty || 1))
      ]);

      autoTable(doc, {
        startY: 72,
        head: [['#', 'Item Description', 'Qty', 'Rate', 'Amount']],
        body: tableRows.length > 0 ? tableRows : [[1, 'Fresh Meal', 1, 'Rs. ' + bill.subtotal, 'Rs. ' + bill.subtotal]],
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      let currentY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text('Item Subtotal:', 130, currentY);
      doc.text('Rs. ' + bill.subtotal, 180, currentY, { align: 'right' });

      currentY += 6;
      doc.text('GST (5% Restaurant Tax):', 130, currentY);
      doc.text('Rs. ' + bill.gstAmount, 180, currentY, { align: 'right' });

      currentY += 6;
      doc.text('Platform Fee:', 130, currentY);
      doc.text('Rs. ' + bill.platformFee, 180, currentY, { align: 'right' });

      currentY += 6;
      doc.text('Delivery Partner Fee:', 130, currentY);
      doc.text(bill.deliveryFee === 0 ? 'FREE' : 'Rs. ' + bill.deliveryFee, 180, currentY, { align: 'right' });

      currentY += 4;
      doc.setDrawColor(203, 213, 225);
      doc.line(130, currentY, 185, currentY);

      currentY += 6;
      doc.setFontSize(12);
      doc.setTextColor(22, 163, 74);
      doc.text('Grand Total Paid:', 130, currentY);
      doc.text('Rs. ' + bill.grandTotal, 180, currentY, { align: 'right' });

      doc.save('HealthyBites_Invoice_' + orderShortId + '.pdf');
    } catch (err) {
      alert('PDF Error: ' + err.message);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrderForReview?.items?.[0]) return;
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
      alert('Review error: ' + err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSaveTomorrowMeal = async (e) => {
    e.preventDefault();
    if (!chosenMeal || !customizingSub) return;
    setIsSavingMeal(true);
    try {
      const res = await axios.put('/api/extra/subscription/customize-meal/' + customizingSub._id, {
        selectedMeal: chosenMeal
      });
      if (res.data?.success) {
        setSubscriptions(prev => prev.map(s => s._id === customizingSub._id ? res.data.subscription : s));
        alert('✅ Tomorrow meal updated to: "' + chosenMeal + '"!');
        setCustomizingSub(null);
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setIsSavingMeal(false);
    }
  };

  const handlePayAndActivateSubscription = async (e) => {
    e.preventDefault();
    const rate = selectedTier.ratePerDay;
    const totalAmount = planDuration * rate;

    if (paymentMode === 'wallet' && walletBalance < totalAmount) {
      return alert('⚠️ Insufficient Wallet Balance (₹' + walletBalance + '). Please Top-Up or choose UPI.');
    }

    setIsProcessingPayment(true);
    const matchingDishes = menuFoods.filter(f => Number(f.price) <= selectedTier.maxDishPrice);
    const defaultMeal = matchingDishes.length > 0 ? matchingDishes[0].title : selectedTier.name + ' (Chef Special)';
    const defaultAddr = (addresses.find(a => a.isDefault) || addresses[0])?.address || '';

    if (!defaultAddr) {
      setIsProcessingPayment(false);
      return alert('⚠️ Please add at least one Delivery Address in the "Saved Addresses" tab before subscribing.');
    }

    try {
      const txnId = 'TXN_SUB_' + Math.floor(100000 + Math.random() * 900000);
      const res = await axios.post('/api/extra/subscription/create', {
        customerName: userName,
        customerEmail: userEmail,
        planType: planDuration + '-Day ' + selectedTier.name,
        durationDays: planDuration,
        defaultDish: defaultMeal,
        transactionId: txnId,
        paymentMethod: paymentMode === 'wallet' ? 'HealthyBites Wallet' : 'Sandbox UPI (' + upiId + ')',
        paymentStatus: 'PAID',
        items: [{ title: selectedTier.name + ' (₹' + rate + '/day)', qty: planDuration, price: rate }],
        totalAmount: totalAmount,
        deliveryTime: deliverySlot,
        deliveryAddress: defaultAddr
      });

      if (res.data?.success) {
        if (paymentMode === 'wallet') {
          const newBal = walletBalance - totalAmount;
          setWalletBalance(newBal);
          localStorage.setItem('wallet_' + userIdentifier, String(newBal));
        }
        setSubscriptions([res.data.subscription, ...subscriptions]);
        setShowSubModal(false);
        alert("🎉 Subscription Activated for ₹" + totalAmount + " All-Inclusive!");
        setActiveTab('subscriptions');
      }
    } catch (err) {
      alert('Subscription Error: ' + err.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1240px', margin: '0 auto', padding: '24px 20px', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
      
      {/* Profile Header */}
      <div style={{
        background: '#0f172a',
        color: '#fff',
        padding: '24px 28px',
        borderRadius: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '800' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px' }}>{userName}</h3>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              {userEmail} {userPhone ? '• ' + userPhone : ''}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleDeleteMyAccount} disabled={isDeletingAccount} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '8px 14px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '11px' }}>
            🗑️ Delete Account (30-Day Notice)
          </button>
          <button onClick={logout} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '22px', flexWrap: 'wrap' }}>
        {[
          { id: 'orders', label: '📦 Orders (' + orders.length + ')' },
          { id: 'subscriptions', label: '🥗 Meal Subscriptions (' + subscriptions.length + ')' },
          { id: 'wallet', label: '💰 Wallet (₹' + walletBalance + ')' },
          { id: 'addresses', label: '📍 Saved Addresses (' + addresses.length + ')' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '9px 20px',
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
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
              <span style={{ fontSize: '44px', display: 'block', marginBottom: '8px' }}>🛍️</span>
              <h4 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>No regular on-demand food orders</h4>
              <p style={{ margin: 0, fontSize: '13px' }}>Explore delicious healthy dishes or subscribe to recurring meal plans!</p>
            </div>
          ) : (
            orders.map((o) => {
              const bill = calculateBillDetails(o);
              const formattedDate = new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              const formattedTime = new Date(o.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

              return (
                <div key={o._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '16px', color: '#0f172a' }}>Order #{(o._id || '').slice(-6).toUpperCase()}</strong>
                        <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', fontFamily: 'monospace' }}>
                          🔑 OTP: {o.deliveryOtp || (userPhone ? userPhone.slice(-4) : "")}
                        </span>
                      </div>
                      <span style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        📅 <strong>{formattedDate}</strong> at <strong>{formattedTime}</strong> • {o.paymentType || 'Sandbox (UPI)'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '19px', fontWeight: '800', color: '#16a34a' }}>₹{bill.grandTotal}</span>
                      <span style={{ display: 'inline-block', fontSize: '11px', background: '#ecfdf5', color: '#15803d', border: '1px solid #86efac', padding: '3px 10px', borderRadius: '12px', fontWeight: '800', marginTop: '2px' }}>
                        ● {o.orderStatus || 'Order Placed'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                    {(o.items || []).map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155' }}>
                        <span>🥗 <strong>{item.title}</strong> (x{item.qty})</span>
                        <span style={{ fontWeight: '700' }}>₹{item.price * item.qty}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
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
                      <span>Delivery Fee:</span>
                      <span style={{ color: bill.deliveryFee === 0 ? '#16a34a' : '#475569', fontWeight: '700' }}>{bill.deliveryFee === 0 ? 'FREE' : '₹' + bill.deliveryFee}</span>
                    </div>
                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: '#0f172a' }}>
                      <span>Total Paid:</span><span style={{ color: '#16a34a' }}>₹{bill.grandTotal}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => downloadInvoicePDF(o)} style={{ flex: 1, background: '#0f172a', color: '#ffffff', border: 'none', padding: '10px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                      📄 Download Tax Invoice (PDF)
                    </button>
                    <a href={'/track/' + o._id} style={{ background: '#16a34a', color: '#ffffff', textDecoration: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>🛵 Track Live</a>
                    <button onClick={() => setSelectedOrderForReview(o)} style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '10px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                      ⭐ Rate Meal
                    </button>
                    <button onClick={() => setSelectedOrderForRider(o)} style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '10px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                      🛵 Rate Delivery
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>🥗 Active Healthy Meal Plans</h4>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Automated daily healthy lunch & dinner delivery</span>
            </div>
            <button onClick={() => setShowSubModal(true)} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
              ➕ Subscribe New Plan
            </button>
          </div>

          {subscriptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 10px', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '10px' }}>🗓</span>
              <strong style={{ fontSize: '16px', color: '#0f172a', display: 'block' }}>No Active Recurring Meal Plan</strong>
              <p style={{ margin: '6px 0 16px 0', color: '#64748b', fontSize: '13px' }}>Subscribe to 7-Day, 14-Day or 30-Day Healthy Plan with 0 Delivery Fee!</p>
              <button onClick={() => setShowSubModal(true)} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
                ⚡ Explore Subscription Plans
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
              {subscriptions.map((s) => (
                <div key={s._id} style={{ background: '#fff', border: '2px solid #86efac', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '16px', color: '#0f172a' }}>{s.planType}</strong>
                    <span style={{ background: '#ecfdf5', color: '#16a34a', border: '1px solid #86efac', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                      ● ACTIVE
                    </span>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block' }}>🍲 TOMORROW'S SCHEDULED MEAL:</span>
                    <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block', margin: '4px 0' }}>
                      🥗 {s.selectedTomorrowMeal || 'Chef Special High Protein Bowl'}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#15803d' }}>(Changeable before 8:00 PM today)</span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '6px' }}>
                    🕒 Slot: <strong>{s.deliveryTime}</strong> • Till: <strong>{new Date(s.endDate).toLocaleDateString()}</strong>
                  </div>
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#16a34a' }}>₹{s.totalAmount} (Paid)</span>
                    <button
                      onClick={() => { setCustomizingSub(s); setChosenMeal(s.selectedTomorrowMeal || ''); }}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
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
              <h2 style={{ fontSize: '38px', margin: '6px 0 2px 0', color: '#22c55e', fontWeight: '900' }}>₹{walletBalance}</h2>
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Instant 1-Click Checkout on HealthyBites</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[100, 200, 500, 1000].map(amt => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => handleTopupWallet(amt)}
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', padding: '9px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                >
                  + ₹{amt}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#0f172a' }}>⚡ Instant Wallet Top-Up (Sandbox Gateway)</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="number"
                placeholder="Enter custom amount in ₹"
                value={topupAmount}
                onChange={e => setTopupAmount(e.target.value)}
                style={{ flex: 1, padding: '11px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
              <button
                type="button"
                onClick={() => handleTopupWallet(topupAmount)}
                style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '11px 24px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
              >
                Top-Up Now
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#0f172a' }}>📑 Wallet Passbook History</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {walletTxns.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '12px', padding: '10px 0' }}>No wallet transactions yet.</div>
              ) : (
                walletTxns.map((t, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{t.desc}</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Ref: #{t.id} • {t.time}</span>
                    </div>
                    <strong style={{ fontSize: '14px', color: t.type === 'CR' ? '#16a34a' : '#dc2626' }}>
                      {t.type === 'CR' ? '+ ' : '- '}₹{t.amount}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. SAVED ADDRESSES TAB */}
      {activeTab === 'addresses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>📍 Your Delivery Addresses</h4>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Synced permanently to database for seamless logins on any device</span>
            </div>
            <button
              onClick={() => { setShowAddAddress(!showAddAddress); setShowMapPicker(false); }}
              style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
            >
              {showAddAddress ? '✕ Cancel' : '➕ Add New Address'}
            </button>
          </div>

          {showAddAddress && (
            <form onSubmit={handleSaveNewAddress} style={{ background: '#ffffff', border: '2px solid #16a34a', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 15px rgba(22, 163, 74, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>🏠 Save New Delivery Address</h4>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(!showMapPicker)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: showMapPicker ? '#0f172a' : '#ecfdf5',
                    color: showMapPicker ? '#ffffff' : '#15803d',
                    border: showMapPicker ? '1px solid #0f172a' : '1px solid #86efac',
                    padding: '7px 16px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  <span>🗺️</span>
                  <span>{showMapPicker ? '✕ Hide Map' : '📍 Pick & Auto-Detect on Map'}</span>
                </button>
              </div>

              {/* Dynamic Leaflet Map Container */}
              {showMapPicker && (
                <div style={{ marginBottom: '18px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #10b981', background: '#e2e8f0', minHeight: '300px', position: 'relative' }}>
                  <div style={{ background: '#0f172a', color: '#86efac', padding: '8px 12px', fontSize: '11px', fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📍 Click anywhere on map or drag pin to auto-fill address</span>
                    {mapAddressLoading && <span style={{ color: '#fbbf24' }}>⏳ Auto-detecting locality...</span>}
                  </div>
                  <div ref={mapContainerRef} style={{ width: '100%', height: '300px', zIndex: 1 }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                {['Home', 'Work', 'Other'].map(type => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setNewAddr({ ...newAddr, type })}
                    style={{
                      padding: '7px 16px',
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

                {newAddr.type === 'Other' && (
                  <input
                    type="text"
                    placeholder="Custom Label (e.g. Gym, Hostel)"
                    value={customTypeLabel}
                    onChange={e => setCustomTypeLabel(e.target.value)}
                    style={{ padding: '7px 12px', borderRadius: '6px', border: '1.5px solid #16a34a', fontSize: '12px' }}
                    required
                  />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    RECIPIENT CONTACT (10 DIGITS) *
                  </label>
                  <input
                    type="tel"
                    maxLength="10"
                    placeholder="10-digit mobile"
                    value={newAddr.recipientPhone || ''}
                    onChange={e => setNewAddr({ ...newAddr, recipientPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    FLAT / HOUSE NO.
                  </label>
                  <input
                    type="text"
                    placeholder="House / Flat / Block"
                    value={newAddr.flat}
                    onChange={e => setNewAddr({ ...newAddr, flat: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  STREET / ROAD / SOCIETY *
                </label>
                <input
                  type="text"
                  placeholder="Street / Road / Society *"
                  value={newAddr.street}
                  onChange={e => setNewAddr({ ...newAddr, street: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Area / Locality *</label>
                  <input
                    type="text"
                    placeholder="Area / Locality *"
                    value={newAddr.area}
                    onChange={e => setNewAddr({ ...newAddr, area: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>City *</label>
                  <input
                    type="text"
                    placeholder="City *"
                    value={newAddr.city}
                    onChange={e => setNewAddr({ ...newAddr, city: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    PIN Code {pinLoading && <span style={{ color: '#16a34a' }}>⚡</span>}
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    placeholder="e.g. 520001"
                    value={newAddr.pin}
                    onChange={handlePincodeChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1.5px solid #16a34a', fontSize: '13px', boxSizing: 'border-box', background: '#f0fdf4', fontWeight: 'bold' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{ width: '100%', background: '#16a34a', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}
              >
                💾 Save Delivery Address to Cloud Database
              </button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {addresses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', background: '#fff', borderRadius: '14px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                No delivery addresses saved yet. Click "+ Add New Address" above.
              </div>
            ) : (
              addresses.map((a) => (
                <div key={a.id} style={{ background: '#ffffff', border: a.isDefault ? '2px solid #16a34a' : '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                        {a.type === 'Home' ? '🏡 HOME' : a.type === 'Work' ? '💼 WORK' : `📍 ${String(a.type).toUpperCase()}`}
                      </span>
                      {a.isDefault && (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '800' }}>✓ ACTIVE DEFAULT</span>
                      )}
                    </div>
                    <p style={{ margin: '0', fontSize: '13px', color: '#334155', lineHeight: '1.4' }}>{a.address}</p>
                    <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700', display: 'block', marginTop: '4px' }}>📞 Recipient: {a.recipientPhone || userPhone || 'Not Set'}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!a.isDefault && (
                      <button
                        onClick={() => handleSetDefaultAddress(a)}
                        style={{ background: '#ecfdf5', color: '#16a34a', border: '1px solid #86efac', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteAddress(a.id)}
                      style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedOrderForReview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <form onSubmit={handleReviewSubmit} style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '340px' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Rate Food: {selectedOrderForReview.items?.[0]?.title}</h4>
            <select value={ratingVal} onChange={e => setRatingVal(Number(e.target.value))} style={{ width: '100%', padding: '8px', marginBottom: '10px' }}>
              {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} Stars</option>)}
            </select>
            <textarea placeholder="Write your review..." value={reviewComment} onChange={e => setReviewComment(e.target.value)} style={{ width: '100%', height: '70px', marginBottom: '10px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setSelectedOrderForReview(null)} style={{ flex: 1, padding: '8px' }}>Cancel</button>
              <button type="submit" disabled={isSubmittingReview} style={{ flex: 1, padding: '8px', background: '#16a34a', color: '#fff', border: 'none' }}>Submit</button>
            </div>
          </form>
        </div>
      )}

      {/* Rider Review Modal */}
      {selectedOrderForRider && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <form onSubmit={handleRiderReviewSubmit} style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '340px' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Rate Delivery Partner</h4>
            <select value={riderRatingVal} onChange={e => setRiderRatingVal(Number(e.target.value))} style={{ width: '100%', padding: '8px', marginBottom: '10px' }}>
              {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} Stars</option>)}
            </select>
            <textarea placeholder="Feedback on delivery speed, behavior..." value={riderComment} onChange={e => setRiderComment(e.target.value)} style={{ width: '100%', height: '70px', marginBottom: '10px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setSelectedOrderForRider(null)} style={{ flex: 1, padding: '8px' }}>Cancel</button>
              <button type="submit" disabled={isSubmittingReview} style={{ flex: 1, padding: '8px', background: '#0284c7', color: '#fff', border: 'none' }}>Submit</button>
            </div>
          </form>
        </div>
      )}

      {/* Subscription Customization Modal */}
      {customizingSub && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <form onSubmit={handleSaveTomorrowMeal} style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '360px' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Swap Tomorrow's Meal</h4>
            <select value={chosenMeal} onChange={e => setChosenMeal(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '14px' }}>
              {menuFoods.map(f => <option key={f._id} value={f.title}>{f.title} (₹{f.price})</option>)}
            </select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setCustomizingSub(null)} style={{ flex: 1, padding: '8px' }}>Cancel</button>
              <button type="submit" disabled={isSavingMeal} style={{ flex: 1, padding: '8px', background: '#16a34a', color: '#fff', border: 'none' }}>Save Meal</button>
            </div>
          </form>
        </div>
      )}

      {/* Sandbox Top-up Gateway Modal */}
      {showSandboxGateway && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '380px' }}>
            <h4 style={{ margin: '0 0 6px 0' }}>⚡ Sandbox Instant Payment Gateway</h4>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#64748b' }}>Top-up Amount: <strong>₹{pendingTopupAmt}</strong></p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {['UPI', 'CARD', 'NETBANKING'].map(m => (
                <button key={m} type="button" onClick={() => setSandboxPayMethod(m)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: sandboxPayMethod === m ? '2px solid #16a34a' : '1px solid #cbd5e1', background: sandboxPayMethod === m ? '#ecfdf5' : '#fff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>
                  {m}
                </button>
              ))}
            </div>
            {sandboxPayMethod === 'UPI' && (
              <input type="text" placeholder="UPI ID (e.g. mobile@upi)" value={sandboxUpiId} onChange={e => setSandboxUpiId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px', boxSizing: 'border-box' }} />
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setShowSandboxGateway(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleSandboxPaymentSuccess} disabled={isProcessingSandbox} style={{ flex: 1.5, padding: '10px', borderRadius: '6px', background: '#16a34a', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                {isProcessingSandbox ? 'Processing...' : `Pay ₹${pendingTopupAmt}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscribe New Plan Modal */}
      {showSubModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <form onSubmit={handlePayAndActivateSubscription} style={{ background: '#fff', padding: '24px', borderRadius: '16px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>🥗 New Meal Subscription</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {[7, 14, 30].map(days => (
                <button key={days} type="button" onClick={() => setPlanDuration(days)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: planDuration === days ? '2px solid #16a34a' : '1px solid #cbd5e1', background: planDuration === days ? '#ecfdf5' : '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  {days} Days
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {MEAL_TIERS.map(tier => (
                <label key={tier.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderRadius: '8px', border: selectedTier.id === tier.id ? '2px solid #16a34a' : '1px solid #cbd5e1', cursor: 'pointer' }}>
                  <div>
                    <input type="radio" name="tier" checked={selectedTier.id === tier.id} onChange={() => setSelectedTier(tier)} />
                    <strong style={{ marginLeft: '6px', fontSize: '13px' }}>{tier.name}</strong>
                  </div>
                  <span style={{ fontWeight: 'bold', color: '#16a34a' }}>₹{tier.ratePerDay}/day</span>
                </label>
              ))}
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Payable:</span>
              <strong style={{ color: '#16a34a' }}>₹{planDuration * selectedTier.ratePerDay} (₹0 Delivery)</strong>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setShowSubModal(false)} style={{ flex: 1, padding: '10px' }}>Cancel</button>
              <button type="submit" disabled={isProcessingPayment} style={{ flex: 1.5, padding: '10px', background: '#16a34a', color: '#fff', border: 'none', fontWeight: 'bold' }}>
                {isProcessingPayment ? 'Activating...' : 'Pay & Activate'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default Account;

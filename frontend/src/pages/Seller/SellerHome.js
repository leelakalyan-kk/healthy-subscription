import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';

const socket = io();

const playAlertSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {}
};

const SellerHome = () => {
  const { currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [foods, setFoods] = useState([]);

  // Payout Summary States
  const [payoutSummary, setPayoutSummary] = useState({
    totalGrossSales: 0,
    platformCommission: 0,
    netEarnings: 0,
    totalWithdrawn: 0,
    availableBalance: 0,
    withdrawals: []
  });

  // Withdrawal Modal Form
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('UPI');
  const [upiId, setUpiId] = useState('');
  const [bankHolderName, setBankHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);

  // Add Item State (File Upload Only)
  const [imagePreview, setImagePreview] = useState('');
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    price: '',
    protein: '30g Protein',
    pincode: '520001',
    areaName: 'Benz Circle',
    city: 'Vijayawada',
    imageUrl: ''
  });

  const sellerId = currentUser?._id || currentUser?.id || currentUser?.username || 'default_seller';
  const sellerName = currentUser?.username || 'Healthy Kitchen';

  const loadData = () => {
    axios.get(`/api/orders/seller-orders/${sellerId}`)
      .then(res => setOrders(res.data))
      .catch(console.error);

    axios.get(`/api/food/seller/${sellerId}`)
      .then(res => setFoods(res.data))
      .catch(console.error);

    axios.get(`/api/seller/payout-summary/${sellerId}`)
      .then(res => setPayoutSummary(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    loadData();

    socket.on('new_order_placed', (order) => {
      if (order.sellerId === String(sellerId) || order.sellerName === sellerName) {
        setOrders(prev => [order, ...prev.filter(o => o._id !== order._id)]);
        playAlertSound();
        loadData();
      }
    });

    socket.on('withdrawal_created', () => {
      loadData();
    });

    const timer = setInterval(loadData, 4000);

    return () => {
      socket.off('new_order_placed');
      socket.off('withdrawal_created');
      clearInterval(timer);
    };
  }, [sellerId, sellerName]);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.patch('/api/orders/update-status', { orderId, status: newStatus });
      setOrders(orders.map(o => o._id === orderId ? { ...o, orderStatus: newStatus } : o));
    } catch (e) {
      alert("Failed to update status.");
    }
  };

  // Pure File Upload Handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size too large! Please upload an image under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setNewItem(prev => ({ ...prev, imageUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateFood = async (e) => {
    e.preventDefault();
    if (!newItem.title || !newItem.price) {
      alert("Please fill in Dish Title and Price!");
      return;
    }

    if (!newItem.imageUrl) {
      alert("Please upload a dish image from your device!");
      return;
    }

    try {
      await axios.post('/api/food/add', {
        ...newItem,
        sellerId,
        sellerName
      });
      alert("🎉 Food item added to your kitchen catalog!");
      setNewItem({
        title: '',
        description: '',
        price: '',
        protein: '30g Protein',
        pincode: '520001',
        areaName: 'Benz Circle',
        city: 'Vijayawada',
        imageUrl: ''
      });
      setImagePreview('');
      setActiveTab('menu');
      loadData();
    } catch (err) {
      alert("Failed to add product.");
    }
  };

  const handleDeleteFood = async (id) => {
    if (!window.confirm("Delete this food item?")) return;
    try {
      await axios.delete(`/api/food/${id}`);
      setFoods(foods.filter(f => f._id !== id));
    } catch (e) {
      alert("Failed to delete.");
    }
  };

  const handleWithdrawalSubmit = async (e) => {
    e.preventDefault();
    const amountNum = Number(withdrawAmount);

    if (!amountNum || amountNum < 100) {
      alert("Minimum withdrawal is ₹100");
      return;
    }

    if (amountNum > payoutSummary.availableBalance) {
      alert(`Insufficient balance! Available: ₹${payoutSummary.availableBalance}`);
      return;
    }

    setIsSubmittingWithdrawal(true);
    try {
      const res = await axios.post('/api/seller/request-withdrawal', {
        sellerId,
        sellerName,
        amount: amountNum,
        payoutMethod,
        bankHolderName: bankHolderName || sellerName,
        accountNumber,
        ifscCode,
        upiId
      });

      alert(`🎉 Payout of ₹${amountNum} successfully processed! Reference ID: ${res.data.withdrawal?.referenceId}`);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || "Withdrawal request failed.");
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px' }}>
      
      {/* Seller Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', borderRadius: '18px', padding: '26px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <span style={{ background: '#16a34a', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase' }}>Verified Partner Kitchen</span>
          <h1 style={{ margin: '6px 0 2px 0', fontSize: '26px' }}>👨‍🍳 {sellerName}</h1>
          <p style={{ margin: 0, fontSize: '13px', opacity: 0.8 }}>Live Order Management & Instant Payout Desk</p>
        </div>

        <button
          onClick={() => setShowWithdrawModal(true)}
          style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 6px 15px rgba(22, 163, 74, 0.3)' }}
        >
          💰 Request Withdrawal
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap' }}>
        {[
          { id: 'orders', label: `📥 Incoming Orders (${orders.filter(o => o.orderStatus !== 'Delivered' && o.orderStatus !== 'Cancelled').length})` },
          { id: 'menu', label: `🍽️ Kitchen Menu (${foods.length})` },
          { id: 'add-product', label: '➕ Add New Dish' },
          { id: 'revenue', label: '💵 Payouts & Ledger' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: activeTab === tab.id ? '2px solid #16a34a' : '1px solid #cbd5e1',
              background: activeTab === tab.id ? '#ecfdf5' : '#ffffff',
              color: activeTab === tab.id ? '#16a34a' : '#475569',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. 📥 ORDERS TAB */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orders.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>No incoming customer orders yet.</p>
          ) : (
            orders.map(order => (
              <div key={order._id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '16px' }}>Order #{order._id.substring(18)}</strong>
                    <span style={{ background: '#ecfdf5', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>{order.orderStatus}</span>
                  </div>
                  <p style={{ margin: '4px 0', color: '#475569', fontSize: '13px' }}>
                    Customer: <strong>{order.customerName}</strong> • {order.deliveryAddress}
                  </p>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    {order.items?.map(i => `${i.title} (x${i.qty})`).join(', ')}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <strong style={{ fontSize: '18px', color: '#16a34a' }}>₹{order.totalAmount}</strong>
                  
                  {order.orderStatus === 'Order Placed' && (
                    <button onClick={() => handleUpdateOrderStatus(order._id, 'Preparing')} style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                      🍳 Start Cooking
                    </button>
                  )}
                  {order.orderStatus === 'Preparing' && (
                    <button onClick={() => handleUpdateOrderStatus(order._id, 'Out for Delivery')} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                      🛵 Food Ready • Hand to Rider
                    </button>
                  )}
                  {order.orderStatus === 'Out for Delivery' && (
                    <button onClick={() => handleUpdateOrderStatus(order._id, 'Delivered')} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ✅ Mark Delivered
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. 🍽️ MENU CATALOG TAB */}
      {activeTab === 'menu' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {foods.map(food => (
            <div key={food._id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
              <img src={food.imageUrl} alt={food.title} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
              <div style={{ padding: '14px' }}>
                <h4 style={{ margin: '0 0 4px 0' }}>{food.title}</h4>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b' }}>📍 {food.areaName}, {food.city} ({food.pincode})</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#16a34a', fontSize: '16px' }}>₹{food.price}</strong>
                  <button onClick={() => handleDeleteFood(food._id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. ➕ ADD PRODUCT TAB (ONLY UPLOAD FILE) */}
      {activeTab === 'add-product' && (
        <form onSubmit={handleCreateFood} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#0f172a' }}>➕ Add New Healthy Dish</h3>
          
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Dish Title *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Keto Grilled Paneer Salad"
              value={newItem.title} 
              onChange={e => setNewItem({ ...newItem, title: e.target.value })} 
              required 
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Description</label>
            <textarea 
              className="form-input" 
              rows="2"
              placeholder="e.g. Fresh cottage cheese with avocado greens & herbs"
              value={newItem.description} 
              onChange={e => setNewItem({ ...newItem, description: e.target.value })} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Price (₹) *</label>
              <input type="number" className="form-input" placeholder="e.g. 249" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} required />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Protein Tag</label>
              <input type="text" className="form-input" placeholder="e.g. 35g Protein" value={newItem.protein} onChange={e => setNewItem({ ...newItem, protein: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Kitchen PIN *</label>
              <input type="text" maxLength="6" className="form-input" placeholder="520001" value={newItem.pincode} onChange={e => setNewItem({ ...newItem, pincode: e.target.value })} required />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Area Name *</label>
              <input type="text" className="form-input" placeholder="Benz Circle" value={newItem.areaName} onChange={e => setNewItem({ ...newItem, areaName: e.target.value })} required />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>City *</label>
              <input type="text" className="form-input" placeholder="Vijayawada" value={newItem.city} onChange={e => setNewItem({ ...newItem, city: e.target.value })} required />
            </div>
          </div>

          {/* SINGLE UPLOAD INPUT BOX */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '8px' }}>🖼️ Upload Dish Image *</label>
            
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              required={!newItem.imageUrl}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px dashed #94a3b8',
                borderRadius: '8px',
                background: '#ffffff',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            />
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>Supported formats: JPG, PNG, WEBP (Max 5MB)</span>

            {/* Preview */}
            {imagePreview && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ width: '80px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                />
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#16a34a' }}>✓ Image Selected</span>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>Ready to publish to customer feed.</p>
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="btn-green" style={{ width: 'fit-content', padding: '10px 24px', fontSize: '14px' }}>
            Publish Dish to Marketplace
          </button>
        </form>
      )}

      {/* 4. 💵 PAYOUTS & TRANSACTION LEDGER TAB */}
      {activeTab === 'revenue' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 'bold' }}>Available Balance for Withdrawal</span>
              <h2 style={{ margin: '6px 0 0 0', fontSize: '32px', color: '#15803d', fontWeight: '800' }}>
                ₹{payoutSummary.availableBalance}
              </h2>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Total Gross Sales</span>
              <h2 style={{ margin: '6px 0 0 0', fontSize: '28px', color: '#0f172a', fontWeight: '800' }}>
                ₹{payoutSummary.totalGrossSales}
              </h2>
              <span style={{ fontSize: '11px', color: '#64748b' }}>From {payoutSummary.completedOrdersCount} orders</span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Platform Fee (5%)</span>
              <h2 style={{ margin: '6px 0 0 0', fontSize: '28px', color: '#dc2626', fontWeight: '800' }}>
                -₹{payoutSummary.platformCommission}
              </h2>
              <span style={{ fontSize: '11px', color: '#16a34a' }}>Net: ₹{payoutSummary.netEarnings}</span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Total Withdrawn</span>
              <h2 style={{ margin: '6px 0 0 0', fontSize: '28px', color: '#2563eb', fontWeight: '800' }}>
                ₹{payoutSummary.totalWithdrawn}
              </h2>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>📜 Payout & Withdrawal Transaction Ledger</h3>
              <button onClick={() => setShowWithdrawModal(true)} style={{ background: '#ecfdf5', color: '#15803d', border: '1px solid #86efac', padding: '6px 14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                + New Withdrawal
              </button>
            </div>

            {payoutSummary.withdrawals.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '30px 0' }}>No payout withdrawals made yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 14px' }}>Date</th>
                      <th style={{ padding: '12px 14px' }}>Reference ID</th>
                      <th style={{ padding: '12px 14px' }}>Method</th>
                      <th style={{ padding: '12px 14px' }}>Destination</th>
                      <th style={{ padding: '12px 14px' }}>Amount</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutSummary.withdrawals.map(w => (
                      <tr key={w._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', color: '#64748b' }}>
                          {new Date(w.createdAt).toLocaleDateString()} {new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0f172a' }}>
                          {w.referenceId || `TXN_${w._id.substring(18)}`}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: w.payoutMethod === 'UPI' ? '#eff6ff' : '#fef3c7', color: w.payoutMethod === 'UPI' ? '#1d4ed8' : '#b45309', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px' }}>
                            {w.payoutMethod}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#334155' }}>
                          {w.payoutMethod === 'UPI' ? w.upiId : `${w.accountNumber} (${w.ifscCode})`}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#16a34a', fontSize: '14px' }}>
                          ₹{w.amount}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: '#ecfdf5', color: '#15803d', padding: '3px 10px', borderRadius: '20px', fontWeight: 'bold', fontSize: '11px' }}>
                            ● {w.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WITHDRAWAL MODAL */}
      {showWithdrawModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', padding: '26px', maxWidth: '480px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>💰 Request Payout Withdrawal</h3>
              <button onClick={() => setShowWithdrawModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 'bold' }}>Available Balance:</span>
              <strong style={{ fontSize: '20px', color: '#15803d' }}>₹{payoutSummary.availableBalance}</strong>
            </div>

            <form onSubmit={handleWithdrawalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Withdrawal Amount (₹) *</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Min ₹100"
                  max={payoutSummary.availableBalance}
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Payout Method</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  {['UPI', 'BANK_TRANSFER'].map(m => (
                    <label key={m} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: payoutMethod === m ? '2px solid #16a34a' : '1px solid #cbd5e1', background: payoutMethod === m ? '#ecfdf5' : '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                      <input type="radio" name="payoutMethod" checked={payoutMethod === m} onChange={() => setPayoutMethod(m)} />
                      {m === 'UPI' ? '📱 Instant UPI' : '🏦 Bank Transfer'}
                    </label>
                  ))}
                </div>
              </div>

              {payoutMethod === 'UPI' ? (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>UPI ID (VPA) *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. kitchen@okaxis"
                    value={upiId}
                    onChange={e => setUpiId(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Bank Account Holder Name *</label>
                    <input type="text" className="form-input" value={bankHolderName} onChange={e => setBankHolderName(e.target.value)} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Account Number *</label>
                      <input type="text" className="form-input" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>IFSC Code *</label>
                      <input type="text" className="form-input" value={ifscCode} onChange={e => setIfscCode(e.target.value)} required />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                className="btn-green"
                disabled={isSubmittingWithdrawal}
                style={{ width: '100%', padding: '12px 0', fontSize: '15px', marginTop: '6px' }}
              >
                {isSubmittingWithdrawal ? 'Processing Transfer...' : `🚀 Confirm Withdrawal of ₹${withdrawAmount || '0'}`}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default SellerHome;

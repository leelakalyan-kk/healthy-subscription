import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';

const socket = io('/', { transports: ['websocket', 'polling'] });

// ☁️ CLOUDINARY CONFIG
const CLOUDINARY_CLOUD_NAME = "bkqftd5a";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

const SellerHome = () => {
  const { currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('menu');
  const [orders, setOrders] = useState([]);
  const [foods, setFoods] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    price: '',
    protein: 'High Protein',
    pincode: '520001',
    areaName: 'Benz Circle',
    city: 'Vijayawada',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'
  });

  const activeUser = currentUser || JSON.parse(localStorage.getItem('active_user') || '{}');
  const sellerId = String(activeUser._id || activeUser.id || activeUser.username || 'tests');
  const sellerName = activeUser.username || activeUser.name || 'tests';

  const loadData = useCallback(async () => {
    try {
      const [orderRes, foodRes] = await Promise.all([
        axios.get(`/api/orders/seller-orders/${sellerId}`),
        axios.get(`/api/food/seller/${sellerId}`)
      ]);

      if (Array.isArray(orderRes.data)) setOrders(orderRes.data);
      if (Array.isArray(foodRes.data)) {
        const seen = new Set();
        const clean = foodRes.data.filter(item => {
          const id = String(item._id || item.id);
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        setFoods(clean);
      }
    } catch (err) {
      console.error("Error loading seller data:", err);
    }
  }, [sellerId]);

  useEffect(() => {
    loadData();

    const handleNewOrder = (order) => {
      setOrders(prev => [order, ...prev.filter(o => o._id !== order._id)]);
    };

    const handleFoodAdded = (newFood) => {
      setFoods(prev => [newFood, ...prev.filter(f => f._id !== newFood._id)]);
    };

    const handleFoodDeleted = (deletedId) => {
      setFoods(prev => prev.filter(f => f._id !== deletedId));
    };

    socket.on('new_order_placed', handleNewOrder);
    socket.on('food_added', handleFoodAdded);
    socket.on('food_deleted', handleFoodDeleted);

    return () => {
      socket.off('new_order_placed', handleNewOrder);
      socket.off('food_added', handleFoodAdded);
      socket.off('food_deleted', handleFoodDeleted);
    };
  }, [loadData]);

  // ☁️ Direct Cloudinary Upload Function
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: data
      });
      const fileData = await res.json();
      
      if (fileData.secure_url) {
        setNewItem(prev => ({ ...prev, imageUrl: fileData.secure_url }));
        alert("✅ Image uploaded to Cloudinary successfully!");
      } else {
        // Fallback to lightweight compressed base64 if preset is unsigned in Cloudinary console
        console.warn("Preset error, fallback to compressed image:", fileData);
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const scale = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setNewItem(prev => ({ ...prev, imageUrl: canvas.toDataURL('image/jpeg', 0.7) }));
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error("Cloudinary error:", err);
      alert("Cloudinary connection error.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddFood = async (e) => {
    e.preventDefault();
    if (!newItem.title || !newItem.price) {
      alert("Please fill in Dish Title and Price!");
      return;
    }

    try {
      const res = await axios.post('/api/food/add', {
        ...newItem,
        sellerId,
        sellerName
      });

      const added = res.data.food || res.data;
      if (added && added._id) {
        setFoods(prev => [added, ...prev.filter(f => f._id !== added._id)]);
      }

      alert("🎉 Food item added to your kitchen catalog!");
      setNewItem({
        title: '',
        description: '',
        price: '',
        protein: 'High Protein',
        pincode: '520001',
        areaName: 'Benz Circle',
        city: 'Vijayawada',
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'
      });
      setActiveTab('menu');
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to add product.");
    }
  };

  const handleDeleteFood = async (id) => {
    if (!window.confirm("Are you sure you want to delete this dish?")) return;
    try {
      await axios.delete(`/api/food/${id}`);
      setFoods(prev => prev.filter(f => f._id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete product.");
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Seller Header */}
      <div style={{
        background: '#0f172a',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <span style={{ background: '#16a34a', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
            VERIFIED PARTNER KITCHEN
          </span>
          <h2 style={{ margin: '8px 0 4px 0', fontSize: '24px', fontWeight: '800' }}>
            👨‍🍳 {sellerName}
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            Live Order Management & Instant Kitchen Desk
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('menu')}
          style={{
            padding: '8px 18px',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: activeTab === 'menu' ? '#16a34a' : '#cbd5e1',
            background: activeTab === 'menu' ? '#ecfdf5' : '#ffffff',
            color: activeTab === 'menu' ? '#16a34a' : '#475569',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          🍽️ Kitchen Menu ({foods.length})
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '8px 18px',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: activeTab === 'orders' ? '#16a34a' : '#cbd5e1',
            background: activeTab === 'orders' ? '#ecfdf5' : '#ffffff',
            color: activeTab === 'orders' ? '#16a34a' : '#475569',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          📥 Incoming Orders ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('add')}
          style={{
            padding: '8px 18px',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: activeTab === 'add' ? '#16a34a' : '#cbd5e1',
            background: activeTab === 'add' ? '#ecfdf5' : '#ffffff',
            color: activeTab === 'add' ? '#16a34a' : '#475569',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          ➕ Add New Dish
        </button>
      </div>

      {/* Tab 1: Kitchen Menu */}
      {activeTab === 'menu' && (
        <div>
          {foods.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '16px' }}>
              <span style={{ fontSize: '40px' }}>🍲</span>
              <h3 style={{ margin: '12px 0 6px 0', color: '#0f172a' }}>No dishes added to your menu yet</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>Add your first healthy meal to start accepting orders.</p>
              <button
                onClick={() => setActiveTab('add')}
                style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                ➕ Add Dish
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {foods.map(item => (
                <div key={item._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                  <div style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{item.title}</h4>
                      <span style={{ color: '#16a34a', fontWeight: '800', fontSize: '16px' }}>₹{item.price}</span>
                    </div>
                    <p style={{ margin: '0 0 12px 0', color: '#64748b', fontSize: '12px', lineHeight: '1.4' }}>{item.description || 'Nutritious meal'}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ background: '#ecfdf5', color: '#16a34a', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                        {item.protein || 'High Protein'}
                      </span>
                      <button
                        onClick={() => handleDeleteFood(item._id)}
                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Add New Dish */}
      {activeTab === 'add' && (
        <form onSubmit={handleAddFood} style={{ maxWidth: '600px', background: '#fff', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '16px' }}>
          <h3 style={{ margin: '0 0 18px 0', color: '#0f172a' }}>➕ Add New Healthy Dish</h3>
          
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Dish Title *</label>
            <input
              type="text"
              placeholder="e.g. Grilled Chicken Quinoa Bowl"
              value={newItem.title}
              onChange={e => setNewItem({ ...newItem, title: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Price (₹) *</label>
              <input
                type="number"
                placeholder="249"
                value={newItem.price}
                onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Category / Protein</label>
              <select
                value={newItem.protein}
                onChange={e => setNewItem({ ...newItem, protein: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
              >
                <option value="High Protein">High Protein</option>
                <option value="Salad">Salad</option>
                <option value="Keto">Keto</option>
                <option value="Bowl">Bowl</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Description</label>
            <textarea
              placeholder="Describe nutritional value and ingredients..."
              value={newItem.description}
              onChange={e => setNewItem({ ...newItem, description: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', minHeight: '80px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Dish Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ width: '100%', fontSize: '13px' }}
            />
            {uploadingImage && <p style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>⏳ Uploading to Cloudinary ({CLOUDINARY_CLOUD_NAME})...</p>}
            {newItem.imageUrl && (
              <img src={newItem.imageUrl} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px' }} />
            )}
          </div>

          <button
            type="submit"
            disabled={uploadingImage}
            style={{
              width: '100%',
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              padding: '12px',
              borderRadius: '8px',
              fontWeight: '800',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            {uploadingImage ? 'Uploading Image...' : '🚀 Publish Dish to Menu'}
          </button>
        </form>
      )}

      {/* Tab 3: Incoming Orders */}
      {activeTab === 'orders' && (
        <div>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '16px' }}>
              <span style={{ fontSize: '40px' }}>📦</span>
              <h3 style={{ margin: '12px 0 6px 0', color: '#0f172a' }}>No active orders</h3>
              <p style={{ color: '#64748b', fontSize: '13px' }}>New incoming orders will appear here automatically in real time.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {orders.map(ord => (
                <div key={ord._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: '#0f172a' }}>Order #{ord._id.slice(-6)}</strong>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Customer: <strong>{ord.customerName}</strong></div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Items: {ord.items?.map(i => `${i.title} (x${i.qty})`).join(', ')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: '#16a34a', display: 'block', marginBottom: '6px' }}>₹{ord.totalAmount}</span>
                      <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}>
                        {ord.orderStatus || 'Order Placed'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default SellerHome;

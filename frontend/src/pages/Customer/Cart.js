import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';

const Cart = () => {
  const navigate = useNavigate();
  const { cartItems, updateQuantity, removeFromCart, clearCart } = useContext(CartContext);
  const { currentUser } = useContext(AuthContext);

  const subtotal = (cartItems || []).reduce((sum, item) => sum + (Number(item.price) * Number(item.qty || 1)), 0);
  const gstAmount = subtotal > 0 ? Math.round(subtotal * 0.05) : 0;
  const platformFee = subtotal > 0 ? 5 : 0;
  const deliveryFee = subtotal > 0 ? (subtotal < 199 ? 30 : 0) : 0;
  const grandTotal = subtotal + gstAmount + platformFee + deliveryFee;

  const handleProceedToPay = () => {
    if (cartItems.length === 0) return;
    
    // Pass complete bill breakdown to checkout
    const orderSummary = {
      items: cartItems,
      subtotal,
      gstAmount,
      platformFee,
      deliveryFee,
      grandTotal
    };

    localStorage.setItem('checkout_order_summary', JSON.stringify(orderSummary));
    navigate('/checkout', { state: orderSummary });
  };

  if (!cartItems || cartItems.length === 0) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center', padding: '30px' }}>
        <span style={{ fontSize: '48px' }}>🛒</span>
        <h3 style={{ color: '#0f172a', margin: '12px 0 6px 0' }}>Your Cart is Empty</h3>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Add some fresh and healthy meals to get started!</p>
        <button
          onClick={() => navigate('/')}
          style={{ marginTop: '14px', background: '#16a34a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
        >
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '16px' }}>🛍️ Review Order & Bill</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* Cart Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cartItems.map((item) => (
            <div key={item._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '15px', color: '#0f172a' }}>{item.title}</strong>
                <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>₹{item.price} each</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                  <button
                    onClick={() => updateQuantity(item._id, (item.qty || 1) - 1)}
                    style={{ background: '#f8fafc', border: 'none', padding: '4px 10px', cursor: 'pointer', fontWeight: '700' }}
                  >
                    -
                  </button>
                  <span style={{ padding: '4px 10px', fontSize: '13px', fontWeight: '700' }}>{item.qty || 1}</span>
                  <button
                    onClick={() => updateQuantity(item._id, (item.qty || 1) + 1)}
                    style={{ background: '#f8fafc', border: 'none', padding: '4px 10px', cursor: 'pointer', fontWeight: '700' }}
                  >
                    +
                  </button>
                </div>

                <strong style={{ fontSize: '15px', color: '#16a34a', minWidth: '60px', textAlign: 'right' }}>
                  ₹{Number(item.price) * Number(item.qty || 1)}
                </strong>
              </div>
            </div>
          ))}
        </div>

        {/* Bill Details Box */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', height: 'fit-content' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            Bill Breakdown
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#475569' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Item Subtotal:</span>
              <span>₹{subtotal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>GST (5% Restaurant Tax):</span>
              <span>₹{gstAmount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Platform Fee:</span>
              <span>₹{platformFee}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Delivery Fee ({subtotal < 199 ? '< ₹199' : 'Free > ₹199'}):</span>
              <span style={{ color: deliveryFee === 0 ? '#16a34a' : '#475569', fontWeight: '700' }}>
                {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
              </span>
            </div>

            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              <span>To Pay:</span>
              <span style={{ color: '#16a34a' }}>₹{grandTotal}</span>
            </div>
          </div>

          <button
            onClick={handleProceedToPay}
            style={{
              width: '100%',
              marginTop: '18px',
              background: '#16a34a',
              color: '#fff',
              border: 'none',
              padding: '12px',
              borderRadius: '10px',
              fontWeight: '800',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Proceed to Pay ₹{grandTotal} ➔
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;

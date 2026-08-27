import React, { useState } from 'react';
import axios from 'axios';

const CartDrawer = ({ isOpen, onClose, cart = [], updateQuantity, currentLocation }) => {
  const [selectedMethod, setSelectedMethod] = useState('UPI');
  const [upiId, setUpiId] = useState('kalyan@okhdfcbank');
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  if (!isOpen) return null;

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);

    try {
      const activeUser = JSON.parse(localStorage.getItem('active_user') || '{}');
      const userId = activeUser._id || activeUser.id || activeUser.username || 'guest_user';
      const customerName = activeUser.username || activeUser.name || 'Customer';

      const res = await axios.post('/api/payment/sandbox-pay', {
        userId,
        customerName,
        items: cart,
        totalAmount,
        deliveryAddress: currentLocation,
        paymentType: `Sandbox (${selectedMethod})`
      });

      if (res.data?.success) {
        setPaymentSuccess({
          txnId: res.data.txnId || 'TXN_' + Math.floor(100000 + Math.random() * 900000),
          method: selectedMethod
        });
        localStorage.removeItem('user_cart');
        setTimeout(() => {
          window.location.reload();
        }, 2200);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Payment failed. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 2000,
      display: 'flex',
      justifyContent: 'flex-end'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        height: '100%',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 25px rgba(0,0,0,0.15)',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🛒</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              Your Meal Cart ({cart.reduce((s, i) => s + i.qty, 0)})
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              fontWeight: 'bold',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {paymentSuccess ? (
            <div style={{ textAlign: 'center', padding: '50px 14px', color: '#16a34a' }}>
              <span style={{ fontSize: '52px', display: 'block', marginBottom: '12px' }}>🎉</span>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800' }}>Order Placed Successfully!</h4>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 8px 0' }}>Paid via Sandbox ({paymentSuccess.method})</p>
              <span style={{ background: '#ecfdf5', color: '#16a34a', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                Ref: {paymentSuccess.txnId}
              </span>
            </div>
          ) : cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 10px', color: '#64748b' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>🍽️</span>
              <h4 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Your cart is empty</h4>
              <p style={{ fontSize: '13px', margin: 0 }}>Add fresh meals to test payment sandbox.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Cart Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {cart.map(item => (
                  <div
                    key={item._id}
                    style={{
                      display: 'flex',
                      gap: '10px',
                      padding: '10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      background: '#ffffff',
                      alignItems: 'center'
                    }}
                  >
                    <img
                      src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}
                      alt={item.title}
                      style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <h5 style={{ margin: '0 0 2px 0', fontSize: '13px', color: '#0f172a', fontWeight: '700' }}>
                        {item.title}
                      </h5>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#16a34a' }}>
                        ₹{item.price}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#ecfdf5',
                      border: '1px solid #86efac',
                      borderRadius: '6px'
                    }}>
                      <button
                        onClick={() => updateQuantity(item._id, -1)}
                        style={{ background: 'transparent', border: 'none', padding: '2px 8px', color: '#15803d', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        -
                      </button>
                      <span style={{ padding: '0 4px', fontWeight: '700', color: '#15803d', fontSize: '12px' }}>
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQuantity(item._id, 1)}
                        style={{ background: 'transparent', border: 'none', padding: '2px 8px', color: '#15803d', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Hub Badge */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>Delivering to:</span>
                <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600' }}>{currentLocation}</span>
              </div>

              {/* Sandbox Payment Options */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>💳 Select Sandbox Payment</strong>
                  <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800' }}>
                    TEST MODE
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {/* Option 1: UPI */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: selectedMethod === 'UPI' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                    background: selectedMethod === 'UPI' ? '#ecfdf5' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    <input
                      type="radio"
                      name="payment_method"
                      checked={selectedMethod === 'UPI'}
                      onChange={() => setSelectedMethod('UPI')}
                    />
                    <span>⚡ Instant UPI (GPay / PhonePe / Paytm)</span>
                  </label>

                  {/* Option 2: Card */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: selectedMethod === 'CARD' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                    background: selectedMethod === 'CARD' ? '#ecfdf5' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    <input
                      type="radio"
                      name="payment_method"
                      checked={selectedMethod === 'CARD'}
                      onChange={() => setSelectedMethod('CARD')}
                    />
                    <span>💳 Test Debit / Credit Card</span>
                  </label>

                  {/* Option 3: COD */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: selectedMethod === 'COD' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                    background: selectedMethod === 'COD' ? '#ecfdf5' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    <input
                      type="radio"
                      name="payment_method"
                      checked={selectedMethod === 'COD'}
                      onChange={() => setSelectedMethod('COD')}
                    />
                    <span>💵 Cash on Delivery (Pay on Arrival)</span>
                  </label>
                </div>

                {/* Sub-inputs based on method */}
                {selectedMethod === 'UPI' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Sandbox UPI ID</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={e => setUpiId(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {selectedMethod === 'CARD' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={e => setCardNumber(e.target.value)}
                      placeholder="Card Number"
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={e => setCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                      />
                      <input
                        type="text"
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value)}
                        placeholder="CVV"
                        style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && !paymentSuccess && (
          <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>To Pay</span>
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>₹{totalAmount}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
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
              {isCheckingOut ? 'Simulating Sandbox Payment...' : `Pay ₹${totalAmount} via Sandbox ${selectedMethod}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;

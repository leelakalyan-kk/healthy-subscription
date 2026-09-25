import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function FloatingChatbot({ mode = 'customer' }) {
  const [isOpen, setIsOpen] = useState(false);
  const isSeller = mode === 'seller';
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketIssue, setTicketIssue] = useState(isSeller ? 'Dish/Menu Issue' : 'Delivery Delay');
  const [ticketMsg, setTicketMsg] = useState('');
  const [ticketOrderId, setTicketOrderId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeUser = JSON.parse(localStorage.getItem('active_user') || '{}');
  const userIdentifier = activeUser._id || activeUser.id || activeUser.username;

  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: isSeller
        ? 'Hello Kitchen Partner! 👨‍🍳 Ask about your live orders, paste an Order ID (e.g. 63436B), or check payouts!'
        : 'Welcome to HealthyBites! 🌱 Ask about your last order, track status by ID, or check meal subscriptions!'
    }
  ]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Dynamic Query Resolver via Database API
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const newMsgs = [...messages, { sender: 'user', text: userText }];
    setMessages(newMsgs);
    setInput('');

    const q = userText.toLowerCase();
    const orderIdMatch = userText.match(/[a-fA-F0-9]{6}/);
    let reply = "";

    try {
      if (q.includes('ticket') || q.includes('my query') || q.includes('issue status') || q.includes('complaint')) {
        const userContact = activeUser.phone || activeUser.username || '';
        const res = await axios.get(`/api/extra/support/tickets/user/${userContact}`).catch(() => ({ data: [] }));
        const list = Array.isArray(res.data) ? res.data : [];

        if (list.length > 0) {
          const t = list[0];
          reply = `🎧 Your Support Ticket Status (#${t.ticketId}):\n• Issue: ${t.issueType}\n• Status: ${t.status === 'OPEN' ? '⏳ Under Review by Agent' : '✅ RESOLVED'}\n• Message: "${t.message}"\n• Raised on: ${new Date(t.createdAt).toLocaleDateString()} at ${new Date(t.createdAt).toLocaleTimeString()}`;
        } else {
          reply = "You haven't raised any support tickets yet. Click '🚨 Raise Ticket' below if you need direct agent assistance!";
        }
      } else if (orderIdMatch) {
        const queryShortId = orderIdMatch[0].toUpperCase();
        const res = await axios.get('/api/orders/seller-orders/all').catch(() => ({ data: [] }));
        const found = (res.data || []).find(o => (o._id || '').toUpperCase().endsWith(queryShortId));

        if (found) {
          const itemsStr = (found.items || []).map(i => `${i.qty}x ${i.title}`).join(', ');
          const dateStr = new Date(found.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          reply = `📦 Order #${queryShortId} Details:\n• Status: ${found.orderStatus}\n• Items: ${itemsStr}\n• Total: ₹${found.totalAmount}\n• Placed: ${dateStr}\n• Customer: ${found.customerName} (${found.customerPhone || 'N/A'})\n• Address: ${found.deliveryAddress}`;
        } else {
          reply = `🔍 Checked records, but couldn't find Order #${queryShortId}. Please verify the 6-digit ID or tap 'Raise Ticket' below.`;
        }
      } else if (q.includes('last order') || q.includes('recent order') || q.includes('my order') || q.includes('order status')) {
        const userEndpoint = isSeller ? `/api/orders/seller-orders/${userIdentifier}` : `/api/orders/user-orders/${userIdentifier}`;
        const res = await axios.get(userEndpoint).catch(() => ({ data: [] }));
        const list = Array.isArray(res.data) ? res.data : [];

        if (list.length > 0) {
          const last = list[0];
          const shortId = (last._id || '').slice(-6).toUpperCase();
          const itemsStr = (last.items || []).map(i => `${i.qty}x ${i.title}`).join(', ');
          const dateStr = new Date(last.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          const timeStr = new Date(last.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

          reply = `🛍️ Your Latest Order (#${shortId}):\n• Status: ${last.orderStatus}\n• Dishes: ${itemsStr}\n• Total Paid: ₹${last.totalAmount}\n• Placed On: ${dateStr} at ${timeStr}\n• OTP: ${last.deliveryOtp || 'Last 4 digits of phone'}`;
        } else {
          reply = "You don't have any placed orders yet. Explore our fresh menu or weekly subscriptions!";
        }
      } else if (isSeller) {
        if (q.includes('payout') || q.includes('payment') || q.includes('money') || q.includes('withdraw') || q.includes('earning')) {
          reply = "💰 90% of dish sales are credited to your Available Balance immediately after delivery. Go to 'Withdraw & Payouts' to request an instant UPI payout.";
        } else if (q.includes('dish') || q.includes('menu') || q.includes('food') || q.includes('add')) {
          reply = "👨‍🍳 Click '➕ Add New Dish' under 'My Dishes' tab. Once saved, it will show up live on the customer home page.";
        } else if (q.includes('cancel') || q.includes('rider delay') || q.includes('help')) {
          reply = "Need agent assistance? Tap '🚨 Raise Ticket' below to connect directly with the helpdesk operations team.";
        } else {
          reply = "I'm your Kitchen Ops Assistant! You can paste an Order ID (e.g. 63436B), ask 'what was my last order', or inquire about payouts.";
        }
      } else {
        if (q.includes('live deliveries') || q.includes('delivery') || q.includes('track') || q.includes('rider')) {
          reply = "🛵 You can track your rider GPS live under 'Track Live' in your orders list. The verification code is always the last 4 digits of your phone!";
        } else if (q.includes('subscription') || q.includes('meal') || q.includes('plan')) {
          reply = "🥗 Subscriptions have ₹0 delivery fee! You can customize tomorrow's dish in your Account tab before 8:00 PM.";
        } else if (q.includes('wallet')) {
          reply = "💰 HealthyBites Wallet offers 1-click checkout with instant refunds for cancelled orders. Top up anytime in your Account tab.";
        } else {
          reply = "I'm your healthy food assistant! Paste an Order ID (e.g. 63436B) to check live status, ask 'when was my last order', or ask 'ticket status'.";
        }
      }
    } catch (err) {
      reply = "Connected to support assistant. Please try asking about your order or raise a ticket below.";
    }

    setMessages(prev => [...prev, { sender: 'bot', text: reply }]);
  };

  const handleRaiseTicket = async (e) => {
    e.preventDefault();
    if (!ticketMsg.trim()) return alert('Please enter issue details');
    setIsSubmitting(true);

    try {
      const res = await axios.post('/api/extra/support/ticket/create', {
        senderRole: isSeller ? 'seller' : 'customer',
        senderName: activeUser.username || (isSeller ? 'Kitchen' : 'Customer'),
        senderContact: activeUser.phone || '8309720219',
        orderId: ticketOrderId,
        issueType: ticketIssue,
        message: ticketMsg
      });

      if (res.data?.success) {
        alert(`✅ Support Ticket #${res.data.ticket.ticketId} Raised! Assigned to Helpdesk.`);
        setShowTicketForm(false);
        setTicketMsg('');
        setTicketOrderId('');
        setMessages(prev => [...prev, { sender: 'bot', text: `🎧 Support Ticket #${res.data.ticket.ticketId} created! An active helpdesk agent is reviewing your query.` }]);
      }
    } catch (err) {
      alert('Failed to raise ticket: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '22px', right: '22px', zIndex: 99999, fontFamily: 'sans-serif' }}>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            background: isSeller ? '#0f172a' : '#16a34a',
            color: '#ffffff',
            border: '2px solid #86efac',
            borderRadius: '50px',
            padding: '12px 18px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: '800',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: '16px' }}>{isSeller ? '👨‍🍳' : '🎧'}</span>
          <span>{isSeller ? 'Kitchen Bot' : 'Support Bot'}</span>
        </button>
      )}

      {isOpen && (
        <div style={{
          width: '340px',
          height: '480px',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 12px 35px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #cbd5e1'
        }}>
          <div style={{
            background: isSeller ? '#0f172a' : '#16a34a',
            color: '#fff',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong style={{ fontSize: '13px', display: 'block' }}>
                {isSeller ? '👨‍🍳 Kitchen Ops Assistant' : '🌱 HealthyBites Support'}
              </strong>
              <span style={{ fontSize: '10px', color: '#86efac' }}>● Live DB Connected</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>

          {!showTicketForm ? (
            <>
              <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc' }}>
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: m.sender === 'user' ? (isSeller ? '#0f172a' : '#16a34a') : '#ffffff',
                      color: m.sender === 'user' ? '#ffffff' : '#1e293b',
                      padding: '9px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                      lineHeight: '1.45',
                      whiteSpace: 'pre-line',
                      border: m.sender === 'bot' ? '1px solid #e2e8f0' : 'none'
                    }}
                  >
                    {m.text}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div style={{ padding: '8px 12px', background: '#ecfdf5', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '700' }}>Need Agent Call?</span>
                <button
                  type="button"
                  onClick={() => setShowTicketForm(true)}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                >
                  🚨 Raise Ticket
                </button>
              </div>

              <form onSubmit={handleSend} style={{ display: 'flex', padding: '8px', background: '#fff', borderTop: '1px solid #e2e8f0' }}>
                <input
                  type="text"
                  placeholder="e.g. 63436B or ticket status..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                />
                <button
                  type="submit"
                  style={{ marginLeft: '6px', background: isSeller ? '#0f172a' : '#16a34a', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  ➤
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleRaiseTicket} style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#ffffff', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>Direct Agent Support Ticket</strong>
                <button type="button" onClick={() => setShowTicketForm(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}>Back</button>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#475569', fontWeight: '700' }}>ISSUE TYPE</label>
                <select value={ticketIssue} onChange={e => setTicketIssue(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }}>
                  {isSeller ? (
                    <>
                      <option value="Rider Delay / Not Reached">Rider Delay / Not Reached</option>
                      <option value="Payout Dispute">Payout / UPI Dispute</option>
                      <option value="Order Cancellation">Force Cancel Order</option>
                      <option value="General Query">General Query</option>
                    </>
                  ) : (
                    <>
                      <option value="Delivery Delay">Delivery Delay / Rider Lost</option>
                      <option value="Food Quality / Spilled">Food Quality / Spilled Item</option>
                      <option value="Refund Required">Payment Debited / Refund Required</option>
                      <option value="Subscription Query">Subscription Query</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#475569', fontWeight: '700' }}>ORDER ID (OPTIONAL)</label>
                <input type="text" placeholder="e.g. 63436B" value={ticketOrderId} onChange={e => setTicketOrderId(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: '#475569', fontWeight: '700' }}>DESCRIBE ISSUE *</label>
                <textarea rows="3" placeholder="Briefly describe what happened..." value={ticketMsg} onChange={e => setTicketMsg(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px', boxSizing: 'border-box' }} required />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                {isSubmitting ? 'Submitting...' : '🚀 Submit to Helpdesk Desk'}
              </button>
            </form>
          )}

        </div>
      )}
    </div>
  );
}

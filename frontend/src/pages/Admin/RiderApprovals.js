import React, { useState, useEffect } from 'react';

export default function RiderApprovals() {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  // Delivery Partner Server IP
  const API_BASE = 'http://15.206.179.97';

  const fetchPendingRiders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/riders/pending`);
      const data = await res.json();
      if (data.success) {
        setRiders(data.riders || []);
      }
    } catch (err) {
      console.error('Failed to load pending riders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRiders();
  }, []);

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you want to approve this delivery partner?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/riders/${id}/approve`, {
        method: 'PUT',
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Rider partner approved successfully!');
        fetchPendingRiders();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error approving rider: ' + err.message);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection reason (e.g. Blurry documents, Invalid RC):');
    if (!reason) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/riders/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        alert('❌ Rider rejected.');
        fetchPendingRiders();
      }
    } catch (err) {
      alert('Error rejecting rider: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>Delivery Partner Verification Desk</h2>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Review submitted KYC, Driving Licenses, and Vehicle RC documents</span>
        </div>
        <button 
          onClick={fetchPendingRiders}
          style={{ padding: '8px 16px', background: '#1e293b', border: '1px solid #334155', color: '#22c55e', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}
        >
          🔄 Refresh List
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading verification requests...</p>
      ) : riders.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#131920', borderRadius: '12px', border: '1px dashed #334155', color: '#94a3b8' }}>
          🎉 No pending approvals right now. All delivery partners are verified!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {riders.map((r) => (
            <div key={r._id} style={{ background: '#131920', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: '#ffffff' }}>{r.name}</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>📱 {r.phone} | ✉️ {r.email}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#22c55e' }}>@{r.username}</p>
                  </div>
                  <span style={{ fontSize: '10px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(251, 191, 36, 0.3)', fontFamily: 'monospace' }}>
                    {r.approvalStatus || 'Pending'}
                  </span>
                </div>

                <div style={{ margin: '14px 0', background: '#0b0e11', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', border: '1px solid #1e293b' }}>
                  <p style={{ margin: '0 0 4px 0', color: '#cbd5e1' }}><strong>Vehicle:</strong> {r.vehicleDetails?.vehicleModel || 'Not Provided'}</p>
                  <p style={{ margin: 0, color: '#cbd5e1' }}><strong>Reg Number:</strong> {r.vehicleDetails?.vehicleNumber || 'Not Provided'}</p>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  {r.documents?.licenseUrl ? (
                    <button 
                      type="button"
                      onClick={() => setSelectedImage(r.documents.licenseUrl)}
                      style={{ flex: 1, padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      📄 View License
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#f87171' }}>No License Uploaded</span>
                  )}

                  {r.documents?.rcUrl ? (
                    <button 
                      type="button"
                      onClick={() => setSelectedImage(r.documents.rcUrl)}
                      style={{ flex: 1, padding: '8px', background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      📑 View RC Book
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#f87171' }}>No RC Uploaded</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleApprove(r._id)}
                  style={{ padding: '9px', background: '#22c55e', color: '#052e16', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
                >
                  ✓ Approve Partner
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(r._id)}
                  style={{ padding: '9px', background: 'transparent', color: '#f87171', border: '1px solid #ef4444', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}
        >
          <div style={{ maxWidth: '600px', width: '100%', background: '#131920', border: '1px solid #334155', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
            <img src={selectedImage} alt="Document Proof" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', objectFit: 'contain' }} />
            <button 
              type="button"
              onClick={() => setSelectedImage(null)}
              style={{ marginTop: '14px', padding: '8px 24px', background: '#22c55e', color: '#052e16', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

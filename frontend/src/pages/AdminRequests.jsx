import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Check, X, Search, CheckCircle, XCircle } from 'lucide-react';

const AdminRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState({ message: '', type: '' });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/requests');
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      setStatus({ message: 'Approving request...', type: 'info' });
      const res = await api.post(`/approve/${id}`);
      setStatus({ message: res.data.message || 'Request approved successfully', type: 'success' });
      fetchRequests();
    } catch (err) {
      setStatus({ message: err.response?.data?.message || 'Failed to approve request', type: 'error' });
    }
  };

  const handleReject = async (id) => {
    if (window.confirm('Are you sure you want to reject this request?')) {
      try {
        setStatus({ message: 'Rejecting request...', type: 'info' });
        const res = await api.post(`/reject/${id}`);
        setStatus({ message: res.data.message || 'Request rejected', type: 'success' });
        fetchRequests();
      } catch (err) {
        setStatus({ message: err.response?.data?.message || 'Failed to reject request', type: 'error' });
      }
    }
  };

  const filteredRequests = requests.filter(req => 
    req.name.toLowerCase().includes(search.toLowerCase()) || 
    req.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Access Requests</h1>
          <p style={{ color: 'var(--text-muted)' }}>Review and manage user account requests</p>
        </div>
      </div>

      {status.message && (
        <div className="animate-fade-in" style={{
          backgroundColor: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : status.type === 'info' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          color: status.type === 'error' ? 'var(--danger)' : status.type === 'info' ? '#3b82f6' : 'var(--success)',
          border: `1px solid ${status.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : status.type === 'info' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
          padding: '0.75rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {status.type === 'error' ? <XCircle size={18} /> : <CheckCircle size={18} />}
          {status.message}
        </div>
      )}

      <div className="card glass animate-fade-in" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Search size={18} />
              </div>
              <input 
                type="text" 
                className="input-field" 
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                placeholder="Search requests by name or email..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead style={{ backgroundColor: '#f8fafc' }}>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Loading requests...</td></tr>
              ) : filteredRequests.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No requests found</td></tr>
              ) : (
                filteredRequests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
                          {req.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{req.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{req.email}</td>
                    <td>
                      <span className={`badge ${req.role === 'Admin' ? 'badge-danger' : req.role === 'Employee' ? 'badge-primary' : 'badge-success'}`}>
                        {req.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${req.status === 'Pending' ? 'badge-warning' : req.status === 'Approved' ? 'badge-success' : 'badge-danger'}`} style={{ backgroundColor: req.status === 'Pending' ? '#fef3c7' : req.status === 'Approved' ? '#d1fae5' : '#fee2e2', color: req.status === 'Pending' ? '#d97706' : req.status === 'Approved' ? '#059669' : '#dc2626' }}>
                        {req.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {req.status === 'Pending' ? (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button style={{ color: 'var(--success)', padding: '0.5rem 0.75rem', border: '1px solid var(--success)', borderRadius: '4px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }} onClick={() => handleApprove(req.id)}>
                            <Check size={16} /> Approve
                          </button>
                          <button style={{ color: 'var(--danger)', padding: '0.5rem 0.75rem', border: '1px solid var(--danger)', borderRadius: '4px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }} onClick={() => handleReject(req.id)}>
                            <X size={16} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', paddingRight: '0.5rem' }}>Processed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminRequests;

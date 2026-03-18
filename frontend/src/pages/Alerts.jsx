import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { BellRing, CheckCircle, AlertTriangle } from 'lucide-react';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts');
      setAlerts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (id) => {
    try {
      await api.put(`/alerts/${id}/acknowledge`);
      setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'Acknowledged' } : a));
    } catch (err) {
      alert('Failed to acknowledge alert');
    }
  };

  const unacknowledgedCount = alerts.filter(a => a.status === 'Unacknowledged').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            System Alerts
            {unacknowledgedCount > 0 && (
              <span style={{ fontSize: '0.875rem', backgroundColor: 'var(--danger)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '99px', fontWeight: 600 }}>
                {unacknowledgedCount} New
              </span>
            )}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Automated notifications for attendance anomalies</p>
        </div>
      </div>

      <div className="card glass animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
             <CheckCircle size={48} style={{ opacity: 0.2, marginBottom: '1rem', color: 'var(--success)' }} />
             <p>No alerts generated yet. Everything looks good!</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {alerts.map((alert, index) => (
              <li 
                key={alert.id} 
                style={{ 
                  padding: '1.5rem', 
                  borderBottom: index < alerts.length - 1 ? '1px solid var(--border)' : 'none',
                  backgroundColor: alert.status === 'Unacknowledged' ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ 
                    backgroundColor: alert.status === 'Unacknowledged' ? 'rgba(239, 68, 68, 0.1)' : 'var(--background)', 
                    color: alert.status === 'Unacknowledged' ? 'var(--danger)' : 'var(--text-muted)', 
                    padding: '0.75rem', 
                    borderRadius: '50%',
                    flexShrink: 0
                  }}>
                    {alert.status === 'Unacknowledged' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem', fontSize: '1rem', color: alert.status === 'Unacknowledged' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      {alert.type}
                    </h4>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {alert.message}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                
                {alert.status === 'Unacknowledged' ? (
                  <button 
                    className="btn btn-secondary" 
                    style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    Acknowledge
                  </button>
                ) : (
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Acknowledged</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Alerts;

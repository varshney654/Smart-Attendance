import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { UserPlus, Mail, User, Briefcase, GraduationCap, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

const RequestAccess = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Student');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ message: '', type: '' });

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: '', type: '' });

    if (!role) {
      setStatus({ message: 'Please select a role', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      const res = await api.post('/request-access', { name, email, role });
      setStatus({ message: res.data.message || 'Request submitted successfully', type: 'success' });
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setStatus({ message: err.response?.data?.message || 'Failed to submit request', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
      padding: '1rem'
    }}>
      <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            color: 'white',
            padding: '1rem',
            borderRadius: '1rem',
            marginBottom: '1rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <UserPlus size={32} />
          </div>
          <h2 style={{ fontSize: '1.5rem', textAlign: 'center', color: 'var(--text-main)', margin: 0 }}>
            Request Access
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', textAlign: 'center' }}>
            Submit your details to request an account
          </p>
        </div>

        {status.message && (
          <div className="animate-fade-in" style={{
            backgroundColor: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: status.type === 'error' ? 'var(--danger)' : 'var(--success)',
            border: `1px solid ${status.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
            padding: '0.75rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}>
            {status.type === 'error' ? <XCircle size={18} /> : <CheckCircle size={18} />}
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="input-label" style={{ textAlign: 'center', display: 'block' }}>Select Role</label>
            <div style={{
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '0.25rem',
              gap: '0.25rem'
            }}>
              <button
                type="button"
                onClick={() => handleRoleChange('Employee')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem',
                  padding: '0.625rem 0',
                  borderRadius: '0.5rem',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: role === 'Employee' ? 'white' : 'transparent',
                  color: role === 'Employee' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: role === 'Employee' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                <Briefcase size={16} /> Employee
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('Student')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem',
                  padding: '0.625rem 0',
                  borderRadius: '0.5rem',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: role === 'Student' ? 'white' : 'transparent',
                  color: role === 'Student' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: role === 'Student' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                <GraduationCap size={16} /> Student
              </button>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label className="input-label" htmlFor="name">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="name"
                type="text"
                className="input-field"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label className="input-label" htmlFor="email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="email"
                type="email"
                className="input-field"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', marginBottom: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
              Sign In
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
};

export default RequestAccess;

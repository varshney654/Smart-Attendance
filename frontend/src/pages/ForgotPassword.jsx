import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Mail, Lock, KeyRound, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = email, 2 = reset
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ message: '', type: '' });

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: '', type: '' });

    try {
      const res = await api.post('/auth/send-reset-code', { email });
      setStatus({ message: res.data.message, type: 'success' });
      setStep(2);
    } catch (err) {
      setStatus({ message: err.response?.data?.message || 'Failed to send OTP', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: '', type: '' });

    if (newPassword !== confirmPassword) {
      setStatus({ message: 'Passwords do not match', type: 'error' });
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setStatus({ message: 'Password must be at least 6 characters', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      const res = await api.post('/auth/reset-password', {
        email,
        otp,
        newPassword
      });
      setStatus({ message: res.data.message, type: 'success' });
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setStatus({ message: err.response?.data?.message || 'Failed to reset password', type: 'error' });
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
            <KeyRound size={32} />
          </div>
          <h2 style={{ fontSize: '1.5rem', textAlign: 'center', color: 'var(--text-main)', margin: 0 }}>
            {step === 1 ? 'Forgot Password' : 'Reset Password'}
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', textAlign: 'center' }}>
            {step === 1 ? 'Enter your email to receive a reset code' : 'Enter the code sent to your email'}
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

        {step === 1 ? (
          <form onSubmit={handleSendOtp}>
            <div className="input-group">
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
              style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', marginTop: '1rem' }}
              disabled={loading}
            >
              {loading ? 'Sending OTP...' : 'Send Reset Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label className="input-label" htmlFor="otp">Reset Code</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="otp"
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  required
                />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label className="input-label" htmlFor="newPassword">New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="newPassword"
                  type="password"
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label className="input-label" htmlFor="confirmPassword">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="confirmPassword"
                  type="password"
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>

            <button
              type="button"
              onClick={() => { setStep(1); setStatus({ message: '', type: '' }); }}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem'
              }}
            >
              <ArrowLeft size={16} />
              Back to Email
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Remember your password?{' '}
            <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
              Sign In
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

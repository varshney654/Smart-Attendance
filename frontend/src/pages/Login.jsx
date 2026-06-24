import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, User, Briefcase, GraduationCap } from 'lucide-react';
import LoginIntro from '../components/LoginIntro';

const Login = () => {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Student'); // Default to Student as requested

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  // Warm-up check
  useEffect(() => {
    const warmUp = async () => {
      const start = Date.now();
      try {
        console.log('[WARM-UP] Pinging /api/health to wake server...');
        await api.get('/api/health', { timeout: 30000 });
        console.log(`[WARM-UP SUCCESS] Time: ${Date.now() - start}ms`);
      } catch (err) {
        console.log(`[WARM-UP FAILED/TIMEOUT] Time: ${Date.now() - start}ms. Error:`, err.message);
      }
    };
    warmUp();
  }, []);

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!role) {
      setError('Please select a role before proceeding.');
      setLoading(false);
      return;
    }

    const startTime = Date.now();
    setLoadingText('Connecting to server... Please wait.');

    const timer1 = setTimeout(() => {
      setLoadingText('Connecting to server... Please wait.');
    }, 1000);

    const timer2 = setTimeout(() => {
      setLoadingText('Server is waking up. This may take 20-30 seconds.');
    }, 5000);

    const executeLogin = async (retryCount = 0) => {
      try {
        console.log(`[REQUEST SENT] Attempt ${retryCount + 1}`);
        return await api.post('/auth/login', { email, password, role }, { timeout: 60000 });
      } catch (error) {
        if ((error.code === 'ECONNABORTED' || error.message === 'Network Error') && retryCount < 2) {
          console.log(`[REQUEST FAILED] Retrying authentication (${retryCount + 1}/2)...`);
          return await executeLogin(retryCount + 1);
        }
        throw error;
      }
    };

    try {
      const response = await executeLogin();
      const duration = Date.now() - startTime;
      console.log(`[RESPONSE RECEIVED] Time: ${duration}ms`);
      
      clearTimeout(timer1);
      clearTimeout(timer2);

      login(response.data.user, response.data.token);
      console.log('[JWT RECEIVED]');
      
      console.log('[ROLE VERIFIED]');
      console.log('[NAVIGATING TO DASHBOARD]');
      console.log('[LOGIN SUCCESS]');

      // Redirect intelligently based exactly on the Role requested by User prompt
      if (response.data.user.role === 'Admin') {
        navigate('/dashboard');
      } else if (response.data.user.role === 'Student') {
        navigate('/mark-attendance');
      } else if (response.data.user.role === 'Employee') {
        navigate('/dashboard');
      } else {
        navigate('/dashboard'); // Fallback
      }
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      console.log('[LOGIN FAILED]');
      console.error('Detailed Error:', err);
      
      let errorMessage = 'Failed to sign in securely. Please check your network connection.';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Server is taking longer than expected to respond.';
      } else if (err.message === 'Network Error') {
        errorMessage = 'Unable to reach server. Please check your connection.';
      } else if (err.response) {
        if (err.response.status === 401) {
          errorMessage = 'Invalid email or password.';
        } else if (err.response.status === 500) {
          errorMessage = 'Server error occurred. Please try again.';
        } else {
          errorMessage = err.response.data?.message || err.response.data?.title || errorMessage;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  return (
    <LoginIntro>
      <div className="card glass animate-fade-in dark-glass-card" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <img 
            src="/logo.png" 
            alt="Smart Attendance Logo" 
            style={{ 
              width: '64px', 
              height: '64px', 
              objectFit: 'contain',
              marginBottom: '1rem',
              filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.3))'
            }} 
          />
          <h2 className="dark-text" style={{ fontSize: '1.75rem', fontWeight: 700, textAlign: 'center', margin: 0 }}>
            <span className="text-smart">Smart</span> Attendance
          </h2>
          <p className="dark-text-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', fontWeight: 500 }}>
            Your Digital Attendance System
          </p>
        </div>

        {error && (
          <div className="animate-fade-in" style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--danger)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div className="animate-fade-in" style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--success)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Unified Role Toggle Selection (Glassmorphism Pill design) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="input-label dark-text" style={{ textAlign: 'center', display: 'block' }}>Select Role</label>
            <div className="dark-role-selector" style={{
              display: 'flex',
              borderRadius: '0.75rem',
              marginTop: '0.5rem'
            }}>
              <button
                type="button"
                onClick={() => handleRoleChange('Admin')}
                className={role === 'Admin' ? 'dark-role-btn-active' : 'dark-role-btn-inactive'}
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
                  backgroundColor: 'transparent'
                }}
              >
                <User size={16} /> Admin
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('Employee')}
                className={role === 'Employee' ? 'dark-role-btn-active' : 'dark-role-btn-inactive'}
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
                  backgroundColor: 'transparent'
                }}
              >
                <Briefcase size={16} /> Employee
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('Student')}
                className={role === 'Student' ? 'dark-role-btn-active' : 'dark-role-btn-inactive'}
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
                  backgroundColor: 'transparent'
                }}
              >
                <GraduationCap size={16} /> Student
              </button>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label dark-text" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input-field dark-input-field"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="input-label dark-text" htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: '#22c55e', textDecoration: 'none', fontWeight: 500 }}>
                Forgot Password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              className="input-field dark-input-field"
              style={{ marginTop: '0.5rem' }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn green-submit-btn"
            style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? loadingText : 'Sign In To Proceed'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="dark-text-muted" style={{ fontSize: '0.875rem' }}>
            Need an account?{' '}
            <Link to="/request-access" style={{ color: '#22c55e', textDecoration: 'none', fontWeight: 500 }}>
              Request Access
            </Link>
          </span>
        </div>
      </div>
    </LoginIntro>
  );
};

export default Login;

import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, User, Briefcase, GraduationCap } from 'lucide-react';

const Login = () => {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Student'); // Default to Student as requested
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

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

    try {
      const response = await api.post('/auth/login', { email, password, role });
      login(response.data.user, response.data.token);
      
      // Redirect intelligently based exactly on the Role requested by User prompt
      if (response.data.user.role === 'Admin') {
        navigate('/dashboard');
      } else if (response.data.user.role === 'Student') {
        navigate('/mark-attendance');
      } else if (response.data.user.role === 'Employee') {
        navigate('/employee-dashboard');
      } else {
        navigate('/'); // Fallback
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to sign in securely.`);
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
            <Camera size={32} />
          </div>
          <h2 style={{ fontSize: '1.5rem', textAlign: 'center', color: 'var(--text-main)', margin: 0 }}>
            Welcome Back
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
            Sign in to Smart Attendance
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
                onClick={() => handleRoleChange('Admin')}
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
                  backgroundColor: role === 'Admin' ? 'white' : 'transparent',
                  color: role === 'Admin' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: role === 'Admin' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                <User size={16} /> Admin
              </button>
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

          <div className="input-group">
            <label className="input-label" htmlFor="email">Email</label>
            <input 
              id="email"
              type="email" 
              className="input-field" 
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="input-label" htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                Forgot Password?
              </Link>
            </div>
            <input 
              id="password"
              type="password" 
              className="input-field" 
              style={{ marginTop: '0.5rem' }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In To Proceed'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

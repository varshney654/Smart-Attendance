import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Admin'); // Default to Admin for demo registration
  const [department, setDepartment] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isLogin) {
        const response = await api.post('/auth/login', { email, password });
        login(response.data.user, response.data.token);
        navigate('/');
      } else {
        await api.post('/auth/register', { name, email, password, role, department });
        setSuccess('Registration successful! Please sign in.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${isLogin ? 'login' : 'register'}`);
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
      <div className="card glass animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
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
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
            {isLogin ? 'Sign in to Smart Attendance' : 'Register for Smart Attendance'}
          </p>
        </div>

        {error && (
          <div style={{ 
            backgroundColor: 'var(--danger)', 
            color: 'white', 
            padding: '0.75rem', 
            borderRadius: '0.5rem', 
            marginBottom: '1rem',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ 
            backgroundColor: 'var(--success)', 
            color: 'white', 
            padding: '0.75rem', 
            borderRadius: '0.5rem', 
            marginBottom: '1rem',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="input-group">
              <label className="input-label" htmlFor="name">Full Name</label>
              <input 
                id="name"
                type="text" 
                className="input-field" 
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label" htmlFor="email">Email</label>
            <input 
              id="email"
              type="email" 
              className="input-field" 
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group" style={{ marginBottom: isLogin ? '1.5rem' : '1rem' }}>
            <label className="input-label" htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              className="input-field" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {!isLogin && (
            <>
              <div className="input-group">
                <label className="input-label" htmlFor="role">Role</label>
                <select 
                  id="role"
                  className="input-field" 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                >
                  <option value="Admin">Admin</option>
                  <option value="Employee">Employee</option>
                  <option value="Student">Student</option>
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label className="input-label" htmlFor="department">Department</label>
                <input 
                  id="department"
                  type="text" 
                  className="input-field" 
                  placeholder="IT"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            </>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '0.875rem', fontSize: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Register')}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setSuccess('');
            }}
            style={{
              color: 'var(--primary)',
              fontWeight: 600,
              display: 'inline-block'
            }}
          >
            {isLogin ? "Register now" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;

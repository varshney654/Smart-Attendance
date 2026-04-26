import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

const Header = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 2rem',
      backgroundColor: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)',
      position: 'sticky',
      top: 0,
      zIndex: 5
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img src="/logo.png" alt="Smart Attendance Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
          Smart Attendance
        </h1>
      </div>

      <button
        onClick={logout}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          color: 'white',
          fontWeight: 500,
          borderRadius: '0.5rem',
          backgroundColor: 'var(--danger)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
      >
        <LogOut size={18} />
        Logout
      </button>
    </header>
  );
};

export default Header;

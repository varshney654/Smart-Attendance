import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Camera, 
  FileText, 
  BarChart2, 
  Users, 
  FileBox, 
  BellRing,
  LogOut
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);

  const links = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { to: '/mark-attendance', label: 'Mark Attendance', icon: <Camera size={20} /> },
    { to: '/records', label: 'Records', icon: <FileText size={20} /> },
    { to: '/analytics', label: 'Analytics', icon: <BarChart2 size={20} /> },
    { to: '/reports', label: 'Reports', icon: <FileBox size={20} /> },
    { to: '/alerts', label: 'Alerts', icon: <BellRing size={20} /> },
  ];

  if (user?.role === 'Admin') {
    links.splice(4, 0, { to: '/users', label: 'Manage Users', icon: <Users size={20} /> });
  }

  return (
    <aside style={{
      width: '260px',
      backgroundColor: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem',
      position: 'sticky',
      top: 0,
      height: '100vh'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          color: 'white',
          padding: '0.5rem',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Camera size={24} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Smart Attendance</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>AI Analytics System</p>
        </div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              color: isActive ? 'var(--primary)' : 'var(--text-main)',
              backgroundColor: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s',
            })}
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 500, fontSize: '0.875rem' }}>{user?.name}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.role}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            width: '100%',
            padding: '0.75rem 1rem',
            color: 'var(--danger)',
            fontWeight: 500,
            borderRadius: '0.5rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
          }}
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

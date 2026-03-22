import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MarkAttendance from './pages/MarkAttendance';
import Records from './pages/Records';
import Analytics from './pages/Analytics';
import ManageUsers from './pages/ManageUsers';
import Reports from './pages/Reports';
import Alerts from './pages/Alerts';
import RegisterFace from './pages/RegisterFace';

const ProtectedRoute = ({ children, roles }) => {
  const { user } = useContext(AuthContext);
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" />; // Redirect to their default view
  }

  return children;
};

function App() {
  const { user } = useContext(AuthContext);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="mark-attendance" element={<MarkAttendance />} />
        <Route path="records" element={<Records />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="users" element={<ProtectedRoute roles={['Admin']}><ManageUsers /></ProtectedRoute>} />
        <Route path="register-face" element={<ProtectedRoute roles={['Admin']}><RegisterFace /></ProtectedRoute>} />
        <Route path="reports" element={<Reports />} />
        <Route path="alerts" element={<Alerts />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;

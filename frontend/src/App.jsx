import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import MarkAttendance from './pages/MarkAttendance';
import Records from './pages/Records';
import Analytics from './pages/Analytics';
import ManageUsers from './pages/ManageUsers';
import Reports from './pages/Reports';
import Alerts from './pages/Alerts';
import RegisterFace from './pages/RegisterFace';
import RequestAccess from './pages/RequestAccess';
import AdminRequests from './pages/AdminRequests';
import ProtectedRoute from './components/ProtectedRoute';
import GenerateQR from './pages/GenerateQR';
import ScanQR from './pages/ScanQR';

function App() {
  const { user } = useContext(AuthContext);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <ForgotPassword />} />
      <Route path="/request-access" element={user ? <Navigate to="/" /> : <RequestAccess />} />
      
      <Route path="/" element={
        user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
      } />
      
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/mark-attendance" element={<MarkAttendance />} />
        <Route path="/scan-qr" element={<ScanQR />} />
        <Route path="/records" element={<Records />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/users" element={<ProtectedRoute roles={['Admin']}><ManageUsers /></ProtectedRoute>} />
        <Route path="/register-face" element={<ProtectedRoute roles={['Admin']}><RegisterFace /></ProtectedRoute>} />
        <Route path="/generate-qr" element={<ProtectedRoute roles={['Admin']}><GenerateQR /></ProtectedRoute>} />
        <Route path="/admin-requests" element={<ProtectedRoute roles={['Admin']}><AdminRequests /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={['Admin']}><Reports /></ProtectedRoute>} />
        <Route path="/alerts" element={<Alerts />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;

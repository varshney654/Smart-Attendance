/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
import React, { createContext, useState, useEffect, useMemo } from 'react';

export const AuthContext = createContext();

function useLocalStorageUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (savedUser && token) {
      try {
        // Basic JWT validation (check expiry)
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.log('[AUTH] Token expired, clearing session');
            localStorage.clear();
            sessionStorage.clear();
            setUser(null);
          } else {
            setUser(JSON.parse(savedUser));
          }
        }
      } catch (e) {
        console.error("Failed to parse token or user from local storage", e);
        localStorage.clear();
        sessionStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  return { user, setUser, loading };
}

export const AuthProvider = ({ children }) => {
  const { user, setUser, loading } = useLocalStorageUser();
  
  const value = useMemo(() => ({
    user,
    login: (userData, token) => {
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', token);
      setUser(userData);
    },
    logout: () => {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('role'); // if any
      sessionStorage.clear();
      setUser(null);
      window.location.href = '/login'; // Force redirect and reload state
    }
  }), [user, setUser]);

  if (loading) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>Loading...</div>;

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

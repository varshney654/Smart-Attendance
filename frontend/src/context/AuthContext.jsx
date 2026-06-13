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
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse user from local storage", e);
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
      setUser(null);
    }
  }), [user, setUser]);

  if (loading) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>Loading...</div>;

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

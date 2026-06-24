import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from './AuthContext';

export const FaceCacheContext = createContext();

export const FaceCacheProvider = ({ children }) => {
  const [faceDataCache, setFaceDataCache] = useState([]);
  const [loadingCache, setLoadingCache] = useState(false);
  const [cacheError, setCacheError] = useState(null);
  
  const { user } = useContext(AuthContext);

  const fetchFaceData = async () => {
    if (!user) return; // Only fetch if logged in
    
    setLoadingCache(true);
    setCacheError(null);
    try {
      const res = await api.get('/face/data');
      setFaceDataCache(res.data);
    } catch (err) {
      console.error('Failed to load face data cache:', err);
      setCacheError('Failed to load biometric data.');
    } finally {
      setLoadingCache(false);
    }
  };

  useEffect(() => {
    fetchFaceData();
  }, [user]);

  return (
    <FaceCacheContext.Provider value={{ faceDataCache, loadingCache, cacheError, refreshFaceCache: fetchFaceData }}>
      {children}
    </FaceCacheContext.Provider>
  );
};

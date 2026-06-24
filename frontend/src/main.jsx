import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { FaceCacheProvider } from './context/FaceCacheContext.jsx';
import { BrowserRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FaceCacheProvider>
          <App />
        </FaceCacheProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

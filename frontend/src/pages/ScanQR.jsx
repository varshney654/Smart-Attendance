import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { QrCode, ArrowRight } from 'lucide-react';

const ScanQR = () => {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    // Check if there is already a scanner running, if so, we don't need to re-init
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: {width: 250, height: 250} },
      false
    );

    scanner.render(
      (decodedText) => {
        setScanResult(decodedText);
        scanner.clear();
        
        // If it's a URL belonging to our app, redirect
        try {
          const url = new URL(decodedText);
          if (url.pathname === '/mark-attendance' && url.searchParams.has('session')) {
            navigate(`/mark-attendance?session=${url.searchParams.get('session')}`);
          } else {
             // Treat it as a raw session token if not a URL
             navigate(`/mark-attendance?session=${decodedText}`);
          }
        } catch {
          // If not a URL, assume it's just the token
          navigate(`/mark-attendance?session=${decodedText}`);
        }
      },
      (error) => {
        // Handle scan errors silently
      }
    );

    return () => {
      scanner.clear().catch(error => console.error('Failed to clear scanner', error));
    };
  }, [navigate]);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <QrCode size={28} /> Scan Attendance QR
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Scan the QR code displayed by your instructor</p>
      </div>

      <div className="card glass animate-fade-in" style={{ padding: '2rem' }}>
        <div id="qr-reader" style={{ width: '100%', borderRadius: '1rem', overflow: 'hidden' }}></div>
        
        {scanResult && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <span>Session Code Detected!</span>
            <ArrowRight size={18} className="animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanQR;

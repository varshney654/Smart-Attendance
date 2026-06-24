import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { v4 as uuidv4 } from 'uuid';
import { QrCode, Copy, RefreshCw, Check } from 'lucide-react';

const GenerateQR = () => {
  const [sessionToken, setSessionToken] = useState(uuidv4());
  const [copied, setCopied] = useState(false);

  const generateNew = () => {
    setSessionToken(uuidv4());
    setCopied(false);
  };

  const attendanceUrl = `${window.location.origin}/mark-attendance?session=${sessionToken}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(attendanceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Attendance QR Code</h1>
        <p style={{ color: 'var(--text-muted)' }}>Generate a secure session QR code for students to scan.</p>
      </div>

      <div className="card glass animate-fade-in" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', boxShadow: 'var(--shadow-md)', marginBottom: '2rem' }}>
          <QRCodeSVG 
            value={attendanceUrl} 
            size={256} 
            bgColor={"#ffffff"}
            fgColor={"#0f172a"}
            level={"H"}
            includeMargin={true}
          />
        </div>

        <div style={{ textAlign: 'center', width: '100%', maxWidth: '500px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Session Token:</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', backgroundColor: '#f1f5f9', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <code style={{ flex: 1, wordBreak: 'break-all', color: 'var(--text-main)', fontWeight: 600 }}>{sessionToken}</code>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button 
              className="btn btn-secondary" 
              onClick={copyToClipboard}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copied URL' : 'Copy URL'}
            </button>
            <button 
              className="btn btn-primary" 
              onClick={generateNew}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={18} />
              Generate New Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateQR;

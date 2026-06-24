import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { Camera, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { initMediaPipe, initFaceAPI, getFaceDescriptor } from '../utils/faceUtils';

const RegisterFace = () => {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState({ message: 'Select a user and start the camera.', type: 'info' });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [isFaceAligned, setIsFaceAligned] = useState(false);

  useEffect(() => {
    fetchUsers();
    loadAI();
    return () => {
      stopCamera();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch {
      setStatus({ message: 'Failed to fetch users.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadAI = async () => {
    try {
      setStatus({ message: 'Loading high-speed AI models...', type: 'info' });
      faceLandmarkerRef.current = await initMediaPipe();
      await initFaceAPI();
      setModelsLoaded(true);
      setStatus({ message: 'Models loaded. Ready to start camera.', type: 'success' });
    } catch (err) {
      setStatus({ message: `Failed to load AI models: ${err.message}`, type: 'error' });
      console.error(err);
    }
  };

  const startCamera = async () => {
    if (!modelsLoaded) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } // responsive for mobile
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.play();
        setCameraActive(true);
        setStatus({ message: 'Look at the camera. Wait for alignment...', type: 'info' });
        
        // Start continuous checking for alignment
        checkAlignment();
      }
    } catch {
      setStatus({ message: 'Failed to access webcam.', type: 'error' });
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    setIsFaceAligned(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  let lastVideoTime = -1;
  const checkAlignment = () => {
    if (!videoRef.current || !faceLandmarkerRef.current || !cameraActive) {
      animationFrameRef.current = requestAnimationFrame(checkAlignment);
      return;
    }

    const videoEl = videoRef.current;
    
    if (videoEl.readyState === 4 && videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;
      let startTimeMs = performance.now();
      const results = faceLandmarkerRef.current.detectForVideo(videoEl, startTimeMs);
      
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        // Assume face is visible and somewhat centered. We could add strict bounds checking here.
        setIsFaceAligned(true);
        setStatus({ message: 'Face Aligned. You can capture now.', type: 'success' });
      } else {
        setIsFaceAligned(false);
        setStatus({ message: 'Face not visible or too far.', type: 'warning' });
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(checkAlignment);
  };

  const handleCapture = async () => {
    if (!selectedUserId) {
      setStatus({ message: 'Please select a user first.', type: 'error' });
      return;
    }

    if (!videoRef.current || !streamRef.current || !cameraActive) {
      setStatus({ message: 'Please start the camera first.', type: 'error' });
      return;
    }

    if (!isFaceAligned) {
      setStatus({ message: 'Please align your face before capturing.', type: 'warning' });
      return;
    }

    setCapturing(true);
    setStatus({ message: 'Extracting high-quality biometric features...', type: 'info' });

    try {
      // Get 1 very accurate descriptor
      const descriptor = await getFaceDescriptor(videoRef.current);
      
      if (descriptor) {
        setStatus({ message: 'Uploading biometric data...', type: 'info' });
        
        await api.post('/face/register', {
          userId: selectedUserId,
          faceData: [descriptor] // Sending 1 high-quality embedding instead of 5
        });

        setStatus({ message: 'Face registered successfully! Cache will be updated automatically.', type: 'success' });
        setTimeout(() => {
           stopCamera();
           setSelectedUserId('');
        }, 1500);
      } else {
        setStatus({ message: 'Failed to extract features. Please try again.', type: 'error' });
      }
    } catch (err) {
      setStatus({ message: err.response?.data?.message || 'Error occurred during registration.', type: 'error' });
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Register Face</h1>
        <p style={{ color: 'var(--text-muted)' }}>Enroll a user's face with instant 1-shot capture</p>
      </div>

      <div className="card glass animate-fade-in" style={{ padding: '2rem' }}>
        {status.message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                             status.type === 'warning' ? 'rgba(245, 158, 11, 0.1)' :
                             status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
            color: status.type === 'error' ? 'var(--danger)' :
                   status.type === 'warning' ? 'var(--warning)' :
                   status.type === 'success' ? 'var(--success)' : 'var(--primary)',
            fontSize: '0.875rem'
          }}>
            {status.type === 'error' ? <XCircle size={18} /> : 
             status.type === 'warning' ? <AlertTriangle size={18} /> :
             status.type === 'success' ? <CheckCircle size={18} /> : <CheckCircle size={18} />}
            {status.message}
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Select User</label>
          <select 
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={loading || capturing}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              borderRadius: '0.5rem', 
              border: '1px solid var(--border)',
              backgroundColor: 'var(--background)',
              color: 'var(--text-main)'
            }}
          >
            <option value="">-- Select a User --</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>

        <div style={{ 
          position: 'relative',
          width: '100%', 
          maxWidth: '640px', 
          margin: '0 auto 1.5rem', 
          aspectRatio: '4/3', 
          backgroundColor: '#0f172a', 
          borderRadius: '1rem', 
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: isFaceAligned ? '3px solid var(--success)' : '3px solid transparent',
          transition: 'border 0.3s'
        }}>
          <video 
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            autoPlay 
            muted 
            playsInline
          />
          {!cameraActive && (
            <div style={{ position: 'absolute', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Camera size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <p>Camera is off</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          {!cameraActive ? (
            <button 
              onClick={startCamera} 
              disabled={!modelsLoaded}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Camera size={20} />
              Start Camera
            </button>
          ) : (
            <>
              <button 
                onClick={stopCamera} 
                className="btn"
                style={{ border: '1px solid var(--border)' }}
                disabled={capturing}
              >
                Stop Camera
              </button>
              <button 
                onClick={handleCapture}
                disabled={capturing || !selectedUserId || !modelsLoaded || !isFaceAligned}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {capturing ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                {capturing ? 'Capturing...' : 'Capture & Register'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterFace;

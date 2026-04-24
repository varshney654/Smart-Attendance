import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import api from '../utils/api';
import { Camera, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';

const RegisterFace = () => {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState({ message: 'Select a user and start the camera.', type: 'info' });
  const [progress, setProgress] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    fetchUsers();
    loadModels();
    return () => {
      stopCamera();
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      setStatus({ message: 'Failed to fetch users.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      setStatus({ message: 'Loading AI models...', type: 'info' });
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
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
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
      setStatus({ message: 'Camera started. Ensure good lighting and click Capture.', type: 'info' });
    } catch (err) {
      setStatus({ message: 'Failed to access webcam.', type: 'error' });
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleCapture = async () => {
    console.log('[RegisterFace] Capture & Register clicked');
    if (!selectedUserId) {
      console.log('[RegisterFace] User not selected');
      setStatus({ message: 'Please select a user first.', type: 'error' });
      return;
    }

    if (!videoRef.current || !streamRef.current || !cameraActive) {
      console.log('[RegisterFace] Camera not started');
      setStatus({ message: 'Please start the camera first.', type: 'error' });
      return;
    }

    setCapturing(true);
    setStatus({ message: 'Extracting face features... Please look at the camera.', type: 'info' });
    console.log('[RegisterFace] Scanning face...');
    setProgress(0);

    const embeddings = [];
    const samplesNeeded = 5;
    let samplesCaptured = 0;
    let attempts = 0;
    const maxAttempts = 20;

    try {
      console.log(`[RegisterFace] Detection loop starting. Dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 });

      while (samplesCaptured < samplesNeeded && attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 600)); // slight delay

        const detection = await faceapi.detectSingleFace(videoRef.current, options)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          samplesCaptured++;
          console.log(`[RegisterFace] Sample ${samplesCaptured}/${samplesNeeded} captured (Score: ${detection.detection.score})`);
          embeddings.push(Array.from(detection.descriptor));
          setProgress((samplesCaptured / samplesNeeded) * 100);
          setStatus({ message: `Captured sample ${samplesCaptured} of ${samplesNeeded}...`, type: 'info' });
        } else {
          console.log(`[RegisterFace] Attempt ${attempts} failed: No face detected`);
          setStatus({ message: `Searching for face... Ensure good lighting.`, type: 'warning' });
        }
      }

      if (samplesCaptured < samplesNeeded) {
        console.log('[RegisterFace] Failed to capture enough samples after 20 attempts.');
        setStatus({ message: 'Failed to capture consistent samples. Please try again.', type: 'error' });
        setCapturing(false);
        return;
      }

      console.log('[RegisterFace] All samples captured. Sending to API...');
      setStatus({ message: 'Uploading face embeddings...', type: 'info' });

      await api.post('/face/register', {
        userId: selectedUserId,
        faceData: embeddings
      });

      console.log('[RegisterFace] Registered successfully');
      setStatus({ message: 'Face registered successfully!', type: 'success' });
      stopCamera();
    } catch (err) {
      console.error('[RegisterFace] Error during capture/register:', err);
      setStatus({ message: err.response?.data?.message || 'Error occurred during registration.', type: 'error' });
    } finally {
      if (samplesCaptured < samplesNeeded) setCapturing(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Register Face</h1>
        <p style={{ color: 'var(--text-muted)' }}>Enroll a user's face for AI attendance tracking</p>
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
          backgroundColor: '#000', 
          borderRadius: '1rem', 
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <video 
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            autoPlay 
            muted 
            playsInline
          />
          {!cameraActive && (
            <div style={{ position: 'absolute', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Camera size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <p>Camera is off</p>
            </div>
          )}
        </div>

        {capturing && (
          <div style={{ marginBottom: '1.5rem', height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--primary)', transition: 'width 0.3s' }}></div>
          </div>
        )}

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
                disabled={capturing || !selectedUserId || !modelsLoaded}
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

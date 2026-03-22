import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import api from '../utils/api';
import { Camera, CheckCircle, XCircle, RefreshCw, X, AlertTriangle } from 'lucide-react';

const FaceRegistrationModal = ({ userId, userName, onClose, onSuccess }) => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState({ message: 'Initializing camera...', type: 'info' });
  const [progress, setProgress] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadModels();
    return () => {
      stopCamera();
    };
  }, []);

  const loadModels = async () => {
    try {
      setStatus({ message: 'Loading AI models...', type: 'info' });
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      setModelsLoaded(true);
      setStatus({ message: 'Ready. Ensure your face is clearly visible.', type: 'info' });
      startCamera(); // Auto-start camera once models load
    } catch (err) {
      setStatus({ message: `Failed to load AI models: ${err.message}`, type: 'error' });
      console.error(err);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
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
    console.log('[FaceRegistrationModal] Start Scan clicked');
    if (!videoRef.current || !streamRef.current || !cameraActive) {
      console.log('[FaceRegistrationModal] Camera not started');
      setStatus({ message: 'Please start the camera first.', type: 'error' });
      return;
    }

    setCapturing(true);
    setStatus({ message: 'Extracting face features... Please look at the camera.', type: 'info' });
    console.log('[FaceRegistrationModal] Scanning face...');
    setProgress(0);

    const embeddings = [];
    const samplesNeeded = 5;
    let samplesCaptured = 0;
    let attempts = 0;
    const maxAttempts = 20;

    try {
      console.log(`[FaceRegistrationModal] Detection loop starting. Dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 });
      
      while (samplesCaptured < samplesNeeded && attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 600)); // slight delay to allow variations

        const detection = await faceapi.detectSingleFace(videoRef.current, options)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          samplesCaptured++;
          console.log(`[FaceRegistrationModal] Sample ${samplesCaptured}/${samplesNeeded} captured (Score: ${detection.detection.score})`);
          embeddings.push(Array.from(detection.descriptor));
          setProgress((samplesCaptured / samplesNeeded) * 100);
          setStatus({ message: `Captured sample ${samplesCaptured} of ${samplesNeeded}...`, type: 'info' });
        } else {
          console.log(`[FaceRegistrationModal] Attempt ${attempts} failed: No face detected`);
          setStatus({ message: `Searching for face... Ensure good lighting.`, type: 'warning' });
        }
      }

      if (samplesCaptured < samplesNeeded) {
        console.log('[FaceRegistrationModal] Failed to capture enough samples after 20 attempts.');
        setStatus({ message: 'Failed to capture consistent samples. Please try again.', type: 'error' });
        setCapturing(false);
        return;
      }

      console.log('[FaceRegistrationModal] All samples captured natively. Sending to API...');
      setStatus({ message: 'Uploading biometric data...', type: 'info' });

      await api.post('/face/register', {
        userId: userId,
        faceData: embeddings
      });

      console.log('[FaceRegistrationModal] Registered successfully');
      setStatus({ message: 'Face securely enrolled!', type: 'success' });
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err) {
      console.error('[FaceRegistrationModal] Error during capture/register:', err);
      setStatus({ message: err.response?.data?.message || 'Error occurred during registration.', type: 'error' });
    } finally {
      if (samplesCaptured < samplesNeeded) setCapturing(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '1rem'
    }}>
      <div className="card glass animate-fade-in" style={{
        width: '100%',
        maxWidth: '500px',
        padding: '2rem',
        position: 'relative'
      }}>
        <button 
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '1rem', right: '1rem',
            background: 'none', border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={24} />
        </button>

        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', marginTop: 0 }}>Enroll Face</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>For User: <strong>{userName}</strong></p>

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

        <div style={{ 
          position: 'relative',
          width: '100%', 
          aspectRatio: '4/3', 
          backgroundColor: '#000', 
          borderRadius: '1rem', 
          overflow: 'hidden',
          marginBottom: '1.5rem',
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
              <p>{modelsLoaded ? 'Starting camera...' : 'Loading AI Engine...'}</p>
            </div>
          )}
        </div>

        {capturing && (
          <div style={{ marginBottom: '1.5rem', height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--primary)', transition: 'width 0.3s' }}></div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={handleClose} 
            className="btn"
            style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)' }}
            disabled={capturing}
          >
            Skip for now
          </button>
          
          <button 
            onClick={handleCapture}
            disabled={capturing || !cameraActive || !modelsLoaded}
            className="btn btn-primary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {capturing ? <RefreshCw size={18} className="animate-spin" /> : <Camera size={18} />}
            {capturing ? 'Scanning...' : 'Start Scan'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FaceRegistrationModal;

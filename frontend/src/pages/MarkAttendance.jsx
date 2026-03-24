import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import api from '../utils/api';
import { Camera, CameraOff, UserCircle } from 'lucide-react';

const MarkAttendance = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const webcamRef = useRef(null);
  const [livenessTask, setLivenessTask] = useState(null);
  const [livenessStatus, setLivenessStatus] = useState('');
  const animationFrameRef = useRef(null);

  // Helper functions for liveness
  const getEAR = useCallback((eye) => {
    const ptDist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const v1 = ptDist(eye[1], eye[5]);
    const v2 = ptDist(eye[2], eye[4]);
    const h = ptDist(eye[0], eye[3]);
    return (v1 + v2) / (2.0 * h);
  }, []);

  const getHeadYaw = useCallback((landmarks) => {
    const nose = landmarks.getNose()[3];
    const leftEye = landmarks.getLeftEye()[0];
    const rightEye = landmarks.getRightEye()[3];
    const leftDist = Math.abs(nose.x - leftEye.x);
    const rightDist = Math.abs(nose.x - rightEye.x);
    return leftDist / rightDist;
  }, []);

  useEffect(() => {
    fetchUsers();
    loadModels();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadModels = async () => {
    try {
      setAiMessage('Loading AI Models...');
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      setModelsLoaded(true);
      setAiMessage('');
    } catch (err) {
      console.error('Failed to load AI models. Details:', err);
      setAiMessage('Failed to load AI models. Check console.');
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return alert('Please select a user');
    
    setLoading(true);
    try {
      // NOTE: Status and Time are intentionally omitted! The .NET Server acts as the ultimate truth.
      const res = await api.post('/attendance/mark', {
        userId: selectedUser,
        method: 'Manual'
      });
      alert(res.data.message); // Will say "Attendance automatically marked as Present/Late"
      setSelectedUser('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark manual attendance');
    } finally {
      setLoading(false);
    }
  };

  // Fetch face data on load
  const [registeredFaces, setRegisteredFaces] = useState([]);
  
  useEffect(() => {
    // We fetch global models here...
    const fetchFaceData = async () => {
      try {
        const res = await api.get('/face/data');
        setRegisteredFaces(res.data);
      } catch (err) {
        console.error('Failed to load face data from server:', err);
      }
    };
    fetchFaceData();
  }, []);

  const verifyIdentity = async (targetUser, currentDescriptor) => {
    setLivenessStatus('');
    setAiMessage('Face detected! Running 1:1 Verification Model...');

    let minDistance = Number.MAX_VALUE;

    // EXPLICIT 1:1 Matching
    for (let i = 0; i < targetUser.faceData.length; i++) {
      const dbEmbedding = targetUser.faceData[i];
      const distance = faceapi.euclideanDistance(currentDescriptor, dbEmbedding);
      
      console.log(`[MarkAttendance] Verifying Target '${targetUser.name}' (Sample ${i+1}/${targetUser.faceData.length}). Distance: ${distance.toFixed(4)}`);
      
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    const threshold = 0.5; // Strictly clamped back to 0.5 for explicit security
    console.log(`[MarkAttendance] Target matched evaluated for: ${targetUser.name} with distance ${minDistance.toFixed(4)}`);

    if (minDistance <= threshold) {
      const confidence = Math.max(0, (1 - (minDistance / threshold)) * 100).toFixed(2);
      console.log(`[MarkAttendance] Strict 1:1 Identity Confirmed for: ${targetUser.userId} (${confidence}%)`);
      setAiMessage('1:1 Match Verified! Bridging payload to .NET Core securely...');
      
      console.log('[MarkAttendance] Sending raw arrays to backend (Attendance)');
      
      try {
        const res = await api.post('/attendance/mark', {
          userId: targetUser.userId,
          method: 'AI',
          confidence: parseFloat(confidence),
          faceDescriptor: currentDescriptor, // Proxied to C# for rigorous duplicate checking
          isLive: true // Explicit liveness verified flag
        });

        // Use the authenticated result explicitly from the C# backend!
        setAiMessage(`Verified: ${targetUser.name} (${confidence}%). ${res.data.message}`);
      } catch (err) {
        console.error('[MarkAttendance] Error during capture/match:', err);
        setAiMessage(err.response?.data?.message || 'Recognition failed due to a server error.');
      }
    } else {
      console.log(`[MarkAttendance] Best face distance (${minDistance.toFixed(4)}) explicitly rejected against threshold of ${threshold}`);
      setAiMessage(`Biometric mismatch. Identity rejected. Distance: ${minDistance.toFixed(4)}`);
    }
    setTimeout(() => setAiMessage(''), 6000);
    setLoading(false);
  };

  const capture = useCallback(async () => {
    console.log('[MarkAttendance] Capture & Match clicked');
    if (!selectedUser) {
      setAiMessage('SECURITY HALT: You must explicitly select your user profile identity first.');
      return;
    }
    
    if (!webcamRef.current || !webcamRef.current.video || !modelsLoaded) {
      console.log('[MarkAttendance] Error: Camera or models not ready.');
      setAiMessage('Camera or models not ready.');
      return;
    }

    if (registeredFaces.length === 0) {
      setAiMessage('No users with registered faces found in database.');
      return;
    }

    const targetUser = registeredFaces.find(u => u.userId === selectedUser);
    if (!targetUser || !targetUser.faceData || targetUser.faceData.length === 0) {
      setAiMessage('The selected user completely lacks a biometric facial template.');
      return;
    }

    // Initialize Liveness Challenge
    const task = Math.random() > 0.5 ? 'blink' : 'turn';
    setLivenessTask(task);
    setLivenessStatus(`LIVENESS CHECK: Please ${task === 'blink' ? 'blink your eyes quickly' : 'turn your head slightly left or right'}. (15s timeout)`);
    setLoading(true);

    const startTime = Date.now();
    let blinkCount = 0;
    let isLiveVerified = false;
    let bestDescriptor = null;

    const detectLiveness = async () => {
      // 15 seconds timeout
      if (Date.now() - startTime > 15000) {
        setLivenessStatus('Fake attempt detected. Timeout exceeded.');
        setLivenessTask(null);
        setLoading(false);
        return;
      }

      if (!webcamRef.current || !webcamRef.current.video) {
        animationFrameRef.current = setTimeout(detectLiveness, 100);
        return;
      }

      const videoEl = webcamRef.current.video;
      if (videoEl.readyState !== 4) {
        animationFrameRef.current = setTimeout(detectLiveness, 100);
        return;
      }

      try {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
        const detection = await faceapi.detectSingleFace(videoEl, options)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          bestDescriptor = Array.from(detection.descriptor);
          const landmarks = detection.landmarks;

          if (task === 'blink') {
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            const leftEAR = getEAR(leftEye);
            const rightEAR = getEAR(rightEye);
            const avgEAR = (leftEAR + rightEAR) / 2.0;
            
            if (avgEAR < 0.25) { // Blink threshold
              blinkCount++;
            } else if (blinkCount > 0) {
              isLiveVerified = true;
            }
          } else if (task === 'turn') {
            const yaw = getHeadYaw(landmarks);
            if (yaw > 1.8 || yaw < 0.55) { // Sufficient turn
              isLiveVerified = true;
            }
          }
        }
      } catch (err) {
        console.error("Liveness detection error", err);
      }

      if (isLiveVerified && bestDescriptor) {
        setLivenessStatus('Liveness verified! Proceeding to identify...');
        setLivenessTask(null); // Clear challenge UI
        await verifyIdentity(targetUser, bestDescriptor);
      } else {
        // Continue checking
        animationFrameRef.current = setTimeout(detectLiveness, 150);
      }
    };

    detectLiveness();
    
    // Cleanup function not strictly needed for setTimeout loop if component stays mounted,
    // but good practice. We clear this timeout inside detectLiveness on success/timeout.

  }, [webcamRef, modelsLoaded, registeredFaces, selectedUser, getEAR, getHeadYaw]);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Mark Attendance</h1>
        <p style={{ color: 'var(--text-muted)' }}>Automated time-based execution strictly authenticated by the backend.</p>
      </div>

      <div className="card glass" style={{ marginBottom: '2rem', padding: '1.5rem', background: 'linear-gradient(to right, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label" htmlFor="globalUserSelect" style={{ color: 'var(--primary)', fontWeight: 600 }}>Target Identity (Who are you?)</label>
          <select 
            id="globalUserSelect"
            className="input-field" 
            value={selectedUser} 
            onChange={(e) => setSelectedUser(e.target.value)}
            style={{ fontSize: '1.1rem', padding: '0.75rem 1rem', borderColor: 'var(--primary)' }}
            required
          >
            <option value="">Choose an authorized profile to verify against...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* AI Camera Section */}
        <div className="card glass animate-fade-in" style={{ 
          opacity: selectedUser ? 1 : 0.5, 
          transition: 'opacity 0.3s ease',
          pointerEvents: selectedUser ? 'auto' : 'none' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <Camera size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', margin: 0 }}>Strict 1:1 Facial Verification</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {modelsLoaded ? 'Secure mapping module activated' : 'Loading AI Models...'}
              </p>
            </div>
          </div>

          <div style={{ 
            backgroundColor: '#f1f5f9', 
            borderRadius: '0.5rem', 
            height: '300px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '1rem',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {cameraActive ? (
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ width: 1280, height: 720, facingMode: "user" }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {(aiMessage || livenessStatus) && (
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '1rem', 
                    left: '50%', 
                    transform: 'translateX(-50%)',
                    backgroundColor: livenessStatus.includes('Fake') ? 'rgba(220, 38, 38, 0.9)' : (livenessStatus.includes('verified') ? 'rgba(22, 163, 74, 0.9)' : 'rgba(0,0,0,0.85)'),
                    color: 'white',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    zIndex: 10,
                    fontWeight: 500,
                    border: '1px solid rgba(255,255,255,0.1)',
                    textAlign: 'center',
                    minWidth: '250px'
                  }}>
                    {livenessStatus ? livenessStatus : aiMessage}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <CameraOff size={48} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p>Camera is tightly secured</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className="btn btn-primary" 
              style={{ flex: 1 }}
              onClick={() => {
                setCameraActive(!cameraActive);
                setLivenessStatus('');
                setLivenessTask(null);
                if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
              }}
              disabled={!modelsLoaded}
            >
              <Camera size={18} />
              {cameraActive ? 'Stop Biometrics' : 'Awake Neural Net'}
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ flex: 1, backgroundColor: 'var(--success)', color: 'white' }}
              onClick={capture}
              disabled={!cameraActive || loading || !modelsLoaded}
            >
               Verify Identity Payload
            </button>
          </div>
        </div>

        {/* Manual Entry Section */}
        <div className="card glass animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: 'rgba(236, 72, 153, 0.1)', color: 'var(--secondary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <UserCircle size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', margin: 0 }}>Manual Override Entry</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Status will be evaluated dynamically via the Backend.</p>
            </div>
          </div>

          <form onSubmit={handleManualSubmit}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', background: 'linear-gradient(135deg, #a855f7, var(--primary))', boxShadow: '0 4px 14px 0 rgba(168, 85, 247, 0.39)', marginTop: '2rem' }}
              disabled={loading || !selectedUser}
            >
              {loading ? 'Processing...' : 'Bypass Security (Admin Override)'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default MarkAttendance;

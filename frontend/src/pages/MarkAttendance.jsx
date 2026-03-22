import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import api from '../utils/api';
import { Camera, CameraOff, UserCircle } from 'lucide-react';

const MarkAttendance = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [status, setStatus] = useState('Present');
  const [cameraActive, setCameraActive] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const webcamRef = useRef(null);

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
      await api.post('/attendance/mark', {
        userId: selectedUser,
        status: status,
        method: 'Manual',
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
      });
      alert('Attendance marked manually');
      setSelectedUser('');
    } catch (err) {
      alert('Failed to mark manual attendance');
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

  const capture = useCallback(async () => {
    console.log('[MarkAttendance] Capture & Match clicked');
    if (!webcamRef.current || !webcamRef.current.video || !modelsLoaded) {
      console.log('[MarkAttendance] Error: Camera or models not ready.');
      setAiMessage('Camera or models not ready.');
      return;
    }

    if (registeredFaces.length === 0) {
      setAiMessage('No users with registered faces found in database.');
      return;
    }

    setAiMessage('Scanning face...');
    console.log('[MarkAttendance] Scanning face...');
    setLoading(true);

    try {
      const videoEl = webcamRef.current.video;
      console.log(`[MarkAttendance] Starting detection. Video dimensions: ${videoEl.videoWidth}x${videoEl.videoHeight}`);
      
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 });
      const detection = await faceapi.detectSingleFace(videoEl, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        console.log('[MarkAttendance] Detection Result: null (No face detected)');
        setAiMessage('No face detected. Please look at the camera.');
        setTimeout(() => setAiMessage(''), 3000);
        setLoading(false);
        return;
      }

      console.log('[MarkAttendance] Face detected! Descriptor generated.');
      setAiMessage('Analyzing face parameters...');

      const currentDescriptor = Array.from(detection.descriptor);
      let bestMatch = null;
      let minDistance = Number.MAX_VALUE;

      // Loop through all users
      for (const user of registeredFaces) {
        for (const dbEmbedding of user.faceData) {
          // Compare using Euclidean Distance in the frontend
          const distance = faceapi.euclideanDistance(currentDescriptor, dbEmbedding);
          if (distance < minDistance) {
            minDistance = distance;
            bestMatch = user;
          }
        }
      }

      const threshold = 0.5; // Tune 0.4-0.6
      console.log(`[MarkAttendance] Best match: ${bestMatch?.name} with distance ${minDistance}`);

      if (bestMatch && minDistance <= threshold) {
        const confidence = Math.max(0, (1 - (minDistance / threshold)) * 100).toFixed(2);
        console.log(`[MarkAttendance] Match found for userId: ${bestMatch.userId} (${confidence}%)`);
        
        console.log('[MarkAttendance] Sending to backend (Attendance)');
        const now = new Date();
        await api.post('/attendance/mark', {
          userId: bestMatch.userId,
          time: now.toTimeString().split(' ')[0],
          status: 'Present',
          method: 'AI',
          confidence: parseFloat(confidence)
        });

        setAiMessage(`Matched: ${bestMatch.name} (${confidence}% confidence). Attendance Marked!`);
      } else {
        console.log('[MarkAttendance] Best face distance exceeded threshold (unrecognized)');
        setAiMessage('User not recognized.');
      }
      setTimeout(() => setAiMessage(''), 4000);
    } catch (err) {
      console.error('[MarkAttendance] Error during capture/match:', err);
      setAiMessage(err.response?.data?.message || 'Recognition failed due to a server error.');
      setTimeout(() => setAiMessage(''), 4000);
    } finally {
      setLoading(false);
    }
  }, [webcamRef, modelsLoaded, registeredFaces]);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Mark Attendance</h1>
        <p style={{ color: 'var(--text-muted)' }}>Record attendance using face recognition or manual entry</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* AI Camera Section */}
        <div className="card glass animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <Camera size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', margin: 0 }}>AI Face Recognition</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {modelsLoaded ? 'Models Loaded. Ready for scanning' : 'Loading AI Models...'}
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
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {aiMessage && (
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '1rem', 
                    left: '50%', 
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '99px',
                    fontSize: '0.875rem',
                    zIndex: 10
                  }}>
                    {aiMessage}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <CameraOff size={48} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p>Camera is off</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className="btn btn-primary" 
              style={{ flex: 1 }}
              onClick={() => setCameraActive(!cameraActive)}
              disabled={!modelsLoaded}
            >
              <Camera size={18} />
              {cameraActive ? 'Stop Camera' : 'Start Camera'}
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ flex: 1 }}
              onClick={capture}
              disabled={!cameraActive || loading || !modelsLoaded}
            >
               Capture & Match
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
              <h3 style={{ fontSize: '1.125rem', margin: 0 }}>Manual Entry</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Mark attendance manually</p>
            </div>
          </div>

          <form onSubmit={handleManualSubmit}>
            <div className="input-group">
              <label className="input-label" htmlFor="userSelect">Select User</label>
              <select 
                id="userSelect"
                className="input-field" 
                value={selectedUser} 
                onChange={(e) => setSelectedUser(e.target.value)}
                required
              >
                <option value="">Choose a user...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label className="input-label">Status</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setStatus('Present')}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${status === 'Present' ? 'var(--success)' : 'var(--border)'}`,
                    backgroundColor: status === 'Present' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    color: status === 'Present' ? 'var(--success)' : 'var(--text-main)',
                    fontWeight: 500
                  }}
                >
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)', marginRight: '0.5rem' }}></span>
                  Present
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('Late')}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${status === 'Late' ? 'var(--warning)' : 'var(--border)'}`,
                    backgroundColor: status === 'Late' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    color: status === 'Late' ? 'var(--warning)' : 'var(--text-main)',
                    fontWeight: 500
                  }}
                >
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--warning)', marginRight: '0.5rem' }}></span>
                  Late
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', background: 'linear-gradient(135deg, #a855f7, var(--primary))', boxShadow: '0 4px 14px 0 rgba(168, 85, 247, 0.39)' }}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Mark Attendance'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default MarkAttendance;

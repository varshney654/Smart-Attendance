import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import api from '../utils/api';
import { Camera, CameraOff, MapPin, CheckCircle, ShieldCheck, UserCircle, Loader2 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const MarkAttendance = () => {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'Admin';

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [aiMessage, setAiMessage] = useState('Camera is turned off');
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const webcamRef = useRef(null);
  
  // Step-based UI state: 1 (Start), 2 (Detecting), 3 (Verifying), 4 (Done)
  const [currentStep, setCurrentStep] = useState(1);
  const animationFrameRef = useRef(null);
  
  const [locationStatus, setLocationStatus] = useState('Checking GPS location...');
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Location hidden (Unavailable)');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });
        
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.county || "";
            const formatted = city ? city : "Unknown Region";
            setLocationStatus(`${latitude.toFixed(4)}, ${longitude.toFixed(4)} (${formatted})`);
          } else {
             setLocationStatus(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        } catch (e) {
          setLocationStatus(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      },
      (error) => {
        setLocationStatus('Location hidden (Permission denied)');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    fetchUsers();
    loadModels();
  }, []);

  useEffect(() => {
    if (!isAdmin && user) {
      setSelectedUser(user.id);
    }
  }, [isAdmin, user]);

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
      setAiMessage('Ready to start');
    } catch (err) {
      console.error('Failed to load AI models', err);
      setAiMessage('Failed to load models.');
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return alert('Please select a user');
    
    setLoading(true);
    try {
      const res = await api.post('/attendance/mark', {
        userId: selectedUser,
        method: 'Manual',
        latitude: coords?.latitude,
        longitude: coords?.longitude
      });
      alert(res.data.message);
      setSelectedUser('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark manual attendance');
    } finally {
      setLoading(false);
    }
  };

  const [registeredFaces, setRegisteredFaces] = useState([]);
  
  useEffect(() => {
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

  useEffect(() => {
    setAiMessage('Camera is turned off');
    setCurrentStep(1);
    setCameraActive(false);
  }, [selectedUser]);

  const startVerification = useCallback(async () => {
    if (!selectedUser) {
      setAiMessage('Please select identity first.');
      return;
    }
    
    const targetUser = registeredFaces.find(u => u.userId === selectedUser);
    if (!targetUser || !targetUser.faceData || targetUser.faceData.length === 0) {
      setAiMessage('The selected user lacks a biometric template.');
      return;
    }

    setCameraActive(true);
    setCurrentStep(2); // Step 2: Detecting Face
    setAiMessage('Detecting face...');
    setLoading(true);

    let consecutiveMatches = 0;

    const detectAndVerify = async () => {
      if (!webcamRef.current || !webcamRef.current.video || currentStep === 4) {
        animationFrameRef.current = setTimeout(detectAndVerify, 100);
        return;
      }

      const videoEl = webcamRef.current.video;
      if (videoEl.readyState !== 4) {
        animationFrameRef.current = setTimeout(detectAndVerify, 100);
        return;
      }

      try {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 });
        const detection = await faceapi.detectSingleFace(videoEl, options)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          setCurrentStep(3); // Verifying Identity
          
          const currentDescriptor = Array.from(detection.descriptor);
          let minDistance = Number.MAX_VALUE;
          
          for (let i = 0; i < targetUser.faceData.length; i++) {
            const distance = faceapi.euclideanDistance(currentDescriptor, targetUser.faceData[i]);
            if (distance < minDistance) minDistance = distance;
          }

          const conf = Math.max(0, (1 - minDistance) * 100);
          
          if (conf >= 55 || minDistance <= 0.60) {
            consecutiveMatches++;
            setAiMessage(`Verifying... (${conf.toFixed(0)}% match)`);
            
            if (consecutiveMatches >= 2) {
              if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
              
              setAiMessage('Securely marking attendance...');
              try {
                const res = await api.post('/attendance/mark', {
                  userId: targetUser.userId,
                  method: 'AI',
                  confidence: parseFloat(conf.toFixed(0)),
                  faceDescriptor: currentDescriptor,
                  isLive: true,
                  latitude: coords?.latitude,
                  longitude: coords?.longitude
                });
                
                setAiMessage('Attendance Marked'); // Final success text
                setCurrentStep(4);
              } catch (err) {
                setAiMessage(err.response?.data?.message || 'Verification failed.');
                setCurrentStep(1);
              } finally {
                setLoading(false);
                setTimeout(() => setCameraActive(false), 2000);
              }
              return; 
            }
          } else {
            consecutiveMatches = 0;
            setAiMessage(`Face detected, analyzing...`);
          }
        } else {
          setCurrentStep(2);
          setAiMessage('Detecting face... Please align yourself');
        }
      } catch (err) {
        console.error(err);
      }

      animationFrameRef.current = setTimeout(detectAndVerify, 200);
    };

    setTimeout(() => {
      detectAndVerify();
    }, 1500);

  }, [modelsLoaded, registeredFaces, selectedUser, coords]);

  const steps = [
    { id: 1, label: 'Start Camera', icon: <Camera size={20} /> },
    { id: 2, label: 'Detecting Face', icon: <UserCircle size={20} /> },
    { id: 3, label: 'Verifying', icon: <ShieldCheck size={20} /> },
    { id: 4, label: 'Success', icon: <CheckCircle size={20} /> }
  ];

  return (
    <div>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Mark Attendance</h1>
          <p style={{ color: 'var(--text-muted)' }}>Fully automated facial recognition system</p>
        </div>
      </div>

      {/* 1. TOP SECTION: Target Identity */}
      <div className="card glass" style={{ marginBottom: '2rem', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', borderRadius: '1rem' }}>
        {(() => {
          const target = users.find(u => u.id === selectedUser);
          const displayImg = target?.profileImage || (!isAdmin ? user?.profileImage : null);
          const initial = target?.name?.charAt(0) || (!isAdmin ? user?.name?.charAt(0) : 'U');
          
          return displayImg ? (
            <img src={displayImg} alt="Target Identity" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
          ) : (
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
              {initial}
            </div>
          );
        })()}
        <div style={{ flex: 1 }}>
          <label className="input-label" htmlFor="globalUserSelect" style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Target Identity</label>
          {isAdmin ? (
            <select 
              id="globalUserSelect"
              className="input-field" 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{ width: '100%', fontSize: '1rem', padding: '0.85rem 1rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}
              required
            >
              <option value="">Select a user (Name + Role)...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} - {u.role}</option>
              ))}
            </select>
          ) : (
            <div>
              <input 
                type="text" 
                className="input-field" 
                value={`${user?.name || 'Loading Name...'} (${user?.role || 'Loading Role...'})`} 
                disabled 
                style={{ width: '100%', fontSize: '1rem', padding: '0.85rem 1rem', borderRadius: '0.5rem', backgroundColor: '#f1f5f9', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. MAIN LAYOUT (2-COLUMN GRID) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1.5fr) minmax(300px, 1fr)', gap: '2rem' }}>
        
        {/* Left Side (Camera Section) */}
        <div className="card glass animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>Camera Feed</h3>
            <div className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', backgroundColor: '#f8fafc', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '2rem', fontSize: '0.75rem' }}>
              <MapPin size={14} style={{ color: 'var(--primary)' }} />
              {locationStatus}
            </div>
          </div>

          <div style={{ 
            flex: 1, 
            backgroundColor: '#0f172a', 
            borderRadius: '1rem', 
            minHeight: '400px',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            marginBottom: '1.5rem'
          }}>
            {cameraActive ? (
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user", aspectRatio: 4/3 }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                
                {/* Face Scanning Box Overlay Details */}
                {currentStep >= 2 && currentStep < 4 && (
                  <div className="pulse-animation" style={{ position: 'absolute', top: '15%', bottom: '15%', left: '20%', right: '20%', border: '2px solid rgba(255, 255, 255, 0.4)', borderRadius: '24px', pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', top: -2, left: -2, width: 30, height: 30, borderTop: '4px solid var(--success)', borderLeft: '4px solid var(--success)', borderTopLeftRadius: '24px' }} />
                    <div style={{ position: 'absolute', top: -2, right: -2, width: 30, height: 30, borderTop: '4px solid var(--success)', borderRight: '4px solid var(--success)', borderTopRightRadius: '24px' }} />
                    <div style={{ position: 'absolute', bottom: -2, left: -2, width: 30, height: 30, borderBottom: '4px solid var(--success)', borderLeft: '4px solid var(--success)', borderBottomLeftRadius: '24px' }} />
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: 30, height: 30, borderBottom: '4px solid var(--success)', borderRight: '4px solid var(--success)', borderBottomRightRadius: '24px' }} />
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748b' }}>
                {currentStep === 4 ? (
                  <div className="animate-fade-in" style={{ color: 'var(--success)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <CheckCircle size={80} style={{ margin: '0 auto 1rem', dropShadow: '0 4px 6px rgba(16,185,129,0.3)' }} />
                    <h2 style={{ margin: 0, color: 'white' }}>Success</h2>
                  </div>
                ) : (
                  <>
                    <CameraOff size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.5 }} />
                    <p style={{ fontSize: '1.1rem' }}>Camera is offline</p>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Status Text Area */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: currentStep === 4 ? 'rgba(16, 185, 129, 0.1)' : '#f8fafc', borderRadius: '0.75rem', border: '1px solid var(--border)', minHeight: '60px', transition: 'all 0.3s ease' }}>
             {currentStep === 4 ? (
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600, fontSize: '1.1rem' }}>
                 <CheckCircle size={24} />
                 {aiMessage}
               </div>
             ) : (
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)', fontWeight: 500, fontSize: '1rem' }}>
                 {currentStep > 1 && currentStep < 4 && <Loader2 size={18} className="pulse-animation" style={{ color: 'var(--primary)' }} />}
                 {aiMessage}
               </div>
             )}
          </div>

        </div>

        {/* Right Side (Verification Flow) */}
        <div className="card glass animate-fade-in" style={{ padding: '1.5rem', animationDelay: '0.1s', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '2rem', fontWeight: 600 }}>Automated Verification Flow</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
            {steps.map((step) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id || (currentStep === 4 && step.id === 4);
              
              return (
                <div key={step.id} className={`step-indicator ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`} style={{ padding: '1.25rem', borderRadius: '0.75rem', transition: 'all 0.3s ease' }}>
                  <div className="step-icon" style={{ width: '48px', height: '48px', marginRight: '1rem' }}>
                    {isCompleted ? <CheckCircle size={24} /> : (isActive && step.id !== 4 && step.id !== 1 ? <Loader2 size={24} className="pulse-animation" /> : step.icon)}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: isActive || isCompleted ? 600 : 500, color: isActive || isCompleted ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '1.1rem' }}>
                      {step.id}. {step.label}
                    </h4>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '2.5rem' }}>
            {currentStep === 4 ? (
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 600, backgroundColor: 'var(--surface)' }}
                onClick={() => {
                  setCurrentStep(1);
                  setAiMessage('Camera is turned off');
                }}
              >
                Start New Session
              </button>
            ) : (
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 600, boxShadow: 'var(--shadow-md)' }}
                onClick={() => {
                  if (!cameraActive) startVerification();
                  else {
                    setCameraActive(false);
                    setCurrentStep(1);
                    setAiMessage('Camera is turned off');
                    if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
                  }
                }}
                disabled={!modelsLoaded || loading || !selectedUser}
              >
                {cameraActive ? 'Cancel Verification' : 'Start Camera'}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 3. BOTTOM SECTION: Manual Override */}
      {isAdmin && (
        <div className="card glass animate-fade-in" style={{ marginTop: '2rem', animationDelay: '0.2s', padding: '1.5rem', borderLeft: '4px solid var(--secondary)', borderRadius: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <ShieldCheck size={20} style={{ color: 'var(--secondary)' }}/> Manual Override
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Bypass AI and force attendance mapping</p>
            </div>
            <button 
              className="btn btn-primary" 
              style={{ fontSize: '1rem', padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #ec4899, var(--primary))', boxShadow: '0 4px 14px 0 rgba(236, 72, 153, 0.39)' }} 
              onClick={handleManualSubmit} 
              disabled={loading || !selectedUser}
            >
              Mark Manual
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkAttendance;

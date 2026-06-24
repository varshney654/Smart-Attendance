import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import Webcam from 'react-webcam';
import api from '../utils/api';
import { Camera, CameraOff, MapPin, CheckCircle, ShieldCheck, UserCircle, Loader2 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { FaceCacheContext } from '../context/FaceCacheContext';
import { initMediaPipe, initFaceAPI, checkLiveness, getFaceDescriptor, matchFace } from '../utils/faceUtils';
import { useSearchParams } from 'react-router-dom';

const MarkAttendance = () => {
  const { user } = useContext(AuthContext);
  const { faceDataCache, loadingCache } = useContext(FaceCacheContext);
  const isAdmin = user?.role === 'Admin';
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get('session');

  const [cameraActive, setCameraActive] = useState(false);
  const [aiMessage, setAiMessage] = useState('Camera is turned off');
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const webcamRef = useRef(null);
  
  // Step-based UI state: 1 (Start), 2 (Detecting), 3 (Verifying), 4 (Done)
  const [currentStep, setCurrentStep] = useState(1);
  const animationFrameRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const recentLandmarksRef = useRef([]);
  const isVerifyingRef = useRef(false);
  
  const [locationStatus, setLocationStatus] = useState('Checking GPS...');
  const [coords, setCoords] = useState(null);

  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Present');

  useEffect(() => {
    if (isAdmin) {
      const fetchUsers = async () => {
        try {
          const res = await api.get('/users');
          setAllUsers(res.data);
        } catch (err) {
          console.error('Failed to fetch users', err);
        }
      };
      fetchUsers();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Location Unavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });
        setLocationStatus(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      },
      () => setLocationStatus('Location Permission Denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    const loadAI = async () => {
      setAiMessage('Loading high-speed AI Models...');
      try {
        faceLandmarkerRef.current = await initMediaPipe();
        await initFaceAPI();
        setModelsLoaded(true);
        setAiMessage('Ready to start');
      } catch (err) {
        console.error('Failed to load models:', err);
        setAiMessage('Failed to load AI models.');
      }
    };
    loadAI();
    
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      alert('Please select a user first.');
      return;
    }
    
    setLoading(true);
    try {
      const res = await api.post('/attendance/manual', {
        userId: selectedUserId,
        status: selectedStatus,
        date: new Date().toISOString(),
        time: new Date().toLocaleTimeString('en-US', { hour12: false })
      });
      alert('Attendance marked successfully.');
      setSelectedUserId('');
      setSelectedStatus('Present');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark attendance manually.');
    } finally {
      setLoading(false);
    }
  };

  const startVerification = useCallback(async () => {
    if (loadingCache || faceDataCache.length === 0) {
      setAiMessage('Loading biometric cache... please wait.');
      return;
    }

    setCameraActive(true);
    setCurrentStep(2);
    setAiMessage('Detecting face & checking liveness...');
    setLoading(true);
    recentLandmarksRef.current = [];
    isVerifyingRef.current = false;

    let lastVideoTime = -1;

    const detectAndVerify = async () => {
      if (!webcamRef.current || !webcamRef.current.video || currentStep === 4 || isVerifyingRef.current) {
        animationFrameRef.current = requestAnimationFrame(detectAndVerify);
        return;
      }

      const videoEl = webcamRef.current.video;
      if (videoEl.readyState !== 4) {
        animationFrameRef.current = requestAnimationFrame(detectAndVerify);
        return;
      }

      try {
        let startTimeMs = performance.now();
        if (lastVideoTime !== videoEl.currentTime) {
          lastVideoTime = videoEl.currentTime;
          
          if (faceLandmarkerRef.current) {
            const results = faceLandmarkerRef.current.detectForVideo(videoEl, startTimeMs);
            
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
              // Add to recent history for liveness
              recentLandmarksRef.current.push(results.faceLandmarks[0]);
              if (recentLandmarksRef.current.length > 30) {
                recentLandmarksRef.current.shift(); // Keep last 30 frames (1 sec approx)
              }
              
              if (recentLandmarksRef.current.length >= 15) {
                const isLive = checkLiveness(recentLandmarksRef.current);
                
                if (isLive) {
                  isVerifyingRef.current = true;
                  setCurrentStep(3);
                  setAiMessage('Liveness passed! Recognizing identity...');
                  
                  // Pause and get high-accuracy descriptor
                  const descriptor = await getFaceDescriptor(videoEl);
                  
                  if (descriptor) {
                    // Match locally
                    const matchResult = matchFace(descriptor, faceDataCache);
                    
                    if (matchResult) {
                       setAiMessage(`Identified: ${matchResult.user.name}. Marking...`);
                       try {
                         await api.post('/attendance/mark', {
                           userId: matchResult.user.userId, // face data endpoint returns {userId, name, faceData}
                           method: 'AI',
                           confidence: parseFloat(matchResult.confidence.toFixed(0)),
                           faceDescriptor: descriptor,
                           isLive: true,
                           latitude: coords?.latitude,
                           longitude: coords?.longitude,
                           sessionToken // Optional QR session token
                         });
                        
                        setAiMessage(`Success: Attendance marked for ${matchResult.user.name}`);
                        setCurrentStep(4);
                      } catch (err) {
                        const errMsg = err.response?.data?.message || 'Verification failed.';
                        setAiMessage(errMsg);
                        if (errMsg.includes('Attendance already marked')) {
                           setCurrentStep(4); // Soft success
                        } else {
                           setCurrentStep(1);
                        }
                      } finally {
                        setLoading(false);
                        setTimeout(() => setCameraActive(false), 3000);
                      }
                      return; // Exit loop
                    } else {
                      setAiMessage('Unknown user. Please register face.');
                      setTimeout(() => {
                        isVerifyingRef.current = false;
                        setCurrentStep(2);
                      }, 2000);
                    }
                  } else {
                    isVerifyingRef.current = false;
                  }
                }
              }
            } else {
              recentLandmarksRef.current = []; // Reset if face lost
              setAiMessage('Detecting face... Please align yourself');
            }
          }
        }
      } catch (err) {
        console.error('Detection error:', err);
      }

      animationFrameRef.current = requestAnimationFrame(detectAndVerify);
    };

    setTimeout(() => {
      detectAndVerify();
    }, 1000);

  }, [faceDataCache, loadingCache, coords, currentStep, sessionToken]);

  const steps = [
    { id: 1, label: 'Start Camera', icon: <Camera size={20} /> },
    { id: 2, label: 'Detect & Liveness', icon: <UserCircle size={20} /> },
    { id: 3, label: 'Recognize User', icon: <ShieldCheck size={20} /> },
    { id: 4, label: 'Success', icon: <CheckCircle size={20} /> }
  ];

  return (
    <div>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Auto Attendance</h1>
          <p style={{ color: 'var(--text-muted)' }}>High-speed AI facial recognition</p>
          {sessionToken && <span className="badge badge-primary">QR Session Active</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.5fr) minmax(300px, 1fr)', gap: '2rem' }}>
        
        {/* Camera Section */}
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
                  videoConstraints={{ facingMode: "user" }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                
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

        {/* Verification Flow */}
        <div className="card glass animate-fade-in" style={{ padding: '1.5rem', animationDelay: '0.1s', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '2rem', fontWeight: 600 }}>Automated Flow</h3>
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
                Mark Another
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
                    isVerifyingRef.current = false;
                    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                  }
                }}
                disabled={!modelsLoaded || loading || loadingCache}
              >
                {cameraActive ? 'Cancel Verification' : 'Start Camera'}
              </button>
            )}
          </div>
        </div>

      </div>

      {isAdmin && (
        <div className="card glass animate-fade-in" style={{ marginTop: '2rem', animationDelay: '0.2s', padding: '1.5rem', borderLeft: '4px solid var(--secondary)', borderRadius: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <ShieldCheck size={20} style={{ color: 'var(--secondary)' }}/> Manual Attendance (Admin Only)
          </h3>
          
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 250px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Select User</label>
              <select 
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '1rem' }}
                disabled={loading}
              >
                <option value="">-- Select a User --</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.email ? `(${u.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Status</label>
              <select 
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', fontSize: '1rem' }}
                disabled={loading}
              >
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Absent">Absent</option>
              </select>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ flex: '0 1 auto', fontSize: '1rem', padding: '0.75rem 2rem', background: 'linear-gradient(135deg, #ec4899, var(--primary))', boxShadow: '0 4px 14px 0 rgba(236, 72, 153, 0.39)', height: '46px' }} 
              onClick={handleManualSubmit} 
              disabled={loading || !selectedUserId}
            >
              Mark Attendance
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkAttendance;

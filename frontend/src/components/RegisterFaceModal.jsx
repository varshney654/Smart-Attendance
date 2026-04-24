import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { Camera, AlertCircle, Loader, X } from 'lucide-react';
import api from '../utils/api';

const RegisterFaceModal = ({ userId, userName, onClose }) => {
  const webcamRef = useRef(null);
  
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Loading AI models...');
  const [error, setError] = useState('');
  
  const REQUIRED_SAMPLES = 5;

  useEffect(() => {
    let isMounted = true;
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        if (isMounted) {
          setIsModelsLoaded(true);
          setMessage('Ready to register face. Please ensure good lighting and look at the camera.');
        }
      } catch (err) {
        console.error('Error loading models:', err);
        if (isMounted) {
          setError('Failed to load Face AI models.');
        }
      }
    };
    loadModels();
    return () => { isMounted = false; };
  }, []);

  const handleCapture = async () => {
    if (!isModelsLoaded) return;
    setIsCapturing(true);
    setError('');
    setProgress(0);
    setMessage('Capturing slowly... Please move your head slightly.');
    
    const embeddings = [];
    
    try {
      for (let i = 0; i < REQUIRED_SAMPLES; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (webcamRef.current && webcamRef.current.video.readyState === 4) {
          const video = webcamRef.current.video;
          const detection = await faceapi.detectSingleFace(video)
            .withFaceLandmarks()
            .withFaceDescriptor();
            
          if (detection) {
            embeddings.push(Array.from(detection.descriptor));
            setProgress(((i + 1) / REQUIRED_SAMPLES) * 100);
          } else {
            i--;
            setMessage('Face not detected! Please look at the camera clearly.');
          }
        } else {
          i--;
        }
      }
      
      setMessage('Processing and saving...');
      
      await api.post('/face/register', {
        userId: userId,
        embeddings: embeddings
      });
      
      setMessage('Face registered successfully!');
      setTimeout(() => {
        onClose(true); // pass true indicating success
      }, 1500);
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.response?.data || 'Failed to register face.');
      setIsCapturing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      backdropFilter: 'blur(4px)'
    }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '600px', backgroundColor: 'var(--surface)', padding: 0, overflow: 'hidden' }}>
        
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Register Face</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>for {userName}</p>
          </div>
          <button onClick={() => onClose(false)} style={{ color: 'var(--text-muted)', padding: '0.5rem' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border-2 border-dashed border-gray-300 mb-6 flex items-center justify-center">
            {isModelsLoaded ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  width: 640,
                  height: 480,
                  facingMode: "user"
                }}
                className={`w-full h-full object-cover ${isCapturing ? 'opacity-80' : ''}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--text-muted)' }}>
                <Loader className="animate-spin" size={32} style={{ marginBottom: '0.5rem' }} />
                <p>Loading Camera & AI Models...</p>
              </div>
            )}
            
            {/* Guide overlay */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '12rem', height: '16rem', border: '2px solid rgba(74, 222, 128, 0.5)', borderRadius: '9999px' }}></div>
            </div>
          </div>

          <div style={{ width: '100%', textAlign: 'center' }}>
            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}
            
            {message && !error && (
              <div style={{ marginBottom: '1rem', color: 'var(--primary)', fontWeight: 500 }}>
                {message}
              </div>
            )}

            {isCapturing && (
              <div style={{ width: '100%', backgroundColor: 'var(--border)', borderRadius: '9999px', height: '0.5rem', marginBottom: '1.5rem' }}>
                <div 
                  style={{ backgroundColor: 'var(--primary)', height: '0.5rem', borderRadius: '9999px', transition: 'all 300ms', width: `${progress}%` }}
                ></div>
              </div>
            )}

            <button
              onClick={handleCapture}
              disabled={!isModelsLoaded || isCapturing}
              className={`btn ${!isModelsLoaded || isCapturing ? 'btn-secondary' : 'btn-primary'}`}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {isCapturing ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Capturing Sample {Math.min(Math.floor((progress / 100) * REQUIRED_SAMPLES) + 1, REQUIRED_SAMPLES)}...
                </>
              ) : (
                <>
                  <Camera size={20} />
                  Start Registration
                </>
              )}
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default RegisterFaceModal;

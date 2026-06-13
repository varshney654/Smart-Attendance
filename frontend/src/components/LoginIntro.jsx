import React, { useState } from 'react';
import './LoginIntro.css';

const LoginIntro = ({ children }) => {
  const [isOn, setIsOn] = useState(false);

  const playClickSound = () => {
    // Sound-ready structure: add actual audio file here
    // const audio = new Audio('/switch.mp3');
    // audio.play().catch(e => console.log(e));
  };

  const toggleLamp = () => {
    playClickSound();
    setIsOn(!isOn);
  };

  return (
    <div className="login-intro-wrapper">
      <div className="intro-container">
        
        {/* Lamp Side */}
        <div className="lamp-section">
          <div className="lamp-body">
            <div className="lamp-shade-top">
              <div className="lamp-face">
                <div className="lamp-eyes">
                  <div className="lamp-eye"></div>
                  <div className="lamp-eye"></div>
                </div>
                <div className="lamp-mouth">
                  <div className="lamp-tongue"></div>
                </div>
              </div>
            </div>
            <div className={`lamp-shade-bottom ${isOn ? 'on' : ''}`}></div>
            <div className={`lamp-light-cone ${isOn ? 'on' : ''}`}></div>
            
            <div className="lamp-stem"></div>
            <div className="lamp-base"></div>
            
            {/* Pull Cord */}
            <div className="lamp-cord-wrapper" onClick={toggleLamp}>
              <div className="lamp-cord"></div>
              <div className="lamp-cord-handle"></div>
              {/* Arrow SVG */}
              {!isOn && (
                <div className="lamp-arrows">
                  <svg width="30" height="100" viewBox="0 0 30 100">
                    <path d="M25,80 Q5,50 25,20" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,3"/>
                    <polygon points="20,80 25,90 30,80" fill="#94a3b8"/>
                  </svg>
                </div>
              )}
            </div>
          </div>
          
          <div className="lamp-instructions">
            <span className="text-green">CLICK THE SWITCH</span><br/>
            <span className="text-gray">TO TURN ON THE LAMP</span>
          </div>

          <button className="lamp-toggle-btn" onClick={toggleLamp}>
            {isOn ? 'TURN OFF' : 'TURN ON'}
          </button>
        </div>

        {/* Login Form Side */}
        <div className={`login-section ${isOn ? 'visible' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default LoginIntro;

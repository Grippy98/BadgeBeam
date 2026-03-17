import React, { useState, useRef, useEffect } from 'react';
import { Upload, Bluetooth, Image as ImageIcon, Smartphone, Activity, CheckCircle2 } from 'lucide-react';
import { loadImage, processImageForScreen } from './utils/imageProcessing';
import { initializeBle, connectToBadge, disconnectBadge, sendImageToBadge } from './utils/bluetoothManager';

function App() {
  const [file, setFile] = useState(null);
  const [isDithered, setIsDithered] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [hasBleError, setHasBleError] = useState(false);
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageBufferRef = useRef(null);

  useEffect(() => {
    initializeBle().then((success) => {
        if (!success) setHasBleError(true);
    });
    
    return () => {
        disconnectBadge();
    }
  }, []);

  useEffect(() => {
    if (file && canvasRef.current) {
      renderPreview();
    }
  }, [file, isDithered]);

  const renderPreview = async () => {
    try {
      const img = await loadImage(file);
      const buffer = processImageForScreen(img, canvasRef.current, isDithered);
      imageBufferRef.current = buffer;
    } catch (e) {
      console.error('Failed to load image', e);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleConnect = async () => {
    if (isConnected) {
      await disconnectBadge();
      setIsConnected(false);
      setDeviceInfo(null);
      return;
    }

    try {
      const device = await connectToBadge(() => {
        setIsConnected(false);
        setDeviceInfo(null);
      });
      setDeviceInfo(device);
      setIsConnected(true);
    } catch (error) {
      console.log('Bluetooth connection prevented or failed.', error);
      // alert('Bluetooth failed: ' + error.message);
    }
  };

  const handleBeam = async () => {
    if (!isConnected || !imageBufferRef.current) return;
    
    setIsUploading(true);
    setProgress(0);
    
    try {
      await sendImageToBadge(imageBufferRef.current, (pct) => {
        setProgress(pct * 100);
      });
      // Done uploading
      setTimeout(() => {
          setIsUploading(false);
          setProgress(0);
      }, 500);
    } catch (e) {
      console.error('Upload failed', e);
      setIsUploading(false);
      alert('Upload failed: ' + e.message);
    }
  };

  return (
    <div className="app-container">
      <div className="header">
        <h1>BadgeBeam</h1>
        <p>E-ink Companion for BeagleBadge</p>
      </div>

      <div className="card">
        <div className="card-title">
          <Activity size={20} color="var(--primary-color)"/> Connection Status
        </div>
        
        {hasBleError && (
           <div className="device-status" style={{color: 'var(--accent-color)'}}>
               Bluetooth API not available in this environment.
           </div> 
        )}

        <div className="device-status">
          <div className={`status-indicator ${isConnected ? 'connected' : ''}`}></div>
          {isConnected ? `Connected to ${deviceInfo?.name || 'BeagleBadge'}` : 'Disconnected'}
        </div>
        
        <button 
            className={`btn ${isConnected ? 'btn-danger' : 'btn-primary'}`} 
            onClick={handleConnect}
            disabled={hasBleError}
        >
            <Bluetooth size={18} />
            {isConnected ? 'Disconnect' : 'Scan for Badge'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">
          <ImageIcon size={20} color="var(--primary-color)"/> E-ink Preview
        </div>
        
        <div className={`canvas-container ${file ? 'has-image' : ''}`} onClick={() => fileInputRef.current.click()}>
          {!file && (
            <div className="placeholder-text">
              <Upload size={32} />
              <span>Tap to select an image</span>
            </div>
          )}
          <canvas id="preview-canvas" ref={canvasRef} style={{ display: file ? 'block' : 'none' }}></canvas>
        </div>

        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
        />

        {file && (
            <div className="controls-row">
                <button 
                  className="btn" 
                  onClick={() => setIsDithered(!isDithered)}
                >
                    {isDithered ? 'Disable Dithering' : 'Enable Dithering'}
                </button>
                <button className="btn" onClick={() => fileInputRef.current.click()}>
                    <Upload size={18} /> Change
                </button>
            </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <Smartphone size={20} color="var(--primary-color)"/> Transfer
        </div>
        
        <button 
            className="btn btn-primary" 
            onClick={handleBeam} 
            disabled={!file || !isConnected || isUploading}
        >
            {isUploading ? 'Beaming...' : <><Bluetooth size={18}/> Beam to Badge</>}
        </button>

        <div className={`progress-bar-container ${isUploading ? 'active' : ''}`}>
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    </div>
  );
}

export default App;

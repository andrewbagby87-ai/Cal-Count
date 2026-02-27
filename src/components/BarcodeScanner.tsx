import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import './BarcodeScanner.css';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [cameraError, setCameraError] = useState('');
  
  // We use refs to keep track of the latest functions without triggering re-renders
  const onScanSuccessRef = useRef(onScanSuccess);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    let isMounted = true;
    
    // THE GOLDEN FIX: We delay the camera startup by 150ms. 
    // This perfectly intercepts React Strict Mode's double-mounting behavior
    // so the camera is never instructed to boot up twice simultaneously.
    const startTimer = setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("barcode-reader-container");
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" }, // Prioritize rear camera on phones
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // SUCCESS: Only process if we are still mounted and scanning
            if (isMounted && html5QrCode.isScanning) {
              html5QrCode.stop()
                .then(() => html5QrCode.clear())
                .then(() => onScanSuccessRef.current(decodedText))
                .catch(console.error);
            }
          },
          () => {} // Silently ignore frame-by-frame background errors
        );
      } catch (err) {
        console.error("Scanner Error:", err);
        if (isMounted) {
          setCameraError("Camera blocked or not found. Please check your browser permissions.");
        }
      }
    }, 150);

    // CLEANUP: If the user exits or React unmounts, clear the timer and cleanly shut down
    return () => {
      isMounted = false;
      clearTimeout(startTimer);
      
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop()
            .then(() => scannerRef.current?.clear())
            .catch(console.error);
        } else {
          scannerRef.current.clear();
        }
      }
    };
  }, []);

  // Guarantee the camera turns off immediately when the user clicks the explicit Close button
  const handleForceClose = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.error("Error stopping on close:", e);
      }
    }
    onClose();
  };

  return (
    <div className="barcode-scanner-overlay">
      <div className="barcode-scanner-modal" style={{ position: 'relative' }}>
        
        {/* BULLETPROOF CLOSE BUTTON - Forced to the absolute top layer */}
        <button 
          onClick={handleForceClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 999999,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
          }}
        >
          ✕
        </button>

        <div className="scanner-header" style={{ paddingRight: '60px' }}>
          <h3>Scan Barcode</h3>
        </div>
        
        {cameraError ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
            <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📷</p>
            <p>{cameraError}</p>
          </div>
        ) : (
          <div id="barcode-reader-container" className="scanner-container"></div>
        )}
        
        <p className="scanner-hint">Point your camera at a product barcode</p>
      </div>
    </div>
  );
}
// src/components/BarcodeScanner.tsx
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import './BarcodeScanner.css';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [cameraError, setCameraError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const onScanSuccessRef = useRef(onScanSuccess);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  // 1. Initialize the LIVE camera (as a convenience)
  useEffect(() => {
    let isMounted = true;
    const html5QrCode = new Html5Qrcode("barcode-reader-container");
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
          },
          (decodedText) => {
            if (isMounted && !hasScannedRef.current) {
              hasScannedRef.current = true;
              onScanSuccessRef.current(decodedText);
            }
          },
          () => {} // Silently ignore background frame errors
        );
      } catch (err) {
        console.warn("Live camera init failed (expected on some devices):", err);
        if (isMounted) {
          setCameraError("Live camera unavailable. Please use the 'Snap Photo' button below.");
        }
      }
    };

    // Small delay to allow modal animation to finish before grabbing camera hardware
    const timer = setTimeout(startScanner, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
      } else {
        html5QrCode.clear();
      }
    };
  }, []);

  // 2. The NATIVE Camera Fallback (The Silver Bullet)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      // Create a temporary scanner just for analyzing this high-quality photo
      const fileScanner = new Html5Qrcode("hidden-file-scanner");
      const decodedText = await fileScanner.scanFile(file, true);
      
      if (decodedText) {
        hasScannedRef.current = true;
        onScanSuccessRef.current(decodedText);
      }
    } catch (err) {
      alert("Could not detect a barcode in that photo. Please ensure it is well-lit and in focus, or type it manually.");
    } finally {
      setIsProcessing(false);
      e.target.value = ''; // Reset input so they can try again if needed
    }
  };

  const handleManualEntry = () => {
    const code = window.prompt("Enter the 12-digit barcode/UPC manually:");
    if (code !== null) {
      const trimmedCode = code.trim();
      if (/^\d{12}$/.test(trimmedCode)) {
        hasScannedRef.current = true;
        onScanSuccessRef.current(trimmedCode);
      } else {
        alert("Invalid barcode. Please enter exactly 12 numbers.");
      }
    }
  };

  return (
    <div className="barcode-scanner-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999,
      display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
    }}>
      <div className="barcode-scanner-modal" style={{
        backgroundColor: '#ffffff', width: '100%', maxWidth: '400px',
        borderRadius: '1rem', padding: '1.5rem', position: 'relative',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '12px', right: '12px', zIndex: 10,
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: '#f1f5f9', color: '#64748b', border: 'none',
            fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>

        <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.25rem' }}>Scan Barcode</h3>
        
        {/* Live Camera Viewfinder */}
        <div style={{ borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: '#0f172a', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cameraError ? (
            <p style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center', margin: 0 }}>{cameraError}</p>
          ) : (
            <div id="barcode-reader-container" style={{ width: '100%' }}></div>
          )}
        </div>
        
        <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', margin: '1rem 0', padding: '0 1rem' }}>
          If the live camera won't focus, use your phone's native camera below!
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          
          {/* NATIVE CAMERA BUTTON (Requires <label> to wrap the file input) */}
          <label style={{
            width: '100%', padding: '0.85rem', backgroundColor: '#2563eb', color: 'white',
            borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
            textAlign: 'center', margin: 0, opacity: isProcessing ? 0.7 : 1
          }}>
            {isProcessing ? 'Processing Photo...' : '📸 Snap Photo (Recommended)'}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
              disabled={isProcessing}
            />
          </label>

          {/* MANUAL ENTRY BUTTON */}
          <button 
            onClick={handleManualEntry}
            style={{
              width: '100%', padding: '0.85rem', backgroundColor: '#f1f5f9', color: '#475569',
              border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: '600',
              cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
            }}
          >
            ⌨️ Type Manually
          </button>

        </div>

        {/* Invisible div required by library to process static photos */}
        <div id="hidden-file-scanner" style={{ display: 'none' }}></div>

      </div>
    </div>
  );
}
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Upload,
  VideoOff,
  SwitchCamera,
  UserCheck,
} from "lucide-react";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanCode: (code: string) => Promise<{ success: boolean; message: string; memberName?: string }>;
}

export function extractCheckInCode(scannedText: string): string {
  if (!scannedText) return "";
  const text = scannedText.trim();

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.code === "string") {
      return parsed.code.trim().toUpperCase();
    }
  } catch {
  }

  if (text.includes("?") || text.startsWith("http://") || text.startsWith("https://")) {
    try {
      const url = new URL(text, "http://localhost");
      const codeParam = url.searchParams.get("code") || url.searchParams.get("c");
      if (codeParam) return codeParam.trim().toUpperCase();
    } catch {
    }
  }

  if (text.includes(":")) {
    const parts = text.split(":");
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart.length >= 4 && lastPart.length <= 10) {
      return lastPart.toUpperCase();
    }
  }

  const cleaned = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length === 6) {
    return cleaned;
  }

  return text.toUpperCase();
}

function playSuccessBeep() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 300);
  } catch {
  }
}

export function QrScannerModal({ isOpen, onClose, onScanCode }: QrScannerModalProps) {
  const containerId = "gym-qr-scanner-viewport";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const isStoppingRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    code: string;
    memberName?: string;
  } | null>(null);

  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      }
    } catch (err) {
      console.warn("Error while stopping QR scanner:", err);
    } finally {
      scannerRef.current = null;
      setCameraActive(false);
      isStoppingRef.current = false;
    }
  }, []);

  const handleDecodedText = useCallback(
    async (decodedText: string) => {
      if (processing || scanResult) return;

      const code = extractCheckInCode(decodedText);
      if (!code || code.length < 4) return;

      playSuccessBeep();
      setProcessing(true);

      try {
        const result = await onScanCode(code);
        setScanResult({
          success: result.success,
          message: result.message,
          code,
          memberName: result.memberName,
        });
      } catch (err) {
        setScanResult({
          success: false,
          message: err instanceof Error ? err.message : "Failed to process check-in.",
          code,
        });
      } finally {
        setProcessing(false);
      }
    },
    [processing, scanResult, onScanCode]
  );

  const startCamera = useCallback(
    async (cameraId?: string) => {
      if (!isOpen) return;

      setCameraError(null);
      await stopScanner();

      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        const container = document.getElementById(containerId);
        if (!container) return;

        const html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 5)}` })));
            if (!cameraId && !selectedCameraId) {
              const backCam = devices.find((d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"));
              setSelectedCameraId(backCam ? backCam.id : devices[0].id);
            }
          }
        } catch (camErr) {
          console.warn("Could not enumerate camera devices:", camErr);
        }

        const cameraConfig = cameraId || selectedCameraId || { facingMode: "environment" };

        await html5QrCode.start(
          cameraConfig,
          {
            fps: 15,
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleDecodedText(decodedText);
          },
          () => {
          }
        );

        setCameraActive(true);
      } catch (err: unknown) {
        console.error("Failed to start camera scanner:", err);
        const errorObj = err as { name?: string; message?: string };
        if (errorObj?.name === "NotAllowedError") {
          setCameraError(
            "Camera permission was denied. Please allow camera permissions in your browser or enter the code manually."
          );
        } else if (errorObj?.name === "NotFoundError" || errorObj?.message?.includes("NotFoundError")) {
          setCameraError("No camera device was detected on this device.");
        } else {
          setCameraError(
            errorObj?.message || "Could not access the camera. Check camera permissions or use manual entry."
          );
        }
        setCameraActive(false);
      }
    },
    [isOpen, selectedCameraId, stopScanner, handleDecodedText]
  );

  useEffect(() => {
    let active = true;

    if (isOpen) {
      const timer = setTimeout(() => {
        if (active) {
          setScanResult(null);
          setCameraError(null);
          startCamera();
        }
      }, 150);

      return () => {
        active = false;
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, startCamera, stopScanner]);

  const handleSwitchCamera = async (newCamId: string) => {
    setSelectedCameraId(newCamId);
    await startCamera(newCamId);
  };

  const handleResetForNext = () => {
    setScanResult(null);
    setProcessing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setCameraError(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const tempId = "gym-qr-scanner-temp";
      let tempEl = document.getElementById(tempId);
      if (!tempEl) {
        tempEl = document.createElement("div");
        tempEl.id = tempId;
        tempEl.style.display = "none";
        document.body.appendChild(tempEl);
      }

      const tempScanner = new Html5Qrcode(tempId);
      const decodedText = await tempScanner.scanFile(file, true);
      tempScanner.clear();
      if (tempEl.parentNode) {
        tempEl.parentNode.removeChild(tempEl);
      }

      if (decodedText) {
        await handleDecodedText(decodedText);
      } else {
        setCameraError("No readable QR code found in the uploaded image.");
      }
    } catch {
      setCameraError("Could not decode a QR code from this image. Please ensure the code is clear.");
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open z-50">
      <div className="modal-box max-w-md p-6 bg-base-100 border border-base-300 shadow-2xl rounded-2xl relative">
        <button
          type="button"
          onClick={() => {
            stopScanner();
            onClose();
          }}
          className="btn btn-ghost btn-xs btn-circle absolute top-4 right-4 text-base-content/60 hover:text-base-content"
          aria-label="Close scanner modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">Front Desk QR Scanner</h3>
            <p className="text-xs text-base-content/60">
              Scan member access pass to mark attendance
            </p>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-black/90 aspect-square flex flex-col items-center justify-center border border-base-300 shadow-inner">
          {cameraActive && !scanResult && (
            <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
              <div className="w-56 h-56 rounded-2xl border-2 border-primary/80 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-primary rounded-br-lg" />

                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_8px_rgba(var(--color-primary),0.8)] animate-bounce opacity-80" />
              </div>

              <div className="mt-4 px-3 py-1 bg-black/70 backdrop-blur-xs rounded-full text-white text-[11px] font-medium tracking-wide">
                Align QR pass inside the frame
              </div>
            </div>
          )}

          {processing && (
            <div className="absolute inset-0 z-20 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white">
              <span className="loading loading-spinner loading-lg text-primary" />
              <div className="text-sm font-semibold">Processing check-in...</div>
            </div>
          )}

          {scanResult && (
            <div className="absolute inset-0 z-20 bg-base-100 p-6 flex flex-col items-center justify-center text-center space-y-3">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  scanResult.success
                    ? "bg-success/15 text-success"
                    : "bg-error/15 text-error"
                }`}
              >
                {scanResult.success ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <AlertCircle className="w-8 h-8" />
                )}
              </div>

              <div>
                <h4 className="font-bold text-lg">
                  {scanResult.success ? "Check-In Confirmed!" : "Check-In Notice"}
                </h4>
                <p className="text-xs text-base-content/70 mt-1 max-w-xs mx-auto">
                  {scanResult.message}
                </p>
              </div>

              <div className="bg-base-200/80 px-4 py-2 rounded-xl border border-base-300">
                <span className="text-[10px] uppercase font-bold text-base-content/50 block">
                  Scanned Code
                </span>
                <span className="font-mono text-xl font-black text-primary tracking-widest">
                  {scanResult.code}
                </span>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 w-full">
                <button
                  type="button"
                  onClick={handleResetForNext}
                  className="btn btn-primary btn-sm flex-1 gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Scan Next Pass
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopScanner();
                    onClose();
                  }}
                  className="btn btn-outline btn-sm"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          <style>{`
            #gym-qr-scanner-viewport #qr-shaded-region {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
            }
          `}</style>
          <div
            id={containerId}
            className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&_#qr-shaded-region]:!hidden"
          />

          {cameraError && !scanResult && (
            <div className="absolute inset-0 z-10 bg-base-100 p-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center">
                <VideoOff className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base">Camera Unavailable</h4>
              <p className="text-xs text-base-content/70 max-w-xs">{cameraError}</p>

              <div className="pt-2 flex flex-col gap-2 w-full">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="btn btn-outline btn-primary btn-sm gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-outline btn-sm gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload QR Image
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          {cameras.length >= 1 && (
            <div className="flex items-center gap-1.5 text-base-content/70">
              <SwitchCamera className="w-3.5 h-3.5 shrink-0" />
              <select
                className="select select-bordered select-xs text-xs max-w-[190px]"
                value={selectedCameraId}
                onChange={(e) => handleSwitchCamera(e.target.value)}
                disabled={processing || !cameraActive}
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-ghost btn-xs gap-1 text-base-content/70 hover:text-base-content"
              title="Upload QR image file"
            >
              <Upload className="w-3 h-3" />
              Upload Image
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-base-200 flex items-center justify-between text-xs">
          <span className="text-base-content/60">Having trouble scanning?</span>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="btn btn-link btn-xs p-0 text-primary gap-1"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Enter code manually
          </button>
        </div>
      </div>
      <div
        className="modal-backdrop bg-black/60"
        onClick={() => {
          stopScanner();
          onClose();
        }}
      />
    </div>
  );
}

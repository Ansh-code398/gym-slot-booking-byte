"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Clock,
  Calendar,
  Copy,
  Check,
  Download,
  X,
  Dumbbell,
  CheckCircle2,
} from "lucide-react";
import { isSessionEnded, isSessionActive } from "@/lib/session-time";

interface QrPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    checkInCode: string;
    date: string | Date;
    startHour: number;
    startTime?: string | Date;
    userName?: string;
    status?: string;
    checkedIn?: boolean;
    isActive?: boolean;
  } | null;
}

function formatHour(hour: number): string {
  const startStr = `${String(hour).padStart(2, "0")}:00`;
  const endHour = (hour + 1) % 24;
  const endStr = `${String(endHour).padStart(2, "0")}:00`;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${startStr} - ${endStr} (${displayHour}:00 ${period})`;
}

function formatSessionDate(dateVal: string | Date | undefined): string {
  if (!dateVal) return "";
  if (dateVal instanceof Date) {
    const year = dateVal.getFullYear();
    const month = String(dateVal.getMonth() + 1).padStart(2, "0");
    const day = String(dateVal.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(dateVal).split("T")[0];
}

export function QrPassModal({ isOpen, onClose, booking }: QrPassModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function generate() {
      if (!isOpen || !booking?.checkInCode) {
        if (isMounted) {
          setQrDataUrl(null);
          setLoading(false);
        }
        return;
      }

      try {
        const url = await QRCode.toDataURL(booking.checkInCode.trim().toUpperCase(), {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
          color: {
            dark: "#111827",
            light: "#ffffff",
          },
        });

        if (isMounted) {
          setQrDataUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to generate QR code", err);
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    generate();

    return () => {
      isMounted = false;
    };
  }, [isOpen, booking?.checkInCode]);

  const handleCopyCode = () => {
    if (!booking?.checkInCode) return;
    navigator.clipboard.writeText(booking.checkInCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrDataUrl || !booking?.checkInCode) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `gym-pass-${booking.checkInCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || !booking) return null;

  return (
    <div className="modal modal-open z-50">
      <div className="modal-box max-w-sm sm:max-w-md p-6 bg-base-100 border border-base-300 shadow-2xl rounded-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-xs btn-circle absolute top-4 right-4 text-base-content/60 hover:text-base-content"
          aria-label="Close pass modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Dumbbell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">Gym Access Pass</h3>
            <p className="text-xs text-base-content/60">
              Present this pass at front desk reception
            </p>
          </div>
        </div>

        <div className="bg-base-200/60 rounded-xl p-3 mb-4 border border-base-200 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/80">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{formatSessionDate(booking.date)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-base-content/60">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatHour(booking.startHour)}</span>
            </div>
          </div>

          <div>
            {booking.checkedIn ? (
              <span className="badge badge-success badge-sm font-semibold gap-1">
                <Check className="w-3 h-3" /> Checked In
              </span>
            ) : isSessionEnded(booking) ? (
              <span className="badge badge-ghost badge-sm text-base-content/60 font-semibold">
                Ended
              </span>
            ) : isSessionActive(booking) ? (
              <span className="badge badge-accent badge-sm font-semibold">
                Active Now
              </span>
            ) : (
              <span className="badge badge-primary badge-outline badge-sm font-semibold">
                Confirmed
              </span>
            )}
          </div>
        </div>

       <div className="flex flex-col items-center justify-center py-2">
          <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-200 inline-block">
            {loading || !qrDataUrl ? (
              <div className="w-56 h-56 flex flex-col items-center justify-center gap-2">
                <span className="loading loading-spinner loading-md text-primary" />
                <span className="text-xs text-gray-500">Generating pass...</span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrDataUrl}
                alt={`Check-in QR Code for code ${booking.checkInCode}`}
                className="w-56 h-56 object-contain block mx-auto"
              />
            )}
          </div>

        </div>

        <div className="mt-3 bg-base-200/80 rounded-xl p-3 border border-base-300 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-base-content/50">
              Check-In Code
            </div>
            <div className="font-mono text-2xl font-black text-primary tracking-widest leading-none mt-0.5">
              {booking.checkInCode}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyCode}
              className={`btn btn-sm ${
                copied ? "btn-success" : "btn-outline"
              } gap-1.5 text-xs`}
              title="Copy 6-digit code"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>

            {qrDataUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="btn btn-outline btn-sm btn-square text-xs"
                title="Download QR code pass image"
                aria-label="Download QR code image"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-base-200">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary btn-block btn-sm"
          >
            Done
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
}

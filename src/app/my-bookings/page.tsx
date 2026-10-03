"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api-client";
import {
  Calendar,
  Clock,
  QrCode,
  Copy,
  Check,
  XCircle,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  Hourglass,
  History,
  Lock,
} from "lucide-react";
import { QrPassModal } from "@/app/components/qr-pass-modal";
import { isSessionEnded, isSessionActive } from "@/lib/session-time";

interface MyBookingItem {
  bookingId: string;
  checkInCode: string;
  checkedIn: boolean;
  checkedInAt: string | Date | null;
  status: string;
  bookingCreatedAt: string | Date;
  sessionId: string;
  date: string | Date;
  startHour: number;
  startTime: string | Date;
  capacity: number;
  hasStarted: boolean;
  hasEnded: boolean;
  isUpcoming: boolean;
  isActive: boolean;
}

interface MyWaitlistItem {
  waitlistId: string;
  status: string;
  createdAt: string | Date;
  sessionId: string;
  date: string | Date;
  startHour: number;
  startTime: string | Date;
  capacity: number;
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

export default function MyBookingsPage() {
  const { user, loading: authLoading } = useAuth();

  const [bookings, setBookings] = useState<MyBookingItem[]>([]);
  const [waitlist, setWaitlist] = useState<MyWaitlistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrModalBooking, setQrModalBooking] = useState<MyBookingItem | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  
  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: apiErr } = await api.sessions["my-bookings"].get();
      if (!apiErr && data?.success) {
        setBookings((data.bookings as MyBookingItem[]) || []);
        setWaitlist((data.waitlist as MyWaitlistItem[]) || []);
      }
    } catch (e) {
      console.error("Error fetching my bookings", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const { data, error: apiErr } = await api.sessions["my-bookings"].get();
        if (ignore) return;
        if (!apiErr && data?.success) {
          setBookings((data.bookings as MyBookingItem[]) || []);
          setWaitlist((data.waitlist as MyWaitlistItem[]) || []);
        }
      } catch (e) {
        console.error("Error loading bookings", e);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    if (!authLoading) {
      fetchData();
    }

    return () => {
      ignore = true;
    };
  }, [user, authLoading]);

  
  const handleCancelBooking = async (sessionId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;

    
    const bookingToCancel = bookings.find((b) => b.sessionId === sessionId);
    if (bookingToCancel && isSessionEnded(bookingToCancel, new Date())) {
      setStatusMessage({
        type: "error",
        text: "Cannot cancel a booking for a session that has already ended.",
      });
      return;
    }

    setActionLoadingId(sessionId);
    setStatusMessage(null);

    try {
      const { data, error: apiErr } = await api.sessions({ id: sessionId }).cancel.post();

      if (apiErr || !data?.success) {
        const errorMsg =
          (apiErr?.value as { message?: string })?.message ||
          "Failed to cancel booking.";
        setStatusMessage({ type: "error", text: errorMsg });
        return;
      }

      setStatusMessage({
        type: "success",
        text: data.message || "Booking cancelled successfully.",
      });

      await loadData();
    } catch {
      setStatusMessage({
        type: "error",
        text: "Network error occurred while cancelling booking.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const upcomingBookings = useMemo(() => {
    return bookings.filter(
      (b) => !isSessionEnded({ date: b.date, startHour: b.startHour, startTime: b.startTime }, currentTime)
    );
  }, [bookings, currentTime]);

  const pastBookings = useMemo(() => {
    return bookings.filter(
      (b) => isSessionEnded({ date: b.date, startHour: b.startHour, startTime: b.startTime }, currentTime)
    );
  }, [bookings, currentTime]);

  if (!authLoading && !user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-base-200 flex items-center justify-center text-base-content/60 mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold">Sign In Required</h1>
        <p className="text-sm text-base-content/60">
          Please sign in to your account to view your active gym passes and booking history.
        </p>
        <div className="pt-2">
          <Link href="/login?redirect=/my-bookings" className="btn btn-primary btn-sm px-6">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 w-full">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <QrCode className="w-7 h-7 text-primary" />
            My Bookings & Passes
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="btn btn-ghost btn-sm btn-square"
            title="Refresh bookings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link href="/" className="btn btn-primary btn-sm gap-1.5">
            <Dumbbell className="w-4 h-4" />
            Book a Slot
          </Link>
        </div>
      </div>

     
      {statusMessage && (
        <div
          role="alert"
          className={`alert ${
            statusMessage.type === "success" ? "alert-success" : "alert-error"
          } flex items-center justify-between text-sm py-2`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="btn btn-ghost btn-xs btn-square"
          >
            ✕
          </button>
        </div>
      )}

      
      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-8 w-40" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="skeleton h-44 w-full" />
            <div className="skeleton h-44 w-full" />
          </div>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Upcoming Sessions</h2>
              <span className="badge badge-primary badge-sm font-semibold">
                {upcomingBookings.length}
              </span>
            </div>

            {upcomingBookings.length === 0 ? (
              <div className="card bg-base-100 border border-dashed border-base-300 p-8 text-center space-y-3">
                <Calendar className="w-10 h-10 text-base-content/40 mx-auto" />
                <h3 className="font-semibold text-base">No Upcoming Passes</h3>
                <p className="text-xs text-base-content/60 max-w-sm mx-auto">
                  You don&apos;t have any active gym reservations. Check out available slots on the timetable!
                </p>
                <div className="pt-2">
                  <Link href="/" className="btn btn-primary btn-sm gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Browse Schedule
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcomingBookings.map((b) => (
                  <div
                    key={b.bookingId}
                    className="card bg-base-100 shadow-sm border border-primary/40 ring-1 ring-primary/20 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 left-0 h-1 bg-primary" />
                    <div className="card-body p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-lg">
                            <Clock className="w-4 h-4 text-primary" />
                            <span>{formatHour(b.startHour)}</span>
                          </div>
                          <div className="text-xs text-base-content/70 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatSessionDate(b.date)}</span>
                          </div>
                        </div>

                        {b.checkedIn ? (
                          <span className="badge badge-success badge-sm font-semibold gap-1">
                            <Check className="w-3 h-3" /> Present
                          </span>
                        ) : isSessionActive(
                            { date: b.date, startHour: b.startHour, startTime: b.startTime },
                            currentTime
                          ) ? (
                          <span className="badge badge-accent badge-sm font-semibold">
                            Active Now
                          </span>
                        ) : (
                          <span className="badge badge-outline badge-primary badge-sm font-semibold">
                            Confirmed
                          </span>
                        )}
                      </div>

                      
                      <div className="bg-base-200/70 rounded-xl p-4 text-center border border-base-300 space-y-1">
                        <div className="text-[11px] uppercase tracking-wider font-bold text-base-content/60">
                          Checkin Code
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-mono text-3xl font-black tracking-widest text-primary">
                            {b.checkInCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(b.checkInCode)}
                            className="btn btn-ghost btn-sm btn-square"
                            title="Copy code"
                          >
                            {copiedCode === b.checkInCode ? (
                              <Check className="w-4 h-4 text-success" />
                            ) : (
                              <Copy className="w-4 h-4 text-base-content/60" />
                            )}
                          </button>
                        </div>
                        <p className="text-[10px] text-base-content/50">
                          Present this 6-character code upon entering the gym
                        </p>

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setQrModalBooking(b)}
                            className="btn btn-sm btn-primary w-full gap-2 shadow-xs"
                          >
                            <QrCode className="w-4 h-4" />
                            Show QR Pass
                          </button>
                        </div>
                      </div>

                     
                      {!b.checkedIn && (
                        <div className="pt-1">
                          <button
                            type="button"
                            disabled={actionLoadingId === b.sessionId}
                            onClick={() => handleCancelBooking(b.sessionId)}
                            className="btn btn-outline btn-error btn-xs w-full gap-1.5"
                          >
                            {actionLoadingId === b.sessionId ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            Cancel Booking
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          
          {waitlist.length > 0 && (
            <section className="space-y-4 pt-4 border-t border-base-200">
              <div className="flex items-center gap-2">
                <Hourglass className="w-4 h-4 text-warning" />
                <h2 className="text-lg font-bold">Waitlist Positions</h2>
                <span className="badge badge-warning badge-sm font-semibold">
                  {waitlist.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {waitlist.map((w) => (
                  <div
                    key={w.waitlistId}
                    className="card bg-base-100 shadow-sm border border-warning/30 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-base">
                          <Clock className="w-4 h-4 text-warning" />
                          <span>{formatHour(w.startHour)}</span>
                        </div>
                        <div className="text-xs text-base-content/70 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatSessionDate(w.date)}</span>
                        </div>
                      </div>
                      <span className="badge badge-warning badge-sm font-semibold">
                        In Queue
                      </span>
                    </div>

                    <p className="text-xs text-base-content/70">
                      You are in line. If a member cancels their slot, you will be automatically promoted!
                    </p>

                    <button
                      type="button"
                      disabled={actionLoadingId === w.sessionId}
                      onClick={() => handleCancelBooking(w.sessionId)}
                      className="btn btn-outline btn-warning btn-xs w-full gap-1"
                    >
                      {actionLoadingId === w.sessionId ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      Leave Waitlist
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          
          {pastBookings.length > 0 && (
            <section className="space-y-4 pt-4 border-t border-base-200">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-base-content/60" />
                <h2 className="text-base font-bold text-base-content/70">Past Bookings</h2>
                <span className="badge badge-ghost badge-sm">
                  {pastBookings.length}
                </span>
              </div>

              <div className="space-y-2">
                {pastBookings.map((b) => (
                  <div
                    key={b.bookingId}
                    className="p-3 rounded-lg bg-base-100 border border-base-200 flex items-center justify-between text-xs gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-base-200 flex items-center justify-center text-base-content/60">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">
                          {formatHour(b.startHour)}
                        </div>
                        <div className="text-base-content/60">
                          {formatSessionDate(b.date)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base-content/60 text-xs">
                        Code: {b.checkInCode}
                      </span>
                      {b.checkedIn ? (
                        <span className="badge badge-success badge-xs">Attended</span>
                      ) : (
                        <span className="badge badge-ghost badge-xs">Completed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      
      <QrPassModal
        isOpen={!!qrModalBooking}
        onClose={() => setQrModalBooking(null)}
        booking={qrModalBooking}
      />
    </div>
  );
}

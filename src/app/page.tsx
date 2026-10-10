"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api-client";
import { DatePicker } from "@/app/components/date-picker";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  Filter,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  QrCode,
} from "lucide-react";
import { QrPassModal } from "@/app/components/qr-pass-modal";
import {
  isSessionEnded,
  isSessionStarted,
  isSessionActive,
} from "@/lib/session-time";
import { useSessions } from "@/lib/use-sessions";
import type { GymEvent } from "@/server/events";

interface UserBookingInfo {
  id: string;
  sessionId: string;
  status: string;
  checkInCode: string;
  checkedIn: boolean;
}

interface UserWaitlistInfo {
  id: string;
  sessionId: string;
  status: string;
}

interface SessionItem {
  id: string;
  date: string | Date;
  startHour: number;
  startTime: string | Date;
  capacity: number;
  confirmedBookingsCount: number;
  waitlistCount: number;
  seatsRemaining: number;
  isFull: boolean;
  hasStarted: boolean;
  hasEnded: boolean;
  isCurrentlyActive: boolean;
  myBooking: UserBookingInfo | null;
  myWaitlist: UserWaitlistInfo | null;
  isBookedByMe: boolean;
  isWaitlistedByMe: boolean;
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

function parseDateFromYYYYMMDD(str: string): Date | undefined {
  if (!str) return undefined;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatDateToYYYYMMDD(d: Date | undefined): string {
  if (!d) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Home() {
  const { user } = useAuth();

  const getTodayStr = () => new Date().toISOString().split("T")[0];
  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [availableOnly, setAvailableOnly] = useState<boolean>(false);

  
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

 
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  
  const [successModalData, setSuccessModalData] = useState<{
    code: string;
    date: string | Date;
    hour: number;
  } | null>(null);
  const [showQrFromModal, setShowQrFromModal] = useState<boolean>(false);

  
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: apiErr } = await api.sessions.get({
        query: {
          date: selectedDate || undefined,
          availableOnly: availableOnly ? "true" : undefined,
        },
      });

      if (apiErr || !data?.success) {
        const errorMsg =
          (apiErr?.value as { message?: string })?.message ||
          "Failed to load gym sessions.";
        setError(errorMsg);
        return;
      }

      setSessions((data.sessions as SessionItem[]) || []);
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, availableOnly]);

  useEffect(() => {
    let ignore = false;

    async function loadSessions() {
      try {
        const { data, error: apiErr } = await api.sessions.get({
          query: {
            date: selectedDate || undefined,
            availableOnly: availableOnly ? "true" : undefined,
          },
        });

        if (ignore) return;

        if (apiErr || !data?.success) {
          const errorMsg =
            (apiErr?.value as { message?: string })?.message ||
            "Failed to load gym sessions.";
          setError(errorMsg);
          return;
        }

        setSessions((data.sessions as SessionItem[]) || []);
      } catch {
        if (!ignore) {
          setError("An unexpected network error occurred.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadSessions();

    return () => {
      ignore = true;
    };
  }, [selectedDate, availableOnly]);

  const fetchSessionsSilently = useCallback(async () => {
    try {
      const { data, error: apiErr } = await api.sessions.get({
        query: {
          date: selectedDate || undefined,
          availableOnly: availableOnly ? "true" : undefined,
        },
      });

      if (!apiErr && data?.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions as SessionItem[]);
      }
    } catch {
    }
  }, [selectedDate, availableOnly]);

  useSessions({
    onSessionUpdate: (event: GymEvent) => {
      if (event.sessionId && event.data) {
        setSessions((prevSessions) =>
          prevSessions.map((s) => {
            if (s.id === event.sessionId && event.data) {
              const confirmed =
                typeof event.data.confirmedBookingsCount === "number"
                  ? event.data.confirmedBookingsCount
                  : s.confirmedBookingsCount;
              const waitlist =
                typeof event.data.waitlistCount === "number"
                  ? event.data.waitlistCount
                  : s.waitlistCount;
              const capacity =
                typeof event.data.capacity === "number"
                  ? event.data.capacity
                  : s.capacity;
              const seats =
                typeof event.data.seatsRemaining === "number"
                  ? event.data.seatsRemaining
                  : Math.max(0, capacity - confirmed);
              const full =
                typeof event.data.isFull === "boolean"
                  ? event.data.isFull
                  : confirmed >= capacity;

              return {
                ...s,
                confirmedBookingsCount: confirmed,
                waitlistCount: waitlist,
                seatsRemaining: seats,
                isFull: full,
              };
            }
            return s;
          })
        );
      }
    },
    onRefresh: fetchSessionsSilently,
  });

  
  const handleBookSession = async (
    sessionId: string,
    sessionDate: string | Date,
    sessionHour: number,
    startTime?: string | Date
  ) => {
    if (!user) return;

    const sessionSource = { date: sessionDate, startHour: sessionHour, startTime };
    if (isSessionStarted(sessionSource, new Date())) {
      setStatusMessage({
        type: "error",
        text: "Cannot book a session that has already started or ended.",
      });
      return;
    }

    setActionLoadingId(sessionId);
    setStatusMessage(null);

    try {
      const { data, error: apiErr } = await api.sessions({ id: sessionId }).book.post();

      if (apiErr || !data?.success) {
        const errorMsg =
          (apiErr?.value as { message?: string })?.message ||
          (apiErr?.value as { error?: { message?: string } })?.error?.message ||
          "Failed to book slot. Please try again.";
        setStatusMessage({ type: "error", text: errorMsg });
        return;
      }

      if (data.isWaitlist) {
        setStatusMessage({
          type: "info",
          text: data.message || "Added to waitlist successfully.",
        });
      } else {
        const checkInCode = (data.booking as { checkInCode?: string })?.checkInCode || "";
        setSuccessModalData({
          code: checkInCode,
          date: sessionDate,
          hour: sessionHour,
        });
      }

      await fetchSessions();
    } catch {
      setStatusMessage({
        type: "error",
        text: "Network error occurred while booking. Please try again.",
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

  const sortedSessions: SessionItem[] = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const dateA = typeof a.date === "string" ? a.date : formatSessionDate(a.date);
      const dateB = typeof b.date === "string" ? b.date : formatSessionDate(b.date);
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      return a.startHour - b.startHour;
    });
  }, [sessions]);

  
  const filteredSessions: SessionItem[] = useMemo(() => {
    if (!availableOnly) return sortedSessions;
    return sortedSessions.filter(
      (s) =>
        s.seatsRemaining > 0 &&
        !isSessionEnded({ date: s.date, startHour: s.startHour, startTime: s.startTime }, currentTime)
    );
  }, [sortedSessions, availableOnly, currentTime]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 w-full">
     
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Dumbbell className="w-7 h-7 text-primary" />
            Gym Booking Slots
          </h1>
          </div>

        
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            id="home-date-picker"
            date={parseDateFromYYYYMMDD(selectedDate)}
            onSelect={(d) => setSelectedDate(formatDateToYYYYMMDD(d))}
            placeholder="Pick Date"
            size="sm"
            clearable={false}
            className="w-40"
          />

          <div className="join">
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayStr())}
              className={`btn btn-xs join-item ${
                selectedDate === getTodayStr() ? "btn-primary" : "btn-outline"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getTomorrowStr())}
              className={`btn btn-xs join-item ${
                selectedDate === getTomorrowStr() ? "btn-primary" : "btn-outline"
              }`}
            >
              Tomorrow
            </button>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-base-content/60" />
                Filter:
              </span>
              <div className="join">
                <button
                  type="button"
                  onClick={() => setAvailableOnly(false)}
                  className={`btn btn-xs join-item ${
                    !availableOnly ? "btn-primary" : "btn-outline"
                  }`}
                >
                  All Slots
                </button>
                <button
                  type="button"
                  onClick={() => setAvailableOnly(true)}
                  className={`btn btn-xs join-item ${
                    availableOnly ? "btn-primary" : "btn-outline"
                  }`}
                >
                  Available Only
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 text-base-content/70">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-success inline-block" /> Available
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-error inline-block" /> Full
              </span>
              <button
                type="button"
                onClick={fetchSessions}
                disabled={loading}
                className="btn btn-ghost btn-xs btn-square"
                title="Refresh schedule"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          role="alert"
          className={`alert ${
            statusMessage.type === "success"
              ? "alert-success"
              : statusMessage.type === "error"
              ? "alert-error"
              : "alert-info"
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

      {error && (
        <div role="alert" className="alert alert-error text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchSessions} className="btn btn-xs btn-outline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="card bg-base-100 border border-base-200 p-5 space-y-3">
              <div className="skeleton h-6 w-32" />
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-8 w-full mt-2" />
            </div>
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="card bg-base-100 border border-dashed border-base-300 p-8 text-center space-y-3">
          <Calendar className="w-10 h-10 text-base-content/40 mx-auto" />
          <h3 className="font-bold text-base">No Sessions Available</h3>
          <p className="text-xs text-base-content/60 max-w-sm mx-auto">
            No gym sessions match your selected date or availability filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => {
            const isBooked = session.isBookedByMe;
            const isWaitlisted = session.isWaitlistedByMe;
            const sessionSource = {
              date: session.date,
              startHour: session.startHour,
              startTime: session.startTime,
            };
            const hasEnded = isSessionEnded(sessionSource, currentTime);
            const hasStarted = isSessionStarted(sessionSource, currentTime);
            const isCurrentlyActive = isSessionActive(sessionSource, currentTime);
            const isLoadingThis = actionLoadingId === session.id;

            return (
              <div
                key={session.id}
                className={`card bg-base-100 shadow-sm border transition-all ${
                  hasEnded
                    ? "border-base-200 opacity-60 bg-base-200/20"
                    : isCurrentlyActive
                    ? isBooked
                      ? "border-accent ring-1 ring-accent/40 bg-accent/5"
                      : "border-accent ring-1 ring-accent/30"
                    : isBooked
                    ? "border-primary ring-1 ring-primary/40 bg-primary/5"
                    : "border-base-200 hover:border-primary/40"
                }`}
              >
                <div className="card-body p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-lg">
                          <Clock className="w-4 h-4 text-primary" />
                          <span>{formatHour(session.startHour)}</span>
                        </div>
                        <div className="text-xs text-base-content/60 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatSessionDate(session.date)}</span>
                        </div>
                      </div>

                     {hasEnded ? (
                        <div className="flex items-center gap-1.5">
                          {isBooked && (
                            <span className="badge badge-outline badge-ghost badge-sm text-base-content/60">
                              Booked
                            </span>
                          )}
                          {isWaitlisted && (
                            <span className="badge badge-outline badge-ghost badge-sm text-base-content/60">
                              Waitlisted
                            </span>
                          )}
                          <span className="badge badge-ghost badge-sm text-base-content/50">
                            Ended
                          </span>
                        </div>
                      ) : isCurrentlyActive ? (
                        <div className="flex items-center gap-1.5">
                          {isBooked && (
                            <span className="badge badge-primary badge-sm font-semibold">
                              Booked
                            </span>
                          )}
                          <span className="badge badge-accent badge-sm font-semibold">
                            In Progress
                          </span>
                        </div>
                      ) : isBooked ? (
                        <span className="badge badge-primary badge-sm font-semibold">
                          Booked
                        </span>
                      ) : isWaitlisted ? (
                        <span className="badge badge-warning badge-sm font-semibold">
                          Waitlisted
                        </span>
                      ) : session.isFull ? (
                        <span className="badge badge-error badge-sm font-semibold">
                          Full
                        </span>
                      ) : (
                        <span className="badge badge-success badge-sm font-semibold">
                          {session.seatsRemaining} Open
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 mt-4">
                      <div className="flex justify-between text-xs font-medium">
                        <span>Capacity</span>
                        <span>
                          {session.confirmedBookingsCount} / {session.capacity}
                        </span>
                      </div>
                      <progress
                        className={`progress w-full ${
                          hasEnded
                            ? "progress-neutral opacity-40"
                            : session.isFull
                            ? "progress-error"
                            : "progress-primary"
                        }`}
                        value={session.confirmedBookingsCount}
                        max={session.capacity}
                      />
                      <div className="flex justify-between text-[11px] text-base-content/60">
                        <span>
                          {session.seatsRemaining > 0
                            ? `${session.seatsRemaining} spots available`
                            : "No spots available"}
                        </span>
                        {session.waitlistCount > 0 && (
                          <span className="text-warning font-semibold">
                            Waitlist: {session.waitlistCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-base-200">
                    {hasEnded ? (
                      <div className="space-y-1">
                        <button
                          type="button"
                          disabled
                          className="btn btn-sm btn-ghost btn-block text-xs text-base-content/40 cursor-not-allowed border border-dashed border-base-300"
                        >
                          Session Ended
                        </button>
                        {isBooked && (
                          <Link
                            href="/my-bookings"
                            className="text-[11px] text-center text-primary/70 hover:underline block pt-0.5"
                          >
                            View in My Bookings →
                          </Link>
                        )}
                      </div>
                    ) : isBooked ? (
                      <Link
                        href="/my-bookings"
                        className="btn btn-sm btn-outline btn-primary btn-block gap-1.5"
                      >
                        <Check className="w-4 h-4 text-success" />
                        View Pass & Code
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    ) : isWaitlisted ? (
                      <Link
                        href="/my-bookings"
                        className="btn btn-sm btn-outline btn-warning btn-block gap-1.5"
                      >
                        View in My Bookings
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    ) : isCurrentlyActive || hasStarted ? (
                      <button
                        type="button"
                        disabled
                        className="btn btn-sm btn-ghost btn-block text-xs text-base-content/40 cursor-not-allowed border border-dashed border-base-300"
                      >
                        In Progress (Booking Closed)
                      </button>
                    ) : !user ? (
                      <Link
                        href="/login"
                        className="btn btn-sm btn-outline btn-primary btn-block gap-1.5"
                      >
                        Sign In to Book
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    ) : session.isFull ? (
                      <button
                        type="button"
                        disabled={isLoadingThis}
                        onClick={() =>
                          handleBookSession(session.id, session.date, session.startHour, session.startTime)
                        }
                        className="btn btn-sm btn-warning btn-block gap-1.5"
                      >
                        {isLoadingThis ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                        Join Waitlist
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isLoadingThis}
                        onClick={() =>
                          handleBookSession(session.id, session.date, session.startHour, session.startTime)
                        }
                        className="btn btn-sm btn-primary btn-block gap-1.5"
                      >
                        {isLoadingThis ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Dumbbell className="w-4 h-4" />
                        )}
                        Book Slot
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {successModalData && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm text-center p-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-success/10 text-success mx-auto flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-success" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-xl">Spot Confirmed!</h3>
              <p className="text-xs text-base-content/70">
                You are booked for {formatSessionDate(successModalData.date)} at{" "}
                {formatHour(successModalData.hour)}.
              </p>
            </div>

            <div className="bg-base-200/70 p-4 rounded-xl border border-base-300 space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider font-bold text-base-content/60">
                Your 6-Digit Check-In Code
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-3xl font-black text-primary tracking-widest">
                  {successModalData.code}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(successModalData.code)}
                  className="btn btn-ghost btn-sm btn-square"
                  title="Copy code"
                >
                  {copiedCode === successModalData.code ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-base-content/50">
                Show this code at the gym desk when you arrive
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowQrFromModal(true)}
                className="btn btn-primary btn-block btn-sm gap-2"
              >
                <QrCode className="w-4 h-4" />
                Show QR Pass
              </button>
              <Link
                href="/my-bookings"
                className="btn btn-outline btn-block btn-sm"
              >
                View in My Bookings
              </Link>
              <button
                type="button"
                onClick={() => setSuccessModalData(null)}
                className="btn btn-ghost btn-block btn-xs"
              >
                Close
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setSuccessModalData(null)} />
        </div>
      )}

      <QrPassModal
        isOpen={showQrFromModal && !!successModalData}
        onClose={() => setShowQrFromModal(false)}
        booking={
          successModalData
            ? {
                checkInCode: successModalData.code,
                date: successModalData.date,
                startHour: successModalData.hour,
                status: "confirmed",
              }
            : null
        }
      />
    </div>
  );
}

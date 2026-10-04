"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { DatePicker } from "@/app/components/date-picker";
import { OtpInput } from "@/app/components/otp-input";
import {
  Calendar,
  Clock,
  Plus,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Filter,
  User,
  QrCode,
} from "lucide-react";
import { QrScannerModal } from "@/app/components/qr-scanner-modal";
import {
  isSessionEnded,
  isSessionActive,
  isSlotInPast,
} from "@/lib/session-time";

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
}

interface Attendee {
  id: string;
  checkInCode: string;
  checkedIn: boolean;
  checkedInAt: string | Date | null;
  status: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface WaitlistAttendee {
  id: string;
  status: string;
  createdAt: string | Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface SessionDetails {
  id: string;
  bookings: Attendee[];
  waitlist: WaitlistAttendee[];
}

const OPERATING_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

type TimelineSlot =
  | { type: "session"; hour: number; session: SessionItem }
  | { type: "empty"; hour: number; isPast: boolean };

function formatHour(hour: number): string {
  const startStr = `${String(hour).padStart(2, "0")}:00`;
  const endHour = (hour + 1) % 24;
  const endStr = `${String(endHour).padStart(2, "0")}:00`;
  return `${startStr} - ${endStr}`;
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

function AdminSessionsContent() {
  const getTodayStr = () => new Date().toISOString().split("T")[0];
  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  const searchParams = useSearchParams();
  const urlDate = searchParams.get("date");

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (urlDate) return urlDate;
    return getTodayStr();
  });
  const [slotFilter, setSlotFilter] = useState<"all" | "scheduled" | "empty">("all");

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [sessionDetails, setSessionDetails] = useState<Record<string, SessionDetails>>({});

  const [checkInCode, setCheckInCode] = useState<string>("");
  const [checkInLoading, setCheckInLoading] = useState<boolean>(false);
  const [checkInResult, setCheckInResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showScanner, setShowScanner] = useState<boolean>(false);

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
      const { data, error: apiError } = await api.sessions.get({
        query: {
          date: selectedDate || undefined,
        },
      });

      if (apiError || !data?.success) {
        const errorMsg =
          (apiError?.value as { message?: string })?.message ||
          "Failed to load sessions. Please try again.";
        setError(errorMsg);
        return;
      }

      setSessions((data.sessions as SessionItem[]) || []);
    } catch {
      setError("An unexpected network error occurred while loading sessions.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    let ignore = false;

    async function loadSessions() {
      try {
        const { data, error: apiError } = await api.sessions.get({
          query: {
            date: selectedDate || undefined,
          },
        });

        if (ignore) return;

        if (apiError || !data?.success) {
          const errorMsg =
            (apiError?.value as { message?: string })?.message ||
            "Failed to load sessions. Please try again.";
          setError(errorMsg);
          return;
        }

        setSessions((data.sessions as SessionItem[]) || []);
      } catch {
        if (!ignore) {
          setError("An unexpected network error occurred while loading sessions.");
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
  }, [selectedDate]);

  const toggleExpandSession = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }

    setExpandedSessionId(sessionId);

    if (!sessionDetails[sessionId]) {
      setDetailsLoading(true);
      try {
        const { data, error: apiError } = await api.sessions({ id: sessionId }).get();
        if (!apiError && data?.success && data.session) {
          setSessionDetails((prev) => ({
            ...prev,
            [sessionId]: {
              id: sessionId,
              bookings: data.session.bookings as Attendee[],
              waitlist: data.session.waitlist as WaitlistAttendee[],
            },
          }));
        }
      } catch (err) {
        console.error("Error fetching session details", err);
      } finally {
        setDetailsLoading(false);
      }
    }
  };

  const handleCheckInSubmit = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const finalCode = (codeOverride || checkInCode).trim().toUpperCase();
    if (!finalCode) return;

    setCheckInLoading(true);
    setCheckInResult(null);

    try {
      const { data, error: apiError } = await api.sessions["check-in"].post({
        code: finalCode,
      });

      if (apiError || !data?.success) {
        const errorMsg =
          (apiError?.value as { message?: string })?.message ||
          "Invalid check-in code or session is not active right now.";
        setCheckInResult({ success: false, message: errorMsg });
        return;
      }

      setCheckInResult({
        success: true,
        message: data.message || "Member checked in successfully!",
      });
      setCheckInCode("");

      fetchSessions();
      if (expandedSessionId) {
        const res = await api.sessions({ id: expandedSessionId }).get();
        if (res.data?.success && res.data.session) {
          setSessionDetails((prev) => ({
            ...prev,
            [expandedSessionId]: {
              id: expandedSessionId,
              bookings: res.data.session.bookings as Attendee[],
              waitlist: res.data.session.waitlist as WaitlistAttendee[],
            },
          }));
        }
      }
    } catch {
      setCheckInResult({
        success: false,
        message: "Network error processing check-in.",
      });
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleDirectCheckIn = async (code: string) => {
    setCheckInCode(code);
    setCheckInLoading(true);
    setCheckInResult(null);

    try {
      const { data, error: apiError } = await api.sessions["check-in"].post({
        code: code.trim().toUpperCase(),
      });

      if (apiError || !data?.success) {
        const errorMsg =
          (apiError?.value as { message?: string })?.message ||
          "Failed to check in member.";
        setCheckInResult({ success: false, message: errorMsg });
        return;
      }

      setCheckInResult({
        success: true,
        message: data.message || `Checked in successfully!`,
      });

      if (expandedSessionId) {
        const res = await api.sessions({ id: expandedSessionId }).get();
        if (res.data?.success && res.data.session) {
          setSessionDetails((prev) => ({
            ...prev,
            [expandedSessionId]: {
              id: expandedSessionId,
              bookings: res.data.session.bookings as Attendee[],
              waitlist: res.data.session.waitlist as WaitlistAttendee[],
            },
          }));
        }
      }
      fetchSessions();
    } catch {
      setCheckInResult({
        success: false,
        message: "Network error processing check-in.",
      });
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleScanCode = async (scannedCode: string) => {
    try {
      const { data, error: apiError } = await api.sessions["check-in"].post({
        code: scannedCode.trim().toUpperCase(),
      });

      if (apiError || !data?.success) {
        const errorMsg =
          (apiError?.value as { message?: string })?.message ||
          "Invalid check-in code or session is not active right now.";
        return {
          success: false,
          message: errorMsg,
        };
      }

      fetchSessions();
      if (expandedSessionId) {
        const res = await api.sessions({ id: expandedSessionId }).get();
        if (res.data?.success && res.data.session) {
          setSessionDetails((prev) => ({
            ...prev,
            [expandedSessionId]: {
               id: expandedSessionId,
               bookings: res.data.session.bookings as Attendee[],
               waitlist: res.data.session.waitlist as WaitlistAttendee[],
            },
          }));
        }
      }

      return {
        success: true,
        message: data.message || "Checked in successfully!",
        memberName: (data.booking as { userName?: string })?.userName,
      };
    } catch {
      return {
        success: false,
        message: "Network error processing check-in.",
      };
    }
  };

  const allHoursForDay = useMemo(() => {
    if (!selectedDate) return [];
    const sessionHours = sessions.map((s) => s.startHour);
    return Array.from(new Set([...OPERATING_HOURS, ...sessionHours])).sort(
      (a, b) => a - b
    );
  }, [selectedDate, sessions]);

  const scheduledCount = sessions.length;
  const emptyCount = Math.max(0, allHoursForDay.length - scheduledCount);
  const totalCount = allHoursForDay.length;

  const timelineSlots: TimelineSlot[] = useMemo(() => {
    if (!selectedDate) {
      return sessions.map((s) => ({
        type: "session" as const,
        hour: s.startHour,
        session: s,
      }));
    }

    const sessionMap = new Map<number, SessionItem>();
    for (const s of sessions) {
      sessionMap.set(s.startHour, s);
    }

    const slots: TimelineSlot[] = [];
    for (const hour of allHoursForDay) {
      const existing = sessionMap.get(hour);
      if (existing) {
        if (slotFilter === "all" || slotFilter === "scheduled") {
          slots.push({
            type: "session",
            hour,
            session: existing,
          });
        }
      } else {
        if (slotFilter === "all" || slotFilter === "empty") {
          slots.push({
            type: "empty",
            hour,
            isPast: isSlotInPast(selectedDate, hour, currentTime),
          });
        }
      }
    }

    return slots;
  }, [selectedDate, sessions, allHoursForDay, slotFilter, currentTime]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" />
            Gym Sessions & Attendance
          </h1>
        </div>

        <Link href="/admin/create" className="btn btn-primary self-start md:self-auto gap-2">
          <Plus className="w-4 h-4" />
          Create Session
        </Link>
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Mark as present</h2>
              </div>
              <p className="text-xs text-base-content/60 mt-1">
                Scan member QR pass with camera or enter the 6-character code.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              {checkInCode && (
                <button
                  type="button"
                  onClick={() => {
                    setCheckInCode("");
                    setCheckInResult(null);
                  }}
                  className="btn btn-ghost btn-xs text-base-content/60 hover:text-base-content"
                >
                  Clear code
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="btn btn-primary btn-sm gap-2 shadow-xs"
              >
                <QrCode className="w-4 h-4" />
                Scan QR Code
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => handleCheckInSubmit(e)}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            <div className="overflow-x-auto max-w-full py-1">
              <OtpInput
                id="check-in-code-input"
                length={6}
                value={checkInCode}
                onChange={(code) => {
                  setCheckInCode(code);
                  if (checkInResult) setCheckInResult(null);
                }}
                disabled={checkInLoading}
                onComplete={(code) => handleCheckInSubmit(undefined, code)}
              />
            </div>

            <button
              type="submit"
              disabled={checkInLoading || checkInCode.length < 6}
              className="btn btn-primary w-full sm:w-auto gap-2 px-6"
            >
              {checkInLoading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
              Mark Present
            </button>
          </form>

          {checkInResult && (
            <div
              role="alert"
              className={`alert ${
                checkInResult.success ? "alert-success" : "alert-error"
              } text-sm mt-3 py-2 flex items-center gap-2`}
            >
              {checkInResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{checkInResult.message}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-base-content/60" />
                <label htmlFor="filter-date-input" className="text-sm font-semibold">
                  Date:
                </label>
                <DatePicker
                  id="filter-date-input"
                  date={parseDateFromYYYYMMDD(selectedDate)}
                  onSelect={(d) => setSelectedDate(formatDateToYYYYMMDD(d))}
                  placeholder="All Dates"
                  size="sm"
                  clearable
                  className="w-44"
                />
              </div>

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
                <button
                  type="button"
                  onClick={() => setSelectedDate("")}
                  className={`btn btn-xs join-item ${
                    selectedDate === "" ? "btn-primary" : "btn-outline"
                  }`}
                >
                  All Dates
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3">
              {selectedDate && (
                <div className="join">
                  <button
                    type="button"
                    onClick={() => setSlotFilter("all")}
                    className={`btn btn-xs join-item ${
                      slotFilter === "all" ? "btn-primary" : "btn-outline"
                    }`}
                  >
                    All Slots ({totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotFilter("scheduled")}
                    className={`btn btn-xs join-item ${
                      slotFilter === "scheduled" ? "btn-primary" : "btn-outline"
                    }`}
                  >
                    Scheduled ({scheduledCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotFilter("empty")}
                    className={`btn btn-xs join-item ${
                      slotFilter === "empty" ? "btn-primary" : "btn-outline"
                    }`}
                  >
                    Empty Slots ({emptyCount})
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={fetchSessions}
                disabled={loading}
                className="btn btn-ghost btn-sm btn-square"
                title="Refresh sessions"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        {error && (
          <div role="alert" className="alert alert-error mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
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
        ) : timelineSlots.length === 0 ? (
          
          <div className="card bg-base-100 border border-dashed border-base-300 p-8 text-center space-y-3">
            <Calendar className="w-12 h-12 text-base-content/40 mx-auto" />
            <h3 className="font-bold text-lg">
              {slotFilter === "scheduled"
                ? "No Scheduled Sessions"
                : slotFilter === "empty"
                ? "No Empty Slots Found"
                : "No Sessions Found"}
            </h3>
            <p className="text-sm text-base-content/70 max-w-sm mx-auto">
              {slotFilter === "scheduled" && selectedDate
                ? `No sessions are scheduled for ${selectedDate}.`
                : slotFilter === "empty" && selectedDate
                ? `All operating hours for ${selectedDate} already have sessions scheduled.`
                : selectedDate
                ? `No slots found for ${selectedDate}.`
                : "No gym sessions have been scheduled yet."}
            </p>
            <div className="pt-2">
              {slotFilter !== "all" && selectedDate ? (
                <button
                  type="button"
                  onClick={() => setSlotFilter("all")}
                  className="btn btn-primary btn-sm gap-2"
                >
                  View All Slots
                </button>
              ) : (
                <Link href="/admin/create" className="btn btn-primary btn-sm gap-2">
                  <Plus className="w-4 h-4" />
                  Schedule First Session
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {timelineSlots.map((slot) => {
              if (slot.type === "session") {
                const session = slot.session;
                const isExpanded = expandedSessionId === session.id;
                const details = sessionDetails[session.id];
                const sessionSource = {
                  date: session.date,
                  startHour: session.startHour,
                  startTime: session.startTime,
                };
                const hasEnded = isSessionEnded(sessionSource, currentTime);
                const isCurrentlyActive = isSessionActive(sessionSource, currentTime);

                return (
                  <div
                    key={`session-${session.id}`}
                    className={`card bg-base-100 shadow-sm border transition-all ${
                      hasEnded
                        ? "border-base-200 opacity-60 bg-base-200/20"
                        : isCurrentlyActive
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-base-200"
                    }`}
                  >
                    <div className="card-body p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-lg">
                            <Clock className="w-4 h-4 text-primary" />
                            <span>{formatHour(session.startHour)}</span>
                          </div>
                          <div className="text-xs text-base-content/70 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatSessionDate(session.date)}</span>
                          </div>
                        </div>

                        {isCurrentlyActive ? (
                          <span className="badge badge-accent badge-sm font-semibold">
                            In Progress
                          </span>
                        ) : hasEnded ? (
                          <span className="badge badge-ghost badge-sm text-base-content/60">
                            Ended
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

                      <div className="space-y-1.5 mt-3">
                        <div className="flex justify-between text-xs font-medium">
                          <span>Bookings</span>
                          <span>
                            {session.confirmedBookingsCount} / {session.capacity}
                          </span>
                        </div>
                        <progress
                          className={`progress w-full ${
                            session.isFull ? "progress-error" : "progress-primary"
                          }`}
                          value={session.confirmedBookingsCount}
                          max={session.capacity}
                        />
                        <div className="flex justify-between text-[11px] text-base-content/60">
                          <span>
                            {session.seatsRemaining > 0
                              ? `${session.seatsRemaining} seats available`
                              : "No seats remaining"}
                          </span>
                          {session.waitlistCount > 0 && (
                            <span className="text-warning font-semibold">
                              Waitlist: {session.waitlistCount}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-base-200 mt-2">
                        <button
                          type="button"
                          onClick={() => toggleExpandSession(session.id)}
                          className="btn btn-ghost btn-sm w-full justify-between px-2 text-xs font-semibold"
                        >
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            Attendees ({session.confirmedBookingsCount})
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-base-200 space-y-3">
                            {detailsLoading && !details ? (
                              <div className="flex justify-center p-3">
                                <span className="loading loading-spinner loading-sm text-primary" />
                              </div>
                            ) : !details || details.bookings.length === 0 ? (
                              <div className="text-center py-2 text-xs text-base-content/60">
                                No members have booked this session yet.
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                <span className="text-[11px] uppercase tracking-wider font-bold text-base-content/60">
                                  Confirmed Members ({details.bookings.length})
                                </span>
                                {details.bookings.map((booking) => (
                                  <div
                                    key={booking.id}
                                    className="p-2 rounded-lg bg-base-200/50 flex items-center justify-between text-xs gap-2"
                                  >
                                    <div className="truncate">
                                      <div className="font-semibold truncate">
                                        {booking.user.name}
                                      </div>
                                      <div className="text-[11px] text-base-content/60 truncate">
                                        Code: <span className="font-mono font-bold">{booking.checkInCode}</span>
                                      </div>
                                    </div>

                                    {booking.checkedIn ? (
                                      <span className="badge badge-success badge-xs font-semibold shrink-0">
                                        Present
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={checkInLoading || hasEnded}
                                        onClick={() => handleDirectCheckIn(booking.checkInCode)}
                                        className="btn btn-xs btn-primary shrink-0"
                                        title={hasEnded ? "Session has ended" : "Mark Present"}
                                      >
                                        Check In
                                      </button>
                                    )}
                                  </div>
                                ))}

                                {details.waitlist && details.waitlist.length > 0 && (
                                  <div className="pt-2 border-t border-base-200 space-y-1">
                                    <span className="text-[11px] uppercase tracking-wider font-bold text-warning">
                                      Waitlist Queue ({details.waitlist.length})
                                    </span>
                                    {details.waitlist.map((w, index) => (
                                      <div
                                        key={w.id}
                                        className="p-1.5 rounded bg-warning/10 text-xs flex justify-between items-center"
                                      >
                                        <span className="truncate">
                                          #{index + 1} {w.user.name}
                                        </span>
                                        <span className="text-[10px] text-base-content/60">
                                          Waiting
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              const hour = slot.hour;
              const isPast = slot.isPast;

              return (
                <div
                  key={`empty-${selectedDate || "day"}-${hour}`}
                  className={`card bg-base-100/70 shadow-sm border border-dashed transition-all ${
                    isPast
                      ? "border-base-300 opacity-60 bg-base-200/30"
                      : "border-base-300 hover:border-primary/60 hover:bg-base-100 group"
                  }`}
                >
                  <div className="card-body p-5 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-lg text-base-content/90">
                          <Clock
                            className={`w-4 h-4 ${
                              isPast ? "text-base-content/40" : "text-primary"
                            }`}
                          />
                          <span>{formatHour(hour)}</span>
                        </div>
                        <div className="text-xs text-base-content/60 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{selectedDate || "Today"}</span>
                        </div>
                      </div>

                      {isPast ? (
                        <span className="badge badge-ghost badge-sm text-base-content/50">
                          Past Slot
                        </span>
                      ) : (
                        <span className="badge badge-outline badge-sm text-primary border-primary/50 font-medium">
                          Empty Slot
                        </span>
                      )}
                    </div>

                    <div className="my-4 py-3 px-3 rounded-lg bg-base-200/40 border border-base-200/60 text-center">
                      <p className="text-xs text-base-content/70">
                        {isPast
                          ? "This time slot has passed"
                          : "No session scheduled for this slot"}
                      </p>
                    </div>

                    <div>
                      {isPast ? (
                        <button
                          type="button"
                          disabled
                          className="btn btn-sm btn-ghost btn-block text-xs text-base-content/40 cursor-not-allowed border border-dashed border-base-300"
                          title="Cannot schedule sessions in the past"
                        >
                          <Plus className="w-4 h-4 opacity-40" />
                          <span>Unavailable</span>
                        </button>
                      ) : (
                        <Link
                          href={`/admin/create?date=${selectedDate}&hour=${hour}`}
                          className="btn btn-sm btn-primary btn-outline btn-block gap-2 group-hover:btn-primary transition-colors"
                          title={`Schedule session at ${formatHour(hour)}`}
                        >
                          <Plus className="w-4 h-4" />
                          <span>Schedule Session</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <QrScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanCode={handleScanCode}
      />
    </div>
  );
}

export default function AdminSessionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      }
    >
      <AdminSessionsContent />
    </Suspense>
  );
}
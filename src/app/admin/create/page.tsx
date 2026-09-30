"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { DatePicker } from "@/app/components/date-picker";
import { ArrowLeft, Calendar, Clock, Users, CheckCircle2, AlertCircle } from "lucide-react";

const AVAILABLE_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

function isHourInPast(date: Date | undefined, hour: number): boolean {
  if (!date) return true;
  const now = new Date();
  const slotDate = new Date(date);
  slotDate.setHours(hour, 0, 0, 0);
  return slotDate <= now;
}

function getInitialDate(): Date {
  const now = new Date();
  const hasRemainingToday = AVAILABLE_HOURS.some((h) => !isHourInPast(now, h));
  if (!hasRemainingToday) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  return now;
}

function getFirstValidHour(date: Date | undefined): number {
  if (!date) return 9;
  const firstValid = AVAILABLE_HOURS.find((h) => !isHourInPast(date, h));
  return firstValid ?? 9;
}

function parseDateFromYYYYMMDD(str: string | null): Date | undefined {
  if (!str) return undefined;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatHourLabel(hour: number): string {
  const startStr = `${String(hour).padStart(2, "0")}:00`;
  const endHour = (hour + 1) % 24;
  const endStr = `${String(endHour).padStart(2, "0")}:00`;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${startStr} - ${endStr} (${displayHour}:00 ${period})`;
}

function formatDateToYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CreateSessionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const hourParam = searchParams.get("hour");

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    if (dateParam) {
      const parsed = parseDateFromYYYYMMDD(dateParam);
      if (parsed) return parsed;
    }
    return getInitialDate();
  });

  const [startHour, setStartHour] = useState<number>(() => {
    if (hourParam) {
      const h = Number(hourParam);
      if (!isNaN(h) && h >= 0 && h <= 23) return h;
    }
    return getFirstValidHour(getInitialDate());
  });
  const [capacity, setCapacity] = useState<number>(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validHours = AVAILABLE_HOURS.filter((h) => !isHourInPast(selectedDate, h));
  const allSlotsPassedToday = Boolean(selectedDate && validHours.length === 0);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const valid = getFirstValidHour(date);
      setStartHour(valid);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedDate) {
      setError("Please select a date for the session.");
      return;
    }

    if (isHourInPast(selectedDate, startHour)) {
      setError("Cannot schedule a session in the past. Please choose an upcoming date and time.");
      return;
    }

    if (startHour < 0 || startHour > 23) {
      setError("Please choose a valid start hour between 0 and 23.");
      return;
    }

    if (capacity < 1 || capacity > 100) {
      setError("Capacity must be at least 1 person.");
      return;
    }

    setLoading(true);

    const dateStr = formatDateToYYYYMMDD(selectedDate);
    const slotDate = new Date(selectedDate);
    slotDate.setHours(startHour, 0, 0, 0);

    try {
      const { data, error: apiError } = await api.sessions.post({
        date: dateStr,
        startHour,
        capacity,
        startTime: slotDate.toISOString(),
      });

      if (apiError || !data?.success) {
        const errorMsg =
          (apiError?.value as { message?: string })?.message ||
          (apiError?.value as { error?: { message?: string } })?.error?.message ||
          "Failed to create session. Please verify the time and try again.";
        setError(errorMsg);
        return;
      }

      setSuccess(`Session for ${dateStr} at ${String(startHour).padStart(2, "0")}:00 created successfully!`);
      setTimeout(() => {
        router.push(`/admin?date=${dateStr}`);
        router.refresh();
      }, 1000);
    } catch {
      setError("An unexpected error occurred while communicating with the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-4">
      <div className="mb-6">
        <Link href="/admin" className="btn btn-ghost btn-sm gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to All Sessions
        </Link>
      </div>

      <div className="card bg-base-100 shadow-md border border-base-200">
        <div className="card-body">
          <h1 className="card-title text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Create Gym Session
          </h1>

          {error && (
            <div role="alert" className="alert alert-error text-sm flex items-start gap-2 mb-4">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Error: </span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div role="alert" className="alert alert-success text-sm flex items-start gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            <div className="form-control">
              <label htmlFor="session-date" className="label">
                <span className="label-text font-semibold flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" />
                  Session Date <span className="text-error">*</span>
                </span>
              </label>

              <DatePicker
                id="session-date"
                date={selectedDate}
                onSelect={handleDateSelect}
                minDate={new Date()}
                className="w-full"
                placeholder="Pick session date"
              />
            </div>

            <div className="form-control">
              <label htmlFor="session-hour" className="label">
                <span className="label-text font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" />
                  Start Hour <span className="text-error">*</span>
                </span>
                {allSlotsPassedToday && (
                  <span className="label-text-alt text-warning font-medium">All today&apos;s hours passed</span>
                )}
              </label>

              {allSlotsPassedToday ? (
                <div className="alert alert-warning text-sm py-2.5 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>All session slots for today have already passed. Please select tomorrow or an upcoming date.</span>
                </div>
              ) : (
                <select
                  id="session-hour"
                  className="select select-bordered w-full"
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  required
                >
                  {AVAILABLE_HOURS.map((h) => {
                    const isPast = isHourInPast(selectedDate, h);
                    return (
                      <option
                        key={h}
                        value={h}
                        disabled={isPast}
                        className={isPast ? "text-base-content/40 bg-base-200" : ""}
                      >
                        {formatHourLabel(h)} {isPast ? " (Past — unavailable)" : ""}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <div className="form-control">
              <label htmlFor="session-capacity" className="label">
                <span className="label-text font-semibold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  Capacity <span className="text-error">*</span>
                </span>
              </label>
              <input
                id="session-capacity"
                type="number"
                min="1"
                max="100"
                className="input input-bordered w-full bg-base-200"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                required
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <button
                type="submit"
                disabled={loading || allSlotsPassedToday || isHourInPast(selectedDate, startHour)}
                className="btn btn-primary flex-1"
              >
                {loading ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    Creating Session...
                  </>
                ) : (
                  "Create Session"
                )}
              </button>
              <Link href="/admin" className="btn btn-outline flex-1 sm:flex-none">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function CreateSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center py-20">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      }
    >
      <CreateSessionForm />
    </Suspense>
  );
}

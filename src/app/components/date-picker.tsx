"use client";

import React, { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { Calendar as CalendarIcon, X } from "lucide-react";

export interface DatePickerProps {
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  minDate?: Date;
  id?: string;
  size?: "sm" | "md" | "lg";
  clearable?: boolean;
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Pick a date",
  className = "",
  minDate,
  id,
  size = "md",
  clearable = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleDaySelect = (selectedDay: Date | undefined) => {
    onSelect(selectedDay);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(undefined);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: "input-sm text-xs h-8 px-2.5",
    md: "h-11 px-3.5 text-sm",
    lg: "input-lg text-base h-12 px-4",
  }[size];

  const isFullWidth = className.includes("w-full");

  const normalizedMinDate = minDate
    ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
    : undefined;

  return (
    <div
      ref={containerRef}
      className={`relative ${isFullWidth ? "w-full" : "inline-block"}`}
    >
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`input input-bordered flex items-center justify-between gap-2 text-left font-normal cursor-pointer select-none transition-colors ${sizeClasses} ${className} ${
          isOpen ? "border-primary ring-2 ring-primary/20" : ""
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
          <span
            suppressHydrationWarning
            className={date ? "text-base-content font-medium" : "text-base-content/60"}
          >
            {date
              ? date.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : placeholder}
          </span>
        </span>

        {clearable && date && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            className="hover:bg-base-300 p-0.5 rounded-full shrink-0 text-base-content/60 hover:text-base-content"
            title="Clear date"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Date Picker Calendar"
          className="absolute top-full left-0 mt-2 z-50 bg-base-100 text-base-content rounded-box shadow-2xl border border-base-200 p-3"
        >
          <DayPicker
            className="react-day-picker m-0"
            mode="single"
            selected={date}
            onSelect={handleDaySelect}
            disabled={normalizedMinDate ? { before: normalizedMinDate } : undefined}
          />
        </div>
      )}
    </div>
  );
}

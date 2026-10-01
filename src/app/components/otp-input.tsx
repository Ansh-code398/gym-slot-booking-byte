"use client";

import React, { useRef, useEffect } from "react";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  id?: string;
}

export function OtpInput({
  length = 6,
  value = "",
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  className = "",
  id = "otp-input",
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const chars = Array.from({ length }, (_, i) => value[i] || "");

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      const newChars = [...chars];

      if (newChars[index]) {
        newChars[index] = "";
        const newValue = newChars.join("").trimEnd();
        onChange(newValue);
      } else if (index > 0) {
        newChars[index - 1] = "";
        const newValue = newChars.join("").trimEnd();
        onChange(newValue);
        const prevInput = inputRefs.current[index - 1];
        if (prevInput) {
          prevInput.focus();
          prevInput.select();
        }
      }
    } else if (e.key === "Delete") {
      e.preventDefault();
      const newChars = [...chars];
      newChars[index] = "";
      onChange(newChars.join("").trimEnd());
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        inputRefs.current[index - 1]?.select();
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (index < length - 1) {
        inputRefs.current[index + 1]?.focus();
        inputRefs.current[index + 1]?.select();
      }
    } else if (e.key === "Enter") {
      if (value.length === length && onComplete) {
        e.preventDefault();
        onComplete(value);
      }
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const rawVal = e.target.value;
    const cleanChars = rawVal.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    if (!cleanChars) {
      const newChars = [...chars];
      newChars[index] = "";
      onChange(newChars.join("").trimEnd());
      return;
    }

    if (cleanChars.length > 1) {
      const pasted = cleanChars.slice(0, length);
      onChange(pasted);
      const nextIndex = Math.min(pasted.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      inputRefs.current[nextIndex]?.select();

      if (pasted.length === length && onComplete) {
        onComplete(pasted);
      }
      return;
    }

    const char = cleanChars;
    const newChars = [...chars];
    newChars[index] = char;

    const newValue = newChars.join("").trimEnd();
    onChange(newValue);

    if (index < length - 1) {
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }

    const nonSpaceCount = newChars.filter(Boolean).length;
    if (nonSpaceCount === length && onComplete) {
      onComplete(newChars.join(""));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.preventDefault();

    const pastedData = e.clipboardData
      .getData("text")
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, length);

    if (!pastedData) return;

    onChange(pastedData);

    const nextIndex = Math.min(pastedData.length, length - 1);
    const targetInput = inputRefs.current[nextIndex];
    if (targetInput) {
      targetInput.focus();
      targetInput.select();
    }

    if (pastedData.length === length && onComplete) {
      onComplete(pastedData);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  };

  return (
    <div
      role="group"
      aria-label="6-digit check-in code input"
      className={`inline-flex items-center gap-1.5 sm:gap-2.5 ${className}`}
    >
      {chars.map((char, index) => {
        const isMiddleBreak = index === 3;
        const isFilled = Boolean(char);

        return (
          <React.Fragment key={index}>
            {isMiddleBreak && (
              <div
                aria-hidden="true"
                className="text-base-content/30 font-bold select-none px-0.5 sm:px-1 text-lg"
              >
                –
              </div>
            )}
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              id={index === 0 ? id : `${id}-${index}`}
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={char}
              disabled={disabled}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onChange={(e) => handleChange(index, e)}
              onPaste={handlePaste}
              onFocus={handleFocus}
              aria-label={`Code character ${index + 1} of ${length}`}
              className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-mono font-bold uppercase rounded-lg border transition-all duration-150 outline-none select-all ${
                isFilled
                  ? "border-primary/60 bg-base-200/80 text-primary shadow-sm"
                  : "border-base-300 bg-base-200/40 text-base-content placeholder-base-content/20"
              } focus:border-primary focus:bg-base-100 focus:ring-2 focus:ring-primary/20 focus:shadow-md disabled:opacity-40 disabled:cursor-not-allowed`}
              placeholder="·"
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

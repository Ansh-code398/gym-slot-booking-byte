"use client";

import { useEffect, useRef } from "react";
import type { GymEvent } from "@/server/events";

interface useSessionsOptions {
  
  onSessionUpdate?: (event: GymEvent) => void;
  onRefresh?: () => void;
  enabled?: boolean;
}


export function useSessions({
  onSessionUpdate,
  onRefresh,
  enabled = true,
}: useSessionsOptions) {
  const onSessionUpdateRef = useRef(onSessionUpdate);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onSessionUpdateRef.current = onSessionUpdate;
    onRefreshRef.current = onRefresh;
  }, [onSessionUpdate, onRefresh]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let eventSource: EventSource | null = null;
    let isMounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const EVENT_TYPES = [
      "booking_created",
      "booking_cancelled",
      "check_in",
      "session_created",
      "session_updated",
      "waitlist_updated",
    ];

    function connect() {
      if (!isMounted) return;

      try {
        eventSource = new EventSource("/api/sessions/live");

        
        for (const type of EVENT_TYPES) {
          eventSource.addEventListener(type, (event: MessageEvent) => {
            try {
              const parsed: GymEvent = JSON.parse(event.data);
              onSessionUpdateRef.current?.(parsed);
              onRefreshRef.current?.();
            } catch (err) {
              console.warn("Failed to parse realtime event data:", err);
            }
          });
        }

        eventSource.onmessage = (event: MessageEvent) => {
          try {
            const parsed: GymEvent = JSON.parse(event.data);
            if (parsed && parsed.type) {
              onSessionUpdateRef.current?.(parsed);
              onRefreshRef.current?.();
            }
          } catch {
          }
        };

        eventSource.onerror = () => {
          
          if (eventSource?.readyState === EventSource.CLOSED && isMounted) {
            eventSource.close();
            eventSource = null;
            reconnectTimer = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.warn("Failed to initialize SSE connection:", err);
        if (isMounted) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        onRefreshRef.current?.();
      }
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onRefreshRef.current?.();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [enabled]);
}

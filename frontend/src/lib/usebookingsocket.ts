/**
 * useBookingSocket — real-time booking updates via WebSocket.
 *
 * Connects to  ws[s]://<same-host>/ws?channel=booking:{bookingId}
 * Vite dev-server proxies /ws → backend:3000 (ws:true in vite.config).
 * In production the same /ws path is served directly by the backend.
 *
 * Message types (from server):
 *   booking:accepted  { bookingId, technicianId, status }
 *   booking:status    { bookingId, status }
 *   tech:location     { lat, lng }
 *
 * Features:
 *   - Exponential-backoff reconnect (1 s → 2 s → … → 30 s cap)
 *   - Re-connects on window focus (catches missed events while tab was hidden)
 *   - Clean-up on unmount or bookingId change
 */

import { useEffect, useRef, useCallback } from "react";

type LocationPayload = { lat: number; lng: number };
type StatusPayload   = { bookingId: number; status: string };

interface Handlers {
  onStatus?:   (payload: StatusPayload) => void;
  onLocation?: (payload: LocationPayload) => void;
}

function wsBase(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // Use same host:port as the page — Vite proxy forwards /ws in dev,
  // and in production the backend serves /ws directly.
  return `${protocol}//${window.location.host}`;
}

export function useBookingSocket(bookingId: number | null, handlers: Handlers): void {
  const wsRef        = useRef<WebSocket | null>(null);
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay   = useRef(1000);
  const unmounted    = useRef(false);
  const handlersRef  = useRef(handlers);
  handlersRef.current = handlers; // always current without re-subscribing

  const connect = useCallback(() => {
    if (unmounted.current || !bookingId) return;

    const ws = new WebSocket(`${wsBase()}/ws?channel=booking:${bookingId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      retryDelay.current = 1000; // reset backoff on successful connect
    };

    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data as string);
        if (type === "booking:accepted" || type === "booking:status") {
          handlersRef.current.onStatus?.(payload);
        }
        if (type === "tech:location") {
          handlersRef.current.onLocation?.(payload);
        }
      } catch { /* malformed frame — ignore */ }
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      retryRef.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
        connect();
      }, retryDelay.current);
    };

    ws.onerror = () => ws.close(); // onclose will schedule reconnect
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    unmounted.current = false;
    connect();

    // Reconnect when the tab regains focus — catches events missed while hidden
    const onFocus = () => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        wsRef.current?.close();
        connect();
      }
    };
    window.addEventListener("focus", onFocus);

    return () => {
      unmounted.current = true;
      window.removeEventListener("focus", onFocus);
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [bookingId, connect]);
}
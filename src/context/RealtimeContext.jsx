import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const RealtimeContext = createContext(null);

// Audio synthesizer for subtle alert chime using Web Audio API (zero external assets needed)
function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Two-tone alert chime (880Hz -> 1174Hz)
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // AudioContext blocked or not supported
  }
}

export function RealtimeProvider({ children }) {
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connected' | 'connecting' | 'offline'
  const [transport, setTransport] = useState('none'); // 'websocket' | 'sse' | 'none'
  const [toasts, setToasts] = useState([]);
  const [browserNotificationPerm, setBrowserNotificationPerm] = useState(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied';
  });

  const listenersRef = useRef(new Map());
  const wsRef = useRef(null);
  const sseRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const navigate = useNavigate();

  // Register listener for specific event types (e.g. incident_created, incident_resolved)
  const subscribe = useCallback((eventType, callback) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType).add(callback);

    return () => {
      const set = listenersRef.current.get(eventType);
      if (set) {
        set.delete(callback);
      }
    };
  }, []);

  // Dispatch incoming event to all registered component subscribers
  const dispatchEvent = useCallback((type, data) => {
    const handlers = listenersRef.current.get(type);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(data);
        } catch (err) {
          console.error(`Error in realtime handler for ${type}:`, err);
        }
      });
    }
  }, []);

  // Dismiss a toast alert
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    try {
      const res = await Notification.requestPermission();
      setBrowserNotificationPerm(res);
      return res;
    } catch {
      return 'denied';
    }
  }, []);

  // Handle incoming incident event (from WebSocket or SSE)
  const handleIncomingIncidentEvent = useCallback((type, data) => {
    dispatchEvent(type, data);

    if (type === 'incident_created') {
      const inc = data;
      const isCriticalOrHigh = inc.severity === 'Critical' || inc.severity === 'High';

      // 1. In-App Toast
      const toastId = `toast-${inc.id}-${Date.now()}`;
      setToasts((prev) => [
        {
          id: toastId,
          type: 'new_incident',
          title: `New Incident Reported: ${inc.category}`,
          location: inc.fullLocation || inc.location || 'Indore Area',
          description: inc.description,
          severity: inc.severity || 'Medium',
          category: inc.category,
          incidentId: inc.id,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 3), // Keep max 4 toasts
      ]);

      // Play chime
      playAlertChime();

      // Auto dismiss after 8s
      setTimeout(() => {
        dismissToast(toastId);
      }, 8000);

      // 2. Browser Push Notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const notif = new Notification(`🚨 ITS Alert: ${inc.category}`, {
            body: `${inc.fullLocation || inc.location}\n${inc.description || 'Reported nearby. Drive cautiously.'}`,
            icon: '/vite.svg',
            tag: inc.id,
          });
          notif.onclick = () => {
            window.focus();
            navigate(`/app/incidents/${inc.id}`);
            notif.close();
          };
        } catch (err) {
          console.warn('Native notification failed:', err);
        }
      }
    } else if (type === 'incident_resolved') {
      const inc = data;
      const toastId = `toast-res-${inc.id}-${Date.now()}`;
      setToasts((prev) => [
        {
          id: toastId,
          type: 'resolved',
          title: `Incident ${inc.status || 'Resolved'}`,
          location: inc.fullLocation || inc.location || 'Indore Area',
          description: inc.actionTaken || inc.resolutionNotes || 'Official clearance confirmed.',
          severity: 'Resolved',
          category: inc.category,
          incidentId: inc.id,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 3),
      ]);
      setTimeout(() => dismissToast(toastId), 6000);
    }
  }, [dispatchEvent, dismissToast, navigate]);

  // Connect via WebSockets, with SSE fallback
  useEffect(() => {
    let isMounted = true;

    function connectSSE() {
      if (!isMounted) return;
      if (sseRef.current) {
        sseRef.current.close();
      }

      setTransport('sse');
      setConnectionStatus('connecting');

      const sse = new EventSource('/api/incidents/stream');
      sseRef.current = sse;

      sse.onopen = () => {
        if (!isMounted) return;
        setConnectionStatus('connected');
      };

      sse.addEventListener('incident_created', (e) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(e.data);
          handleIncomingIncidentEvent('incident_created', payload.data || payload);
        } catch (err) {
          console.error('Failed to parse SSE incident_created:', err);
        }
      });

      sse.addEventListener('incident_verified', (e) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(e.data);
          handleIncomingIncidentEvent('incident_verified', payload.data || payload);
        } catch (err) {
          console.error('Failed to parse SSE incident_verified:', err);
        }
      });

      sse.addEventListener('incident_resolved', (e) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(e.data);
          handleIncomingIncidentEvent('incident_resolved', payload.data || payload);
        } catch (err) {
          console.error('Failed to parse SSE incident_resolved:', err);
        }
      });

      sse.onerror = () => {
        if (!isMounted) return;
        setConnectionStatus('offline');
        sse.close();
        // Retry in 6 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 6000);
      };
    }

    function connectWebSocket() {
      if (!isMounted) return;
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }

      setConnectionStatus('connecting');
      setTransport('websocket');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/incidents`;

      let ws;
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
      } catch (err) {
        console.warn('WebSocket connection init failed, falling back to SSE:', err);
        connectSSE();
        return;
      }

      ws.onopen = () => {
        if (!isMounted) return;
        setConnectionStatus('connected');

        // Setup ping heartbeat every 20s
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'pong' || parsed.type === 'connected') return;
          handleIncomingIncidentEvent(parsed.type, parsed.data);
        } catch {
          // ignore non-json
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket error, will fall back to SSE if closed:', err);
      };

      ws.onclose = () => {
        if (!isMounted) return;
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        setConnectionStatus('connecting');
        // Try SSE fallback immediately
        connectSSE();
      };
    }

    connectWebSocket();

    return () => {
      isMounted = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [handleIncomingIncidentEvent]);

  return (
    <RealtimeContext.Provider
      value={{
        connectionStatus,
        transport,
        toasts,
        dismissToast,
        subscribe,
        browserNotificationPerm,
        requestNotificationPermission,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return ctx;
}

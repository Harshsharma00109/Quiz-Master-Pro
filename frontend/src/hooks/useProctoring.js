// PATH: quiz-platform/frontend/src/hooks/useProctoring.js
import { useState, useEffect, useRef, useCallback } from 'react';

const RAW_API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BASE    = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;

const MOTION_THRESHOLD = 8;
const MOTION_PCT_LIMIT = 35;
const FACE_MISS_LIMIT  = 6;  // 6 × 2s checks = 12s before face warning

export default function useProctoring() {
  const [isActive,           setIsActive]           = useState(false);
  const [sessionId,          setSessionId]          = useState(null);
  const [warningCount,       setWarningCount]       = useState(0);
  const [showWarningOverlay, setShowWarningOverlay] = useState(false);
  const [lastViolationType,  setLastViolationType]  = useState(null);
  const [cameraReady,        setCameraReady]        = useState(false);
  const [motionLevel,        setMotionLevel]        = useState(0);
  const [faceStatus,         setFaceStatus]         = useState('unknown');

  const videoRef         = useRef(null);
  const canvasRef        = useRef(null);
  const streamRef        = useRef(null);
  const sessionIdRef     = useRef(null);
  const warningCountRef  = useRef(0);
  const isActiveRef      = useRef(false);
  const prevFrameRef     = useRef(null);
  const faceMissRef      = useRef(0);
  const violationLockRef = useRef(false);
  const intervalRef      = useRef(null);
  const listenersRef     = useRef([]);

  useEffect(() => { sessionIdRef.current   = sessionId;    }, [sessionId]);
  useEffect(() => { warningCountRef.current = warningCount; }, [warningCount]);
  useEffect(() => { isActiveRef.current    = isActive;     }, [isActive]);

  const getToken = () => localStorage.getItem('qm_token') || '';

  // ── Snapshot ───────────────────────────────────────────────
  const captureSnapshot = useCallback(() => {
    try {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return null;
      const c = document.createElement('canvas');
      c.width  = Math.min(v.videoWidth,  320);
      c.height = Math.min(v.videoHeight, 240);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.55);
    } catch { return null; }
  }, []);

  // ── Report violation ───────────────────────────────────────
  const reportViolation = useCallback(async (type) => {
    if (!isActiveRef.current) return { auto_submit: false };
    if (violationLockRef.current) return { auto_submit: false };
    violationLockRef.current = true;
    setTimeout(() => { violationLockRef.current = false; }, 2500);

    const snapshot = captureSnapshot();
    setWarningCount(prev => { const n = prev + 1; warningCountRef.current = n; return n; });
    setLastViolationType(type);
    setShowWarningOverlay(true);

    const sid = sessionIdRef.current;
    if (sid && sid !== 'local') {
      try {
        const res = await fetch(`${BASE}/proctoring/violation`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
          body: JSON.stringify({ session_id: sid, type, snapshot_data: snapshot }),
        });
        return await res.json();
      } catch {}
    }
    return { auto_submit: warningCountRef.current >= 3 };
  }, [captureSnapshot]);

  // ── Start camera — waits for <video> element ───────────────
  const startCamera = useCallback(async () => {
    // Poll up to 1 second for the video element to be in the DOM
    // (CameraMonitor renders it after isActive becomes true)
    let waited = 0;
    while (!videoRef.current && waited < 1000) {
      await new Promise(r => setTimeout(r, 50));
      waited += 50;
    }

    const video = videoRef.current;
    if (!video) {
      console.error('[Proctoring] <video> element never mounted');
      setCameraReady(false);
      return;
    }

    // Stop any previous stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });

      streamRef.current = stream;
      video.srcObject   = stream;
      video.muted       = true;
      video.playsInline = true;

      // Wait for metadata + play
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('timeout')), 6000);
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          video.play().then(resolve).catch(reject);
        };
      });

      setCameraReady(true);
      console.log('[Proctoring] ✅ Camera ready');
    } catch (err) {
      console.error('[Proctoring] Camera failed:', err.name, '-', err.message);
      // Log friendly reason
      if (err.name === 'NotAllowedError')    console.warn('→ User denied camera permission. Allow it in browser settings.');
      if (err.name === 'NotFoundError')      console.warn('→ No camera device found.');
      if (err.name === 'NotReadableError')   console.warn('→ Camera is in use by another app.');
      setCameraReady(false);
    }
  }, []);

  // ── Stop camera ────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  // ── Frame analysis (motion + face) ────────────────────────
  const analyseFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !isActiveRef.current) return;

    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const canvas = canvasRef.current;
    const W = 160, H = 120;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, W, H);
    const { data: pixels } = ctx.getImageData(0, 0, W, H);

    // Motion
    let motionPx = 0;
    if (prevFrameRef.current) {
      const prev = prevFrameRef.current;
      for (let i = 0; i < pixels.length; i += 4) {
        if ((Math.abs(pixels[i]-prev[i]) + Math.abs(pixels[i+1]-prev[i+1]) + Math.abs(pixels[i+2]-prev[i+2])) / 3 > MOTION_THRESHOLD)
          motionPx++;
      }
    }
    const motionPct = Math.round((motionPx / (W * H)) * 100);
    setMotionLevel(motionPct);
    prevFrameRef.current = new Uint8ClampedArray(pixels);

    // Face (skin heuristic in centre)
    let skinCount = 0, total = 0;
    for (let y = Math.floor(H*0.05); y < Math.floor(H*0.65); y++) {
      for (let x = Math.floor(W*0.25); x < Math.floor(W*0.75); x++) {
        const i = (y * W + x) * 4;
        const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
        total++;
        if (r>55 && g>35 && b>15 && r>g && g>b && r-b>10 && r+g+b>100 && r<253) skinCount++;
      }
    }
    const faceOk = total > 0 && (skinCount / total) * 100 > 3.5;
    setFaceStatus(faceOk ? 'visible' : 'not_visible');
    if (faceOk) {
      faceMissRef.current = 0;
    } else {
      if (++faceMissRef.current >= FACE_MISS_LIMIT && isActiveRef.current) {
        faceMissRef.current = 0;
        reportViolation('face_not_visible');
      }
    }

    if (motionPct > MOTION_PCT_LIMIT && isActiveRef.current) {
      reportViolation('excessive_movement');
    }
  }, [reportViolation]);

  // ── Event listeners (tab, copy, etc.) ─────────────────────
  const setupListeners = useCallback(() => {
    listenersRef.current.forEach(({ el, evt, fn }) => el.removeEventListener(evt, fn));
    listenersRef.current = [];
    const add = (el, evt, fn) => { el.addEventListener(evt, fn); listenersRef.current.push({ el, evt, fn }); };

    add(document, 'visibilitychange', () => { if (document.hidden && isActiveRef.current) reportViolation('tab_switch'); });
    add(window,   'blur',             () => { if (isActiveRef.current) reportViolation('window_blur'); });
    add(document, 'copy',        e => { if (isActiveRef.current) { e.preventDefault(); reportViolation('copy_attempt'); } });
    add(document, 'cut',         e => { if (isActiveRef.current) { e.preventDefault(); reportViolation('copy_attempt'); } });
    add(document, 'paste',       e => { if (isActiveRef.current) { e.preventDefault(); reportViolation('copy_attempt'); } });
    add(document, 'contextmenu', e => { if (isActiveRef.current) { e.preventDefault(); reportViolation('right_click'); } });
    add(document, 'keydown', e => {
      if (!isActiveRef.current) return;
      if ((e.ctrlKey||e.metaKey) && ['c','v','u','s','a','p'].includes(e.key.toLowerCase())) { e.preventDefault(); reportViolation('copy_attempt'); }
      if (e.key === 'F12') { e.preventDefault(); reportViolation('right_click'); }
    });
  }, [reportViolation]);

  const removeListeners = useCallback(() => {
    listenersRef.current.forEach(({ el, evt, fn }) => el.removeEventListener(evt, fn));
    listenersRef.current = [];
  }, []);

  // ── START SESSION ──────────────────────────────────────────
  const startSession = useCallback(async (quizId) => {
    // Reset
    setWarningCount(0); setShowWarningOverlay(false);
    setLastViolationType(null); setFaceStatus('unknown'); setMotionLevel(0);
    warningCountRef.current = 0; violationLockRef.current = false;
    faceMissRef.current = 0; prevFrameRef.current = null;

    // ⚠️ KEY FIX: set isActive TRUE first so CameraMonitor renders <video>
    setIsActive(true);
    isActiveRef.current = true;

    // Give React 150ms to render the <video> element
    await new Promise(r => setTimeout(r, 150));

    // Now start camera (will find videoRef.current)
    await startCamera();

    // Event listeners
    setupListeners();

    // Frame analysis every 2s
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(analyseFrame, 2000);

    // Backend session (non-blocking)
    fetch(`${BASE}/proctoring/start`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ quiz_id: quizId || 0 }),
    })
      .then(r => r.json())
      .then(d => { setSessionId(d.session_id); sessionIdRef.current = d.session_id; })
      .catch(() => { setSessionId('local'); sessionIdRef.current = 'local'; });
  }, [startCamera, setupListeners, analyseFrame]);

  // ── END SESSION ────────────────────────────────────────────
  const endSession = useCallback(async (attemptId = null, autoSubmitted = false) => {
    isActiveRef.current = false;
    setIsActive(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    removeListeners();
    stopCamera();

    const sid = sessionIdRef.current;
    if (sid && sid !== 'local') {
      fetch(`${BASE}/proctoring/end`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ session_id: sid, auto_submitted: autoSubmitted }),
      }).catch(() => {});
    }
    setSessionId(null);
    sessionIdRef.current = null;
  }, [removeListeners, stopCamera]);

  const dismissWarning = useCallback(() => setShowWarningOverlay(false), []);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      removeListeners();
      stopCamera();
    };
  }, [removeListeners, stopCamera]);

  return {
    startSession, endSession, reportViolation,
    isActive, sessionId,
    warningCount, showWarningOverlay, lastViolationType,
    cameraReady, motionLevel, faceStatus,
    videoRef, dismissWarning,
  };
}
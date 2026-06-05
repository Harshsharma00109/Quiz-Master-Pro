// PATH: quiz-platform/frontend/src/components/CameraMonitor.js
// IMPORTANT: The <video> element is ALWAYS rendered (even when camera isn't ready)
// because useProctoring needs to find videoRef.current to attach the stream.
// We just hide/show it based on state.

import React, { useState } from 'react';

export default function CameraMonitor({
  videoRef,
  cameraReady   = false,
  motionLevel   = 0,
  faceStatus    = 'unknown',
  warningCount  = 0,
  isActive      = false,
}) {
  const [minimised, setMinimised] = useState(false);

  const faceColor = faceStatus === 'visible'    ? '#22c55e' : faceStatus === 'not_visible' ? '#ef4444' : '#f97316';
  const faceLabel = faceStatus === 'visible'    ? '✅ Face OK' : faceStatus === 'not_visible' ? '❌ No face' : '👁 Starting…';
  const motionColor = motionLevel > 35 ? '#ef4444' : motionLevel > 15 ? '#f97316' : '#22c55e';
  const warnColor   = warningCount === 0 ? '#22c55e' : warningCount === 1 ? '#f97316' : '#ef4444';

  return (
    <div style={{
      position:     'fixed',
      bottom:       16,
      right:        16,
      zIndex:       9000,
      width:        minimised ? 'auto' : 200,
      background:   'rgba(10,10,20,.94)',
      border:       `1px solid ${warningCount > 0 ? 'rgba(249,115,22,.5)' : 'rgba(255,255,255,.12)'}`,
      borderRadius: 12,
      overflow:     'hidden',
      backdropFilter: 'blur(10px)',
      boxShadow:    '0 4px 28px rgba(0,0,0,.5)',
      transition:   'width .2s',
      // Always render even if not active — <video> must be in DOM for ref
      display:      'block',
    }}>
      {/* Header */}
      <div
        onClick={() => setMinimised(m => !m)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', cursor: 'pointer',
          background: 'rgba(255,255,255,.04)',
          borderBottom: minimised ? 'none' : '1px solid rgba(255,255,255,.07)',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {/* Status dot */}
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
            background: !isActive ? '#6b7280' : cameraReady ? '#22c55e' : '#ef4444',
            boxShadow:  cameraReady ? '0 0 4px #22c55e' : 'none',
          }} />
          <span style={{ fontSize: '.68rem', fontWeight: 600, color: 'rgba(200,200,220,.75)', fontFamily: 'DM Sans,sans-serif' }}>
            {!isActive ? 'Standby' : cameraReady ? 'Proctored' : 'No camera'}
          </span>
          {warningCount > 0 && (
            <span style={{ fontSize: '.62rem', fontWeight: 800, color: warnColor, marginLeft: 2 }}>⚠{warningCount}</span>
          )}
        </div>
        <span style={{ fontSize: '.6rem', color: 'rgba(200,200,220,.3)' }}>{minimised ? '▲' : '▼'}</span>
      </div>

      {/* Body — hidden when minimised, but <video> still in DOM */}
      <div style={{ display: minimised ? 'none' : 'block' }}>

        {/* Video container — ALWAYS rendered so videoRef works */}
        <div style={{ position: 'relative', background: '#000', lineHeight: 0 }}>
          {/* ⚠️ This <video> element must always exist in DOM */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width:       '100%',
              display:     'block',
              aspectRatio: '4/3',
              objectFit:   'cover',
              transform:   'scaleX(-1)',  // mirror like selfie cam
              opacity:     cameraReady ? 1 : 0.15,
              transition:  'opacity .3s',
            }}
          />

          {/* Overlay when camera not ready */}
          {!cameraReady && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: 8,
            }}>
              <span style={{ fontSize: '1.4rem' }}>📷</span>
              <span style={{ fontSize: '.62rem', color: 'rgba(200,200,220,.55)', textAlign: 'center', lineHeight: 1.4 }}>
                {isActive ? 'Allow camera\nin browser' : 'Camera inactive'}
              </span>
            </div>
          )}

          {/* Face status badge */}
          {cameraReady && (
            <div style={{
              position: 'absolute', bottom: 4, left: 4,
              fontSize: '.55rem', fontWeight: 600, color: '#fff',
              background: `${faceColor}dd`, padding: '2px 6px', borderRadius: 99,
            }}>
              {faceLabel}
            </div>
          )}
        </div>

        {/* Camera blocked help message */}
        {isActive && !cameraReady && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
            <div style={{ fontSize: '.6rem', color: '#f97316', fontWeight: 600, marginBottom: 3 }}>
              ⚠️ Camera blocked
            </div>
            <div style={{ fontSize: '.58rem', color: 'rgba(200,200,220,.5)', lineHeight: 1.5 }}>
              Click the 🔒 icon in your browser address bar and allow camera access, then refresh.
            </div>
          </div>
        )}

        {/* Stats (only when camera is working) */}
        {cameraReady && (
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {/* Motion bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: '.58rem', color: 'rgba(200,200,220,.4)' }}>Motion</span>
                <span style={{ fontSize: '.58rem', color: motionColor, fontWeight: 600 }}>{motionLevel}%</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(motionLevel, 100)}%`, background: motionColor, borderRadius: 99, transition: 'width .5s, background .3s' }} />
              </div>
            </div>

            {/* Warning squares */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '.58rem', color: 'rgba(200,200,220,.4)' }}>Warnings</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{
                    width: 10, height: 10, borderRadius: 2,
                    background: warningCount >= n
                      ? (n === 3 ? '#ef4444' : n === 2 ? '#f97316' : '#f59e0b')
                      : 'rgba(255,255,255,.08)',
                    transition: 'background .3s',
                  }} />
                ))}
              </div>
            </div>

            <div style={{ fontSize: '.55rem', color: 'rgba(200,200,220,.28)', textAlign: 'center' }}>
              3 violations → auto-submit
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
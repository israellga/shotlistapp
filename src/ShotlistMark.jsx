import React, { useRef, useEffect } from "react";

// Same geometry as the favicon, scaled to a 0–100 viewBox.
const CORNERS = [
  "M25,40.6 L25,25 L40.6,25",
  "M59.4,25 L75,25 L75,40.6",
  "M75,59.4 L75,75 L59.4,75",
  "M40.6,75 L25,75 L25,59.4",
];
const DOT = { cx: 50, cy: 50, r: 10.9 };
const STROKE_WIDTH = 7;

let seq = 0;

export default function ShotlistMark({ size = 32, interactive = false, lit = true, amber = "#FDDF4B", dim = "#1B1B1B", style, glowOpacity = 0.55, glowRadius = 40 }) {
  const gradRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const idleRef = useRef(true);
  const idleTimer = useRef(null);
  const gidRef = useRef(null);
  if (!gidRef.current) gidRef.current = `shotlist-spot-${seq++}`;
  const gid = gidRef.current;

  useEffect(() => {
    if (!interactive) return undefined;
    let t = Math.random() * 10;
    function ambientLoop() {
      if (idleRef.current && gradRef.current) {
        t += 0.0045;
        const cx = 50 + Math.sin(t) * 24;
        const cy = 50 + Math.cos(t * 0.75) * 22;
        gradRef.current.setAttribute("cx", cx.toFixed(2));
        gradRef.current.setAttribute("cy", cy.toFixed(2));
      }
      rafRef.current = requestAnimationFrame(ambientLoop);
    }
    rafRef.current = requestAnimationFrame(ambientLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [interactive]);

  function handlePointerMove(e) {
    if (!interactive || !containerRef.current || !gradRef.current) return;
    idleRef.current = false;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    gradRef.current.setAttribute("cx", x.toFixed(2));
    gradRef.current.setAttribute("cy", y.toFixed(2));
    idleTimer.current = setTimeout(() => { idleRef.current = true; }, 2400);
  }

  const paint = interactive ? `url(#${gid})` : lit ? amber : "none";

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      onPointerMove={handlePointerMove}
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      {interactive && (
        <defs>
          <radialGradient ref={gradRef} id={gid} gradientUnits="userSpaceOnUse" cx="50" cy="50" r={glowRadius}>
            <stop offset="0%" stopColor={amber} stopOpacity={glowOpacity} />
            <stop offset="55%" stopColor={amber} stopOpacity={glowOpacity * 0.5} />
            <stop offset="100%" stopColor={amber} stopOpacity="0" />
          </radialGradient>
        </defs>
      )}
      <g stroke={dim} strokeWidth={STROKE_WIDTH} strokeLinecap="round" fill="none">
        {CORNERS.map((d, i) => <path key={i} d={d} />)}
      </g>
      <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill={dim} />

      <g stroke={paint} strokeWidth={STROKE_WIDTH} strokeLinecap="round" fill="none">
        {CORNERS.map((d, i) => <path key={i} d={d} />)}
      </g>
      <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill={paint} />
    </svg>
  );
}

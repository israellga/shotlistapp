import React, { useRef, useEffect } from "react";

// Traced from the user's logo mark.
export const BOLT_PATH = "M 65.83,4.11 L 8.33,56.65 L 40.83,57.59 L 25.00,92.09 L 85.83,41.77 L 46.67,40.51 Z";

let seq = 0;

export default function BoltMark({ size = 32, interactive = false, lit = true, amber = "#E2A33D", dim = "#2C2E32" }) {
  const gradRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const idleRef = useRef(true);
  const idleTimer = useRef(null);
  const gidRef = useRef(null);
  if (!gidRef.current) gidRef.current = `bolt-spot-${seq++}`;
  const gid = gidRef.current;

  useEffect(() => {
    if (!interactive) return undefined;
    let t = Math.random() * 10;
    function ambientLoop() {
      if (idleRef.current && gradRef.current) {
        t += 0.0045;
        const cx = 50 + Math.sin(t) * 24;
        const cy = 46 + Math.cos(t * 0.75) * 22;
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

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      onPointerMove={handlePointerMove}
      style={{ display: "block", flexShrink: 0 }}
    >
      {interactive && (
        <defs>
          <radialGradient ref={gradRef} id={gid} gradientUnits="userSpaceOnUse" cx="50" cy="42" r="42">
            <stop offset="0%" stopColor={amber} stopOpacity="1" />
            <stop offset="45%" stopColor={amber} stopOpacity="0.75" />
            <stop offset="100%" stopColor={amber} stopOpacity="0" />
          </radialGradient>
        </defs>
      )}
      <path d={BOLT_PATH} fill={dim} />
      <path d={BOLT_PATH} fill={interactive ? `url(#${gid})` : lit ? amber : "none"} />
    </svg>
  );
}

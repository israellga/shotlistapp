// Shotlist logo: a dark glass app icon. Stacked frosted shot cards, the front one carries the amber
// viewfinder (four corners + dot). One source of truth for the favicon, app icons and the in-app logo.
// opts: id (unique gradient prefix), bleed (full-bleed background for maskable/iOS icons), content (scale of the artwork)
export function buildLogoSvg({ id = "sl", bleed = false, content = 1, small = false } = {}) {
  const k = (s) => `${id}-${s}`;
  const bg = bleed
    ? `<rect width="1024" height="1024" fill="url(#${k("bg")})"/>`
    : `<rect x="8" y="8" width="1008" height="1008" rx="232" fill="url(#${k("bg")})"/>
       <rect x="9.5" y="9.5" width="1005" height="1005" rx="230.5" fill="none" stroke="url(#${k("rim")})" stroke-width="3"/>`;
  if (small) content = content * 1.32;
  const t = content === 1 ? "" : ` transform="translate(512 512) scale(${content}) translate(-512 -512)"`;
  // viewfinder geometry on the front card (centre 462,560)
  const cx = 462, cy = 560, d = 118, l = 62;
  const corners = [
    `M${cx - d},${cy - d + l} L${cx - d},${cy - d} L${cx - d + l},${cy - d}`,
    `M${cx + d - l},${cy - d} L${cx + d},${cy - d} L${cx + d},${cy - d + l}`,
    `M${cx + d},${cy + d - l} L${cx + d},${cy + d} L${cx + d - l},${cy + d}`,
    `M${cx - d + l},${cy + d} L${cx - d},${cy + d} L${cx - d},${cy + d - l}`,
  ];
  const blur = small ? "" : `filter="url(#${k("blur")})"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
<defs>
  <radialGradient id="${k("bg")}" cx="30%" cy="18%" r="95%"><stop offset="0" stop-color="#2b2b2e"/><stop offset="0.55" stop-color="#0d0d0e"/><stop offset="1" stop-color="#000"/></radialGradient>
  <linearGradient id="${k("rim")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#fff" stop-opacity="0.22"/></linearGradient>
  <linearGradient id="${k("g1")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.30"/><stop offset="1" stop-color="#fff" stop-opacity="0.05"/></linearGradient>
  <linearGradient id="${k("g2")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.48"/><stop offset="1" stop-color="#fff" stop-opacity="0.08"/></linearGradient>
  <linearGradient id="${k("g3")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.42"/><stop offset="0.55" stop-color="#cfcfd4" stop-opacity="0.10"/><stop offset="1" stop-color="#fff" stop-opacity="0.04"/></linearGradient>
  <linearGradient id="${k("edge")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.8" stop-color="#FDDF4B" stop-opacity="0.35"/><stop offset="1" stop-color="#FDDF4B" stop-opacity="0.95"/></linearGradient>
  <filter id="${k("blur")}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="48"/></filter>
  <filter id="${k("soft")}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  <clipPath id="${k("clip")}"><rect x="272" y="310" width="380" height="500" rx="76"/></clipPath>
</defs>
${bg}
<g${t}>
  ${small ? "" : `<rect x="372" y="214" width="380" height="500" rx="76" fill="url(#${k("g1")})" stroke="#fff" stroke-opacity="0.34" stroke-width="3"/>
  <rect x="322" y="262" width="380" height="500" rx="76" fill="url(#${k("g2")})" stroke="#fff" stroke-opacity="0.5" stroke-width="3"/>`}
  <rect x="272" y="310" width="380" height="500" rx="76" fill="#0e0e0f" fill-opacity="0.55"/>
  <rect x="272" y="310" width="380" height="500" rx="76" fill="url(#${k("g3")})"/>
  <g clip-path="url(#${k("clip")})">
    <ellipse cx="650" cy="790" rx="120" ry="100" fill="#FDDF4B" fill-opacity="0.62" ${blur}/>
    <path d="M250 420 L420 300 L520 300 L300 520 Z" fill="#fff" fill-opacity="0.34" filter="url(#${k("soft")})"/>
  </g>
  <rect x="273.5" y="311.5" width="377" height="497" rx="74.5" fill="none" stroke="url(#${k("edge")})" stroke-width="5"/>
  <g stroke="#FDDF4B" stroke-width="${small ? 32 : 24}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${corners.map((p) => `<path d="${p}"/>`).join("\n    ")}
  </g>
  <circle cx="${cx}" cy="${cy}" r="34" fill="#FDDF4B"/>
</g>
</svg>`;
}

// Favicon: versão simplificada pra aba do navegador (16–48px). Ícone centralizado, sem blur, traços grossos.
export function buildFaviconSvg({ id = "fv" } = {}) {
  const c = 512, d = 190, l = 100;
  const p = [
    `M${c - d},${c - d + l} L${c - d},${c - d} L${c - d + l},${c - d}`,
    `M${c + d - l},${c - d} L${c + d},${c - d} L${c + d},${c - d + l}`,
    `M${c + d},${c + d - l} L${c + d},${c + d} L${c + d - l},${c + d}`,
    `M${c - d + l},${c + d} L${c - d},${c + d} L${c - d},${c + d - l}`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="64" height="64">
<defs>
  <radialGradient id="${id}-bg" cx="28%" cy="18%" r="100%"><stop offset="0" stop-color="#34343a"/><stop offset="0.6" stop-color="#121214"/><stop offset="1" stop-color="#050505"/></radialGradient>
  <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.7"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.1"/><stop offset="1" stop-color="#FDDF4B" stop-opacity="0.8"/></linearGradient>
</defs>
<rect x="24" y="24" width="976" height="976" rx="230" fill="url(#${id}-bg)"/>
<rect x="30" y="30" width="964" height="964" rx="224" fill="none" stroke="url(#${id}-rim)" stroke-width="20"/>
<g stroke="#FDDF4B" stroke-width="76" stroke-linecap="round" stroke-linejoin="round" fill="none">${p.map((x) => `<path d="${x}"/>`).join("")}</g>
<circle cx="${c}" cy="${c}" r="78" fill="#FDDF4B"/>
</svg>`;
}

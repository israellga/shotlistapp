import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Field } from "./ui";
import { C, FONT_BODY } from "./theme";

const GKEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

// Sugestões: Google Places (se houver chave) ou Photon/OpenStreetMap (grátis) como alternativa.
async function suggest(q, signal) {
  if (GKEY) {
    const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST", signal,
      headers: { "content-type": "application/json", "X-Goog-Api-Key": GKEY },
      body: JSON.stringify({ input: q, languageCode: "pt-BR", regionCode: "BR" }),
    });
    const j = await r.json();
    return (j.suggestions || []).map((s) => s.placePrediction?.text?.text).filter(Boolean);
  }
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=default&lat=-23.55&lon=-46.63`, { signal });
  const j = await r.json();
  return (j.features || []).map((f) => {
    const p = f.properties || {};
    const street = [p.street || p.name, p.housenumber].filter(Boolean).join(", ");
    return [street, p.district || p.suburb, p.city || p.county, p.state].filter(Boolean).join(" - ");
  }).filter((v, i, a) => v && a.indexOf(v) === i);
}

export default function AddressField({ label, value, onChange, placeholder, recent = [] }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const typed = useRef(false);
  const q = (value || "").trim().toLowerCase();
  const locais = recent.filter((r) => r.toLowerCase() !== q && (!q || r.toLowerCase().includes(q))).slice(0, 4);
  const box = useRef(null);

  useEffect(() => {
    if (!typed.current || (value || "").trim().length < 4) { setItems([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try { const list = await suggest(value.trim(), ctrl.signal); setItems(list); setOpen(list.length > 0); } catch { /* offline ou bloqueado */ }
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value]);

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div ref={box} style={{ position: "relative" }}>
      <div onFocus={() => { if (!(value || "").trim() && recent.length) setOpen(true); }}>
        <Field label={label} value={value} placeholder={placeholder} onChange={(v) => { typed.current = true; onChange(v); }} />
      </div>
      {open && (items.length > 0 || locais.length > 0) && (
        <div className="glass-blur" style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 30, borderRadius: 14, overflow: "hidden", background: "rgba(28,28,30,0.96)", border: `1px solid ${C.line}`, boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
          {[...locais.map((t) => ({ t, saved: true })), ...items.filter((t) => !locais.includes(t)).map((t) => ({ t }))].map(({ t: it, saved }) => (
            <button key={it} type="button" onClick={() => { typed.current = false; onChange(it); setOpen(false); setItems([]); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 46, padding: "8px 14px", background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`, color: C.paper, fontFamily: FONT_BODY, fontSize: 13.5, textAlign: "left", cursor: "pointer" }}>
              <MapPin size={15} color={saved ? C.amber : C.faint} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>{it}</span>
              {saved && <span style={{ fontSize: 11, color: C.faint }}>usado antes</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

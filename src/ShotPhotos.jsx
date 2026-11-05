import React, { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_BODY } from "./theme";

function resizeToJpeg(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Imagem inválida."))), "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não consegui ler essa foto.")); };
    img.src = url;
  });
}

// Photos taken on set for a shot (stored in Supabase Storage, listed in the shot).
export default function ShotPhotos({ shot, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fotos = shot.fotos || [];

  async function pick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true); setError("");
    try {
      const added = [];
      for (const f of files.slice(0, 6)) {
        const blob = await resizeToJpeg(f);
        const path = `shots/${shot.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: err } = await supabase.storage.from("take-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (err) throw new Error(navigator.onLine ? "Não consegui enviar a foto." : "Sem conexão. Tente de novo com internet.");
        const { data } = supabase.storage.from("take-photos").getPublicUrl(path);
        added.push({ path, url: data.publicUrl, at: new Date().toISOString() });
      }
      onChange({ ...shot, fotos: [...fotos, ...added] });
    } catch (e2) { setError(e2.message || "Falha ao enviar."); }
    setBusy(false);
  }

  async function remove(f) {
    onChange({ ...shot, fotos: fotos.filter((x) => x.path !== f.path) });
    try { await supabase.storage.from("take-photos").remove([f.path]); } catch { /* ignore */ }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, color: C.faint, marginBottom: 8 }}>Fotos do set · {fotos.length}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {fotos.map((f) => (
          <div key={f.path} style={{ position: "relative" }}>
            <a href={f.url} target="_blank" rel="noreferrer">
              <img src={f.url} alt="" loading="lazy" style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 12, border: `1px solid ${C.line}`, display: "block" }} />
            </a>
            <button onClick={() => remove(f)} title="Remover foto" style={{ position: "absolute", top: -8, right: -8, width: 28, height: 28, borderRadius: 14, background: "#222", border: `1px solid ${C.line}`, color: C.paper, display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
              <X size={13} />
            </button>
          </div>
        ))}
        <button onClick={() => input.current?.click()} disabled={busy} style={{ width: 76, height: 76, borderRadius: 12, background: "transparent", border: `1px dashed ${C.line}`, color: C.muted, display: "grid", placeItems: "center", cursor: "pointer", fontFamily: FONT_BODY }}>
          {busy ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={22} />}
        </button>
        <input ref={input} type="file" accept="image/*" capture="environment" multiple onChange={pick} style={{ display: "none" }} />
      </div>
      {error && <div style={{ color: C.brick, fontSize: 12.5, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

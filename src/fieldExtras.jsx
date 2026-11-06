import React, { useEffect, useRef, useState } from "react";
import { Play, Square, Clock, ImagePlus, Loader2, X, Heart, Images } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_MONO, FONT_BODY } from "./theme";
import { resizeToJpeg } from "./ShotPhotos";

const uid = () => Math.random().toString(36).slice(2, 9);
const hm = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
const fmtDur = (min) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;

// Horário real da captação: iniciar/finalizar, comparar com o planejado e sugerir hora extra.
export function LiveTracker({ production, onChange }) {
  const real = production.real || {};
  const [, tick] = useState(0);
  useEffect(() => { if (real.inicio && !real.fim) { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); } }, [real.inicio, real.fim]);
  const set = (patch) => onChange({ ...production, real: { ...real, ...patch } });
  const fimRef = real.fim ? new Date(real.fim) : new Date();
  const dur = real.inicio ? Math.max(0, Math.round((fimRef - new Date(real.inicio)) / 60000)) : 0;
  const ini = toMin(production.horaInicio), fim = toMin(production.horaFim);
  const plan = ini != null && fim != null && fim > ini ? fim - ini : null;
  const extra = plan != null && real.fim ? dur - plan : null;
  return (
    <div className="glass" style={{ borderRadius: 16, padding: "12px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <Clock size={18} color={C.amber} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontSize: 14, color: C.paper, fontWeight: 600 }}>
          {!real.inicio ? "Captação não iniciada" : real.fim ? `Captação: ${hm(real.inicio)} às ${hm(real.fim)} (${fmtDur(dur)})` : `Em andamento desde ${hm(real.inicio)} · ${fmtDur(dur)}`}
        </div>
        {plan != null && <div style={{ fontSize: 12.5, color: C.muted }}>Previsto: {production.horaInicio} às {production.horaFim} ({fmtDur(plan)})</div>}
        {extra != null && extra > 15 && <div style={{ fontSize: 12.5, color: C.amber, marginTop: 2 }}>Passou {fmtDur(extra)} do combinado. Vale cobrar hora extra.</div>}
      </div>
      {!real.inicio && (
        <button onClick={() => set({ inicio: new Date().toISOString(), fim: null })} className="btn-glass-primary" style={btn}><Play size={15} /> Iniciar</button>
      )}
      {real.inicio && !real.fim && (
        <button onClick={() => set({ fim: new Date().toISOString() })} style={{ ...btn, background: "transparent", border: `1px solid ${C.amber}`, color: C.amber }}><Square size={14} /> Finalizar</button>
      )}
      {real.fim && <button onClick={() => onChange({ ...production, real: {} })} style={{ ...btn, background: "transparent", border: `1px solid ${C.line}`, color: C.muted, fontWeight: 500 }}>Zerar</button>}
    </div>
  );
}
const btn = { minHeight: 44, padding: "0 18px", borderRadius: 22, border: "none", fontFamily: FONT_BODY, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };

async function uploadImages(files, folder, max = 1600) {
  const out = [];
  for (const f of files) {
    const blob = await resizeToJpeg(f, max);
    const path = `${folder}/${Date.now()}-${uid()}.jpg`;
    const { error } = await supabase.storage.from("take-photos").upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw new Error(navigator.onLine ? "Não consegui enviar a imagem." : "Sem conexão.");
    out.push({ id: uid(), path, url: supabase.storage.from("take-photos").getPublicUrl(path).data.publicUrl });
  }
  return out;
}

function Thumbs({ items, onRemove, size = 76, children }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {items.map((f) => (
        <div key={f.id || f.path} style={{ position: "relative" }}>
          <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt="" loading="lazy" style={{ width: size, height: size, objectFit: "cover", borderRadius: 12, border: `1px solid ${C.line}`, display: "block" }} /></a>
          {onRemove && <button onClick={() => onRemove(f)} title="Remover" style={{ position: "absolute", top: -8, right: -8, width: 28, height: 28, borderRadius: 14, background: "#222", border: `1px solid ${C.line}`, color: C.paper, display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}><X size={13} /></button>}
        </div>
      ))}
      {children}
    </div>
  );
}

function AddBtn({ busy, onFiles, size = 76 }) {
  const ref = useRef(null);
  return (
    <>
      <button onClick={() => ref.current?.click()} disabled={busy} style={{ width: size, height: size, borderRadius: 12, background: "transparent", border: `1px dashed ${C.line}`, color: C.muted, display: "grid", placeItems: "center", cursor: "pointer" }}>
        {busy ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : <ImagePlus size={22} />}
      </button>
      <input ref={ref} type="file" accept="image/*" multiple onChange={(e) => { const fl = Array.from(e.target.files || []); e.target.value = ""; if (fl.length) onFiles(fl); }} style={{ display: "none" }} />
    </>
  );
}

// Imagens de referência (moodboard) de um shot, visíveis também no modo campo.
export function RefImages({ shot, onChange, fieldMode }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const list = shot.refImagens || [];
  if (fieldMode && !list.length) return null;
  async function add(files) {
    setBusy(true); setErr("");
    try { const up = await uploadImages(files.slice(0, 6), `refs/${shot.id}`, 1400); onChange({ ...shot, refImagens: [...list, ...up] }); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }
  async function remove(f) {
    onChange({ ...shot, refImagens: list.filter((x) => x.id !== f.id) });
    try { await supabase.storage.from("take-photos").remove([f.path]); } catch { /* ignore */ }
  }
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.faint, letterSpacing: 0.5, marginBottom: 8 }}>REFERÊNCIAS VISUAIS · {list.length}</div>
      <Thumbs items={list} onRemove={fieldMode ? null : remove} size={fieldMode ? 96 : 76}>
        {!fieldMode && <AddBtn busy={busy} onFiles={add} />}
      </Thumbs>
      {err && <div style={{ color: C.brick, fontSize: 12.5, marginTop: 6 }}>{err}</div>}
    </div>
  );
}

// Galeria de seleção (gestor): sobe as fotos e vê quais o cliente favoritou.
export function GaleriaSection({ production, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [favs, setFavs] = useState(new Set());
  const list = production.galeria || [];
  useEffect(() => {
    if (!production.clientShareEnabled || production.__shared) return;
    let alive = true;
    async function load() {
      const { data } = await supabase.from("client_feedback").select("message").eq("production_id", production.id).eq("kind", "favorite");
      if (alive && Array.isArray(data)) setFavs(new Set(data.map((d) => d.message)));
    }
    load();
    const ch = supabase.channel(`galeria:${production.id}`).on("postgres_changes", { event: "*", schema: "public", table: "client_feedback", filter: `production_id=eq.${production.id}` }, load).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [production.id, production.clientShareEnabled]);
  async function add(files) {
    setBusy(true); setErr("");
    try { const up = await uploadImages(files.slice(0, 20), `galeria/${production.id}`, 1600); onChange({ ...production, galeria: [...list, ...up] }); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }
  async function remove(f) {
    onChange({ ...production, galeria: list.filter((x) => x.id !== f.id) });
    try { await supabase.storage.from("take-photos").remove([f.path]); } catch { /* ignore */ }
  }
  return (
    <div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
        Suba as fotos para o cliente escolher as favoritas pelo link dele (o compartilhamento precisa estar ligado). Use versões leves: elas são reduzidas para 1600px.
      </div>
      {production.clientShareEnabled && list.length > 0 && (
        <div style={{ fontSize: 13, color: C.amber, marginBottom: 10, fontWeight: 600 }}>
          <Heart size={13} style={{ verticalAlign: -2 }} /> {list.filter((f) => favs.has(f.id)).length} favorita(s) de {list.length}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {list.map((f) => (
          <div key={f.id} style={{ position: "relative" }}>
            <img src={f.url} alt="" loading="lazy" style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 12, border: `2px solid ${favs.has(f.id) ? C.amber : C.line}`, display: "block" }} />
            {favs.has(f.id) && <Heart size={14} fill={C.amber} color={C.amber} style={{ position: "absolute", left: 5, bottom: 5 }} />}
            <button onClick={() => remove(f)} title="Remover" style={{ position: "absolute", top: -8, right: -8, width: 28, height: 28, borderRadius: 14, background: "#222", border: `1px solid ${C.line}`, color: C.paper, display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}><X size={13} /></button>
          </div>
        ))}
        <AddBtn busy={busy} onFiles={add} />
      </div>
      {err && <div style={{ color: C.brick, fontSize: 12.5, marginTop: 6 }}>{err}</div>}
    </div>
  );
}

// Galeria de seleção (cliente): marca e desmarca favoritas.
export function ClientGaleria({ galeria, feedback, onSend }) {
  const favs = new Set((feedback || []).filter((f) => f.kind === "favorite").map((f) => f.message));
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!galeria || !galeria.length) return null;
  async function toggle(f) {
    setBusy(true);
    await onSend({ shot: null, kind: favs.has(f.id) ? "unfavorite" : "favorite", author: "", message: f.id });
    setBusy(false);
  }
  const cur = open != null ? galeria[open] : null;
  return (
    <div className="glass" style={{ borderRadius: 18, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Images size={16} color={C.amber} />
        <span style={{ fontSize: 15, fontWeight: 600, color: C.paper, flex: 1 }}>Escolha suas fotos favoritas</span>
        <span style={{ fontSize: 12.5, color: C.amber, fontWeight: 600 }}>{favs.size} escolhida{favs.size === 1 ? "" : "s"}</span>
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Toque no coração das que você mais gostou. Eu recebo a seleção na hora.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {galeria.map((f, i) => (
          <div key={f.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden" }}>
            <img src={f.url} alt="" loading="lazy" onClick={() => setOpen(i)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "pointer" }} />
            <button onClick={() => toggle(f)} disabled={busy} aria-label="Favoritar" style={{ position: "absolute", right: 4, bottom: 4, width: 38, height: 38, borderRadius: 19, border: "none", background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", cursor: "pointer" }}>
              <Heart size={18} color={favs.has(f.id) ? C.amber : "#fff"} fill={favs.has(f.id) ? C.amber : "none"} />
            </button>
          </div>
        ))}
      </div>
      {cur && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.92)", display: "grid", placeItems: "center", padding: 12 }}>
          <img src={cur.url} alt="" style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }} />
          <div style={{ position: "absolute", bottom: "max(24px, env(safe-area-inset-bottom))", display: "flex", gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen((open + galeria.length - 1) % galeria.length)} style={nav}>‹</button>
            <button onClick={() => toggle(cur)} disabled={busy} style={{ ...nav, width: 64 }}><Heart size={22} color={favs.has(cur.id) ? C.amber : "#fff"} fill={favs.has(cur.id) ? C.amber : "none"} /></button>
            <button onClick={() => setOpen((open + 1) % galeria.length)} style={nav}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}
const nav = { width: 52, height: 52, borderRadius: 26, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 26, cursor: "pointer", display: "grid", placeItems: "center" };

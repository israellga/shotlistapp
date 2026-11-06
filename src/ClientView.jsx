import React, { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, AlertCircle, ExternalLink, RefreshCw, CheckCircle2, PlayCircle, Circle, MessageSquare, Send, ThumbsUp } from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import ShotlistMark from "./ShotlistMark";
import ShotlistLogo from "./ShotlistLogo";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";
import { formatIntervaloDatas } from "./datetime";

const STATUS = {
  afazer: { label: "A fazer", color: C.muted, bg: "transparent", border: C.line },
  andamento: { label: "Em andamento", color: C.amber, bg: C.amberDim, border: C.amber },
  concluido: { label: "Concluído", color: C.sage, bg: C.sageDim, border: C.sage },
};

const SAFETY_POLL_MS = 60000;

import { getEmbedUrl } from "./referenceLinks";

function isInstagramUrl(url) {
  return /instagram\.com\/(p|reel|reels|tv)\//i.test(url || "");
}

function isDirectVideoUrl(url) {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url || "");
}

function InstagramEmbed({ url }) {
  useEffect(() => {
    function process() {
      if (window.instgrm) window.instgrm.Embeds.process();
    }
    if (window.instgrm) {
      process();
      return;
    }
    const existing = document.getElementById("instagram-embed-script");
    if (existing) {
      existing.addEventListener("load", process);
      return () => existing.removeEventListener("load", process);
    }
    const script = document.createElement("script");
    script.id = "instagram-embed-script";
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.onload = process;
    document.body.appendChild(script);
  }, [url]);

  return (
    <div style={{ width: "100%", maxWidth: 400, overflow: "hidden", borderRadius: 10 }}>
      <style>{`
        .instagram-media, .instagram-media iframe {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
        }
      `}</style>
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        data-instgrm-theme="dark"
        style={{ background: "#000", border: 0, borderRadius: 10, margin: 0, width: "100%", maxWidth: "100%", minWidth: 0 }}
      />
    </div>
  );
}

function getSavedName() { try { return localStorage.getItem("shotlist_client_name") || ""; } catch { return ""; } }
function saveName(n) { try { localStorage.setItem("shotlist_client_name", n); } catch {} }

const fieldStyle = {
  width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}`,
  borderRadius: 12, padding: "11px 13px", color: C.paper, fontFamily: FONT_BODY, fontSize: 15, outline: "none", resize: "vertical",
};
const pillBtn = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44, padding: "0 18px",
  borderRadius: 22, fontSize: 14.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer",
};

function fmtWhen(iso) {
  try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

// Approval block: client approves the shotlist or asks for adjustments.
function ApprovalCard({ feedback, onSend }) {
  const general = feedback.filter((f) => f.shot == null);
  const last = [...general].reverse().find((f) => f.kind === "approved" || f.kind === "adjust");
  const [mode, setMode] = useState(null); // null | adjust
  const [name, setName] = useState(getSavedName());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(kind) {
    setBusy(true);
    saveName(name);
    const ok = await onSend({ shot: null, kind, author: name, message: kind === "adjust" ? msg : "" });
    setBusy(false);
    if (ok) { setMode(null); setMsg(""); }
  }

  return (
    <div className="glass" style={{ borderRadius: 18, padding: "16px 18px", marginBottom: 20 }}>
      {last && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 14, fontWeight: 600, color: last.kind === "approved" ? C.sage : C.amber }}>
          {last.kind === "approved" ? <CheckCircle2 size={17} /> : <MessageSquare size={17} />}
          {last.kind === "approved" ? "Shotlist aprovado" : "Ajuste solicitado"}
          <span style={{ fontWeight: 400, color: C.faint, fontSize: 12.5 }}>
            {last.author ? `${last.author} · ` : ""}{fmtWhen(last.at)}
          </span>
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, color: C.paper, marginBottom: 4 }}>O shotlist está de acordo?</div>
      <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
        Aprove, ou peça um ajuste. Você também pode comentar cada shot abaixo.
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" style={{ ...fieldStyle, marginBottom: 10 }} />
      {mode === "adjust" && (
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="O que precisa mudar?" style={{ ...fieldStyle, marginBottom: 10 }} />
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {mode === "adjust" ? (
          <>
            <button disabled={busy || !msg.trim()} onClick={() => send("adjust")} className="btn-glass-primary" style={{ ...pillBtn, border: "none", opacity: msg.trim() ? 1 : 0.5 }}>
              <Send size={15} /> Enviar pedido
            </button>
            <button onClick={() => setMode(null)} style={{ ...pillBtn, background: "transparent", border: `1px solid ${C.line}`, color: C.muted }}>Cancelar</button>
          </>
        ) : (
          <>
            <button disabled={busy} onClick={() => send("approved")} className="btn-glass-primary" style={{ ...pillBtn, border: "none" }}>
              <ThumbsUp size={15} /> Aprovar
            </button>
            <button onClick={() => setMode("adjust")} style={{ ...pillBtn, background: "transparent", border: `1px solid ${C.line}`, color: C.paper }}>
              Pedir ajuste
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ShotComments({ shot, feedback, onSend }) {
  const mine = feedback.filter((f) => f.shot === shot);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!msg.trim()) return;
    setBusy(true);
    const ok = await onSend({ shot, kind: "comment", author: getSavedName(), message: msg });
    setBusy(false);
    if (ok) setMsg("");
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.lineSoft}` }}>
      {mine.map((f) => (
        <div key={f.id} style={{ fontSize: 13.5, color: C.paper, marginBottom: 8, lineHeight: 1.45 }}>
          <span style={{ color: C.faint, fontSize: 12 }}>{f.author || "Cliente"} · {fmtWhen(f.at)}</span>
          <div>{f.message}</div>
        </div>
      ))}
      {open ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escreva um comentário" style={{ ...fieldStyle, flex: 1 }} autoFocus />
          <button onClick={send} disabled={busy || !msg.trim()} style={{ ...pillBtn, padding: "0 14px", background: C.amber, color: "#0A0A0A", border: "none", opacity: msg.trim() ? 1 : 0.5 }}><Send size={15} /></button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, background: "transparent", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 }}>
          <MessageSquare size={14} /> {mine.length ? "Responder" : "Comentar"}
        </button>
      )}
    </div>
  );
}

function ShotRow({ s, feedback, onSend }) {
  const [refOpen, setRefOpen] = useState(false);
  const st = STATUS[s.status] || STATUS.afazer;
  const total = Number(s.totalTakes) || 0;
  const done = Number(s.doneTakes) || 0;
  const canEmbed = isInstagramUrl(s.referencia);
  const isVideo = isDirectVideoUrl(s.referencia);
  const playerUrl = getEmbedUrl(s.referencia);

  return (
    <div className="glass" style={{ borderRadius: 16, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {s.thumbnailUrl && (
          <img src={s.thumbnailUrl} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 7, border: `1px solid ${C.line}`, flexShrink: 0 }} />
        )}
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: C.faint, minWidth: 30 }}>
          {String(s.numero).padStart(2, "0")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, color: C.paper, fontWeight: 600 }}>{s.nome || "Sem nome"}</div>
          {s.contexto && <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>{s.contexto}</div>}
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20,
          border: `1px solid ${st.border}`, background: st.bg, color: st.color,
          fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
        }}>
          {s.status === "concluido" ? <CheckCircle2 size={13} /> : s.status === "andamento" ? <PlayCircle size={13} /> : <Circle size={13} />}
          {st.label}
        </span>
      </div>

      {(total > 0 || s.referencia) && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.lineSoft}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {total > 0 ? (
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.muted }}>{done}/{total} takes</span>
            ) : <span />}
            {s.referencia && (
              canEmbed || isVideo || playerUrl ? (
                <button
                  onClick={() => setRefOpen((v) => !v)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: C.amber, fontSize: 12, fontFamily: FONT_BODY, cursor: "pointer", padding: 0 }}
                >
                  <PlayCircle size={13} /> {refOpen ? "Ocultar referência" : "Assistir referência"}
                </button>
              ) : (
                <a href={s.referencia} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.amber, textDecoration: "none" }}>
                  Referência <ExternalLink size={11} />
                </a>
              )
            )}
          </div>
          {canEmbed && refOpen && (
            <div style={{ display: "flex", justifyContent: "center", overflow: "hidden", marginTop: 10 }}>
              <InstagramEmbed url={s.referencia} />
            </div>
          )}
          {playerUrl && refOpen && (
            <div style={{ position: "relative", width: "100%", maxWidth: 560, margin: "10px auto 0", aspectRatio: "16 / 9", borderRadius: 10, overflow: "hidden", background: "#000" }}>
              <iframe
                src={playerUrl}
                title="Referência"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              />
            </div>
          )}
          {isVideo && refOpen && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
              <video src={s.referencia} controls playsInline style={{ width: "100%", maxWidth: 400, borderRadius: 10, background: "#000" }} />
            </div>
          )}
        </div>
      )}
      <ShotComments shot={s.numero} feedback={feedback} onSend={onSend} />
    </div>
  );
}

export default function ClientView({ id }) {
  const [state, setState] = useState("loading"); // loading | ok | notfound | error
  const [data, setData] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [live, setLive] = useState(false);
  const [feedback, setFeedback] = useState([]);

  const [errorDetail, setErrorDetail] = useState("");

  const load = useCallback(async () => {
    if (!supabaseConfigured) {
      setState("error");
      setErrorDetail("Site não conectado ao banco de dados.");
      return;
    }
    try {
      const { data: result, error } = await Promise.race([
        supabase.rpc("get_shared_production", { pid: id }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Tempo esgotado ao buscar os dados.")), 10000)),
      ]);
      if (error) {
        setState("error");
        setErrorDetail(error.message || String(error));
        return;
      }
      if (!result) {
        setState("notfound");
        return;
      }
      setData(result);
      setState("ok");
      setLastFetch(new Date());
      try {
        const { data: fb } = await supabase.rpc("get_client_feedback", { pid: id });
        if (Array.isArray(fb)) setFeedback(fb);
      } catch {}
    } catch (e) {
      setState("error");
      setErrorDetail(e?.message || String(e));
    }
  }, [id]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`production:${id}`)
      .on("broadcast", { event: "production_update" }, (msg) => {
        setData(msg.payload);
        setState("ok");
        setLastFetch(new Date());
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    // safety net in case a broadcast is ever missed (e.g. brief disconnect)
    const interval = setInterval(load, SAFETY_POLL_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [load]);

  async function sendFeedback({ shot, kind, author, message }) {
    try {
      const { data: ok, error } = await supabase.rpc("submit_client_feedback", { pid: id, shot, kind_in: kind, author_in: author || "", msg: message || "" });
      if (error || !ok) return false;
      const { data: fb } = await supabase.rpc("get_client_feedback", { pid: id });
      if (Array.isArray(fb)) setFeedback(fb);
      return true;
    } catch { return false; }
  }

  if (state === "loading") {
    return (
      <Shell>
        <div style={{ display: "grid", placeItems: "center", height: 300, color: C.faint }}>
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      </Shell>
    );
  }

  if (state === "notfound" || state === "error") {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 20px", textAlign: "center", color: C.muted }}>
          <AlertCircle size={26} color={C.brick} />
          <div style={{ fontSize: 14.5, maxWidth: 320, lineHeight: 1.6 }}>
            {state === "notfound"
              ? "Esse link não está mais disponível ou o acompanhamento foi desativado."
              : "Não consegui carregar essa produção agora. Tente atualizar a página em instantes."}
          </div>
          {state === "error" && errorDetail && (
            <div style={{ fontSize: 11, color: C.faint, fontFamily: FONT_MONO, maxWidth: 320, wordBreak: "break-word", marginTop: -4 }}>
              {errorDetail}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  const shots = data.shots || [];
  const totalTakes = shots.reduce((a, s) => a + (Number(s.totalTakes) || 0), 0);
  const doneTakes = shots.reduce((a, s) => a + (Number(s.doneTakes) || 0), 0);
  const totalShots = shots.length;
  const doneShots = shots.filter((s) => s.status === "concluido").length;

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, gap: 12 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, letterSpacing: 0.3, color: C.paper }}>
            {data.cliente || "Produção"}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.faint, marginTop: 4 }}>
            {formatIntervaloDatas(data.data, data.dataFim)}
            {data.objetivoDia && <span> · {data.objetivoDia}</span>}
          </div>
        </div>
        <button
          onClick={load}
          title="Atualizar"
          style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, width: 36, height: 36, display: "grid", placeItems: "center", color: C.muted, cursor: "pointer", flexShrink: 0 }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {totalShots > 0 && (
        <div className="glass" style={{ borderRadius: 18, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted, marginBottom: 8, fontFamily: FONT_MONO }}>
            <span>{doneShots} de {totalShots} shots concluídos</span>
            {totalTakes > 0 && <span>{doneTakes}/{totalTakes} takes</span>}
          </div>
          <div style={{ height: 6, borderRadius: 3, background: C.lineSoft, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${totalShots ? (doneShots / totalShots) * 100 : 0}%`, background: C.sage, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {totalShots > 0 && <ApprovalCard feedback={feedback} onSend={sendFeedback} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shots.length === 0 && (
          <div style={{ color: C.faint, fontSize: 13.5, padding: "30px 4px", textAlign: "center" }}>
            Nenhum shot cadastrado ainda.
          </div>
        )}
        {shots.map((s) => <ShotRow key={s.numero} s={s} feedback={feedback} onSend={sendFeedback} />)}
      </div>

      {lastFetch && (
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: C.faint, fontFamily: FONT_MONO, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span className={live ? "live-dot" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: live ? C.sage : C.faint, display: "inline-block" }} />
          {live ? "Ao vivo" : "Atualizado"} às {lastFetch.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "transparent", fontFamily: FONT_BODY, padding: "24px 16px 60px", paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(60px, env(safe-area-inset-bottom))" }}>
      <div style={{ maxWidth: 560, margin: "0 auto 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <ShotlistLogo size={24} />
        <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>
          Acompanhamento de produção
        </div>
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>{children}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } button { font-family: inherit; }`}</style>
    </div>
  );
}

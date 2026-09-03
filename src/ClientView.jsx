import React, { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, ExternalLink, RefreshCw, CheckCircle2, PlayCircle, Circle } from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import ShotlistMark from "./ShotlistMark";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";

const STATUS = {
  afazer: { label: "A fazer", color: C.muted, bg: "transparent", border: C.line },
  andamento: { label: "Em andamento", color: C.amber, bg: C.amberDim, border: C.amber },
  concluido: { label: "Concluído", color: C.sage, bg: C.sageDim, border: C.sage },
};

const SAFETY_POLL_MS = 60000;

export default function ClientView({ id }) {
  const [state, setState] = useState("loading"); // loading | ok | notfound | error
  const [data, setData] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [live, setLive] = useState(false);

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
            <div style={{ fontSize: 11, color: C.faint, fontFamily: "monospace", maxWidth: 320, wordBreak: "break-word", marginTop: -4 }}>
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
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 600, color: C.paper }}>
            {data.cliente || "Produção"}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.faint, marginTop: 4 }}>
            {data.data}
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
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted, marginBottom: 8, fontFamily: FONT_MONO }}>
            <span>{doneShots} de {totalShots} shots concluídos</span>
            {totalTakes > 0 && <span>{doneTakes}/{totalTakes} takes</span>}
          </div>
          <div style={{ height: 6, borderRadius: 3, background: C.lineSoft, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${totalShots ? (doneShots / totalShots) * 100 : 0}%`, background: C.sage, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shots.length === 0 && (
          <div style={{ color: C.faint, fontSize: 13.5, padding: "30px 4px", textAlign: "center" }}>
            Nenhum shot cadastrado ainda.
          </div>
        )}
        {shots.map((s) => {
          const st = STATUS[s.status] || STATUS.afazer;
          const total = Number(s.totalTakes) || 0;
          const done = Number(s.doneTakes) || 0;
          return (
            <div key={s.numero} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {s.thumbnailUrl && (
                  <img src={s.thumbnailUrl} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 7, border: `1px solid ${C.line}`, flexShrink: 0 }} />
                )}
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: C.faint, minWidth: 30 }}>
                  {String(s.numero).padStart(2, "0")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: C.paper, fontWeight: 500 }}>{s.nome || "Sem nome"}</div>
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.lineSoft}` }}>
                  {total > 0 ? (
                    <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.muted }}>{done}/{total} takes</span>
                  ) : <span />}
                  {s.referencia && (
                    <a href={s.referencia} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.amber, textDecoration: "none" }}>
                      Referência <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lastFetch && (
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: C.faint, fontFamily: FONT_MONO, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: live ? C.sage : C.faint, display: "inline-block" }} />
          {live ? "Ao vivo" : "Atualizado"} às {lastFetch.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.ink, fontFamily: FONT_BODY, padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <Film size={18} color={C.amber} />
        <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5, color: C.faint }}>
          ACOMPANHAMENTO DE PRODUÇÃO
        </div>
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>{children}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

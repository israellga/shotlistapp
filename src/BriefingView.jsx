import React, { useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import ShotlistLogo from "./ShotlistLogo";
import { C, FONT_DISPLAY, FONT_BODY } from "./theme";
import { formatIntervaloDatas } from "./datetime";

export const BRIEFING_CAMPOS = [
  ["objetivo", "Qual o objetivo do material?", "Ex: divulgar o cardápio novo nas redes"],
  ["publico", "Quem é o público?", "Ex: casais de 25 a 40 anos"],
  ["estilo", "Estilo e referências", "Cole links ou descreva o clima (claro, escuro, natural...)"],
  ["obrigatorios", "O que não pode faltar", "Ex: foto da fachada, prato X, equipe toda"],
  ["restricoes", "O que evitar", "Ex: não mostrar a marca Y, evitar horário de pico"],
  ["contato_local", "Contato no local (nome e telefone)", "Quem recebe a equipe no dia"],
  ["observacoes", "Mais alguma informação?", ""],
];

const field = {
  width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}`,
  borderRadius: 12, padding: "12px 14px", color: C.paper, fontFamily: FONT_BODY, fontSize: 16, outline: "none", minHeight: 46,
};

// Página pública: o cliente preenche o briefing antes da captação.
export default function BriefingView({ id }) {
  const [state, setState] = useState("loading"); // loading | form | notfound | error | done
  const [info, setInfo] = useState(null);
  const [d, setD] = useState({});
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!supabaseConfigured) { setState("error"); return; }
      try {
        const { data, error: e } = await supabase.rpc("get_briefing_info", { pid: id });
        if (e) { setState("error"); return; }
        if (!data) { setState("notfound"); return; }
        setInfo(data); setD(data.briefing || {}); setState("form");
      } catch { setState("error"); }
    })();
  }, [id]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { data: ok, error: err } = await supabase.rpc("submit_briefing", { pid: id, d, author_in: author });
      if (err || !ok) setError("Não foi possível enviar agora. Tente de novo em instantes.");
      else setState("done");
    } catch { setError("Sem conexão. Tente de novo."); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", padding: "28px 18px 60px", fontFamily: FONT_BODY, color: C.paper }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <ShotlistLogo size={30} />
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15, letterSpacing: 1, color: C.muted }}>BRIEFING</span>
        </div>
        {state === "loading" && <Loader2 size={22} color={C.muted} style={{ animation: "spin 1s linear infinite" }} />}
        {(state === "notfound" || state === "error") && (
          <div style={{ display: "flex", gap: 10, color: C.muted, alignItems: "center" }}>
            <AlertCircle size={20} /> {state === "notfound" ? "Este briefing não está disponível." : "Não foi possível carregar o briefing."}
          </div>
        )}
        {state === "done" && (
          <div className="glass" style={{ borderRadius: 18, padding: "18px", display: "flex", gap: 12 }}>
            <CheckCircle2 size={22} color={C.sage} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Briefing enviado</div>
              <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>Obrigado! Se lembrar de algo, é só abrir este link de novo e atualizar.</div>
            </div>
          </div>
        )}
        {state === "form" && (
          <form onSubmit={submit}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700 }}>{info.cliente || "Produção"}</div>
            <div style={{ color: C.muted, fontSize: 14, margin: "4px 0 20px" }}>
              {info.data ? formatIntervaloDatas(info.data, info.dataFim) + " · " : ""}Conte pra gente como você imagina o trabalho.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {BRIEFING_CAMPOS.map(([k, label, ph]) => (
                <label key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13.5, color: C.muted, fontWeight: 500 }}>{label}</span>
                  <textarea value={d[k] || ""} onChange={(e) => setD((p) => ({ ...p, [k]: e.target.value }))} rows={k === "contato_local" ? 2 : 3} placeholder={ph} style={{ ...field, resize: "vertical" }} />
                </label>
              ))}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13.5, color: C.muted, fontWeight: 500 }}>Seu nome</span>
                <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Quem está preenchendo" style={field} />
              </label>
            </div>
            {error && <div style={{ color: C.brick, fontSize: 13.5, marginTop: 12 }}>{error}</div>}
            <button disabled={busy} className="btn-glass-primary" style={{ marginTop: 18, minHeight: 50, padding: "0 28px", borderRadius: 25, border: "none", fontFamily: FONT_BODY, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              {busy ? "Enviando…" : "Enviar briefing"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

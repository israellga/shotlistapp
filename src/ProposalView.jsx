import React, { useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import ShotlistLogo from "./ShotlistLogo";
import { C, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "./theme";
import { formatBRL } from "./finance";
import { totalProposta, fillContrato } from "./proposals";

const field = {
  width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}`,
  borderRadius: 12, padding: "12px 14px", color: C.paper, fontFamily: FONT_BODY, fontSize: 16, outline: "none", minHeight: 46,
};

function maskDoc(v) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

// Página pública: o cliente lê a proposta e o contrato e aceita (ou recusa) online.
export default function ProposalView({ id }) {
  const [state, setState] = useState("loading");
  const [data, setData] = useState(null);
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");
  const [agree, setAgree] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!supabaseConfigured) { setState("error"); return; }
    try {
      const { data: r, error: e } = await supabase.rpc("get_shared_proposal", { pid: id });
      if (e) { setState("error"); return; }
      if (!r) { setState("notfound"); return; }
      setData(r); setState("ok");
    } catch { setState("error"); }
  }
  useEffect(() => { load(); }, [id]);

  async function respond(action) {
    setBusy(true); setError("");
    try {
      const { data: ok, error: e } = await supabase.rpc("respond_proposal", { pid: id, action, name_in: name, doc_in: doc, note_in: note });
      if (e || !ok) { setError("Não foi possível registrar agora. Tente de novo em instantes."); setBusy(false); return; }
      await load();
    } catch { setError("Sem conexão. Tente de novo."); }
    setBusy(false);
  }

  const Shell = ({ children }) => (
    <div style={{ minHeight: "100vh", padding: "28px 18px 60px", fontFamily: FONT_BODY, color: C.paper }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <ShotlistLogo size={30} />
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15, letterSpacing: 1, color: C.muted }}>PROPOSTA</span>
        </div>
        {children}
      </div>
    </div>
  );

  if (state === "loading") return <Shell><Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} color={C.muted} /></Shell>;
  if (state !== "ok") return (
    <Shell>
      <div style={{ display: "flex", gap: 10, color: C.muted, alignItems: "center" }}>
        <AlertCircle size={20} /> {state === "notfound" ? "Esta proposta não está disponível." : "Não foi possível carregar a proposta."}
      </div>
    </Shell>
  );

  const p = data.payload || {};
  const total = totalProposta(p);
  const emissor = p.emissor || data.emissor || "";
  const contrato = fillContrato(p.contrato, { cliente: p.cliente_nome, emissor, titulo: data.titulo, total: formatBRL(total) });
  const venceu = p.validade && p.validade < new Date().toISOString().slice(0, 10);
  const when = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <Shell>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{data.titulo || "Proposta de serviços"}</div>
      <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>
        {emissor && <>De <b style={{ color: C.paper }}>{emissor}</b> · </>}Para <b style={{ color: C.paper }}>{p.cliente_nome}</b>
      </div>

      <div className="glass" style={{ borderRadius: 18, padding: "16px 18px", marginTop: 20 }}>
        {(p.itens || []).filter((i) => i.desc || i.valor).map((i) => (
          <div key={i.id} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.lineSoft}`, fontSize: 14.5 }}>
            <span style={{ flex: 1 }}>{i.desc}</span>
            <span style={{ color: C.muted }}>{formatBRL(Number(i.valor) || 0)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, fontSize: 18, fontWeight: 700 }}>
          <span>Total</span><span>{formatBRL(total)}</span>
        </div>
      </div>

      {[["O que está incluso", p.escopo], ["Pagamento", p.condicoes], ["Prazo de entrega", p.prazoEntrega]].filter((x) => x[1]).map(([t, v]) => (
        <div key={t} style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.4, marginBottom: 4 }}>{t.toUpperCase()}</div>
          <div style={{ fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-wrap", color: C.paper }}>{v}</div>
        </div>
      ))}
      {p.validade && <div style={{ fontSize: 13, color: venceu ? C.brick : C.muted, marginTop: 14 }}>Proposta válida até {p.validade.split("-").reverse().join("/")}{venceu ? " (prazo vencido, fale com quem enviou)" : ""}.</div>}

      {contrato && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.4, marginBottom: 6 }}>CONTRATO</div>
          <div className="glass" style={{ borderRadius: 16, padding: "14px 16px", maxHeight: 280, overflowY: "auto", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", color: C.muted }}>{contrato}</div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        {data.status === "aceita" && (
          <div className="glass" style={{ borderRadius: 18, padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <CheckCircle2 size={22} color={C.sage} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Proposta aceita</div>
              <div style={{ fontSize: 13.5, color: C.muted, marginTop: 2 }}>{data.accepted_name} · {data.accepted_at ? when(data.accepted_at) : ""}</div>
              <div style={{ fontSize: 13.5, color: C.muted, marginTop: 6 }}>Obrigado! Você receberá os próximos passos em breve.</div>
            </div>
          </div>
        )}
        {data.status === "recusada" && <div style={{ color: C.muted, fontSize: 14 }}>Esta proposta foi recusada.</div>}
        {data.status === "enviada" && !venceu && (
          <div className="glass" style={{ borderRadius: 18, padding: "16px 18px" }}>
            {declining ? (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Quer contar o motivo? (opcional)</div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ ...field, marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button disabled={busy} onClick={() => respond("decline")} style={{ ...btn, background: "transparent", border: `1px solid ${C.line}`, color: C.paper }}>Confirmar recusa</button>
                  <button onClick={() => setDeclining(false)} style={{ ...btn, background: "transparent", color: C.muted }}>Voltar</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Aceite online</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" autoComplete="name" style={field} />
                  <input value={doc} onChange={(e) => setDoc(maskDoc(e.target.value))} placeholder="CPF ou CNPJ" inputMode="numeric" style={field} />
                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, width: 20, height: 20 }} />
                    Li a proposta e o contrato e concordo com todas as condições.
                  </label>
                </div>
                {error && <div style={{ color: C.brick, fontSize: 13.5, marginTop: 10 }}>{error}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  <button
                    disabled={busy || !agree || !name.trim() || doc.replace(/\D/g, "").length < 11}
                    onClick={() => respond("accept")}
                    className="btn-glass-primary"
                    style={{ ...btn, border: "none", opacity: agree && name.trim() && doc.replace(/\D/g, "").length >= 11 ? 1 : 0.5 }}
                  >
                    {busy ? "Enviando…" : "Aceitar proposta"}
                  </button>
                  <button onClick={() => setDeclining(true)} style={{ ...btn, background: "transparent", color: C.muted }}>Recusar</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

const btn = { minHeight: 48, padding: "0 22px", borderRadius: 24, fontFamily: FONT_BODY, fontSize: 15, fontWeight: 700, cursor: "pointer" };

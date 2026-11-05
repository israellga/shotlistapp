import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "./supabaseClient";
import ShotlistMark from "./ShotlistMark";
import { C, FONT_DISPLAY, FONT_BODY } from "./theme";
import { maskPhone, maskCEP, maskCNPJ, lookupCEP } from "./masks";

const input = {
  width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}`,
  borderRadius: 12, padding: "12px 14px", color: C.paper, fontFamily: FONT_BODY, fontSize: 16, outline: "none", minHeight: 46,
};

function F({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

// Public page: the client fills in their own registration data.
export default function IntakeView({ token }) {
  const [state, setState] = useState("loading"); // loading | form | invalid | done
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [d, setD] = useState({ name: "", responsavel: "", phone: "", email: "", cnpj: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc("get_intake_info", { tok: token });
        if (data?.name) { setCompany(data.name); setState("form"); } else setState("invalid");
      } catch { setState("invalid"); }
    })();
  }, [token]);

  async function onCep() {
    if (d.cep.replace(/\D/g, "").length !== 8) return;
    const a = await lookupCEP(d.cep);
    if (a) setD((p) => ({ ...p, ...a }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!d.name.trim()) { setError("Informe o nome ou a razão social."); return; }
    setBusy(true); setError("");
    try {
      const { data, error: err } = await supabase.rpc("submit_client_intake", { tok: token, d });
      if (err || !data) throw new Error("Não foi possível enviar agora. Tente de novo em instantes.");
      setState("done");
    } catch (e2) { setError(e2.message); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", fontFamily: FONT_BODY, padding: "24px 16px 60px", paddingTop: "max(24px, env(safe-area-inset-top))" }}>
      <div style={{ maxWidth: 520, margin: "0 auto 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <ShotlistMark size={18} lit />
        <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>Cadastro de cliente</div>
      </div>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {state === "loading" && <div style={{ display: "grid", placeItems: "center", height: 240, color: C.faint }}><Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /></div>}
        {state === "invalid" && (
          <div style={{ textAlign: "center", color: C.muted, padding: "60px 20px", lineHeight: 1.6 }}>
            <AlertCircle size={26} color={C.brick} style={{ marginBottom: 10 }} />
            <div>Esse link de cadastro não está mais disponível. Peça um novo para quem enviou.</div>
          </div>
        )}
        {state === "done" && (
          <div className="glass" style={{ borderRadius: 18, padding: "30px 22px", textAlign: "center" }}>
            <CheckCircle2 size={34} color={C.sage} style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.paper, marginBottom: 6 }}>Recebido!</div>
            <div style={{ color: C.muted, fontSize: 14.5, lineHeight: 1.5 }}>Seus dados foram enviados para {company}. Obrigado!</div>
          </div>
        )}
        {state === "form" && (
          <form onSubmit={submit} className="fade-in-up">
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, letterSpacing: 0.3, color: C.paper, marginBottom: 6 }}>Seus dados</div>
            <div style={{ fontSize: 14.5, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>Preencha para {company} montar o orçamento e o contrato.</div>
            <div className="glass" style={{ borderRadius: 18, padding: 16, display: "grid", gap: 14 }}>
              <F label="Nome ou razão social *"><input style={input} value={d.name} onChange={(e) => set("name", e.target.value)} autoComplete="organization" /></F>
              <F label="Responsável"><input style={input} value={d.responsavel} onChange={(e) => set("responsavel", e.target.value)} autoComplete="name" /></F>
              <F label="WhatsApp"><input style={input} inputMode="tel" value={d.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(11) 99999-9999" autoComplete="tel" /></F>
              <F label="E-mail"><input style={input} type="email" value={d.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></F>
              <F label="CNPJ ou CPF"><input style={input} inputMode="numeric" value={d.cnpj} onChange={(e) => set("cnpj", maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" /></F>
              <F label="CEP"><input style={input} inputMode="numeric" value={d.cep} onChange={(e) => set("cep", maskCEP(e.target.value))} onBlur={onCep} placeholder="00000-000" autoComplete="postal-code" /></F>
              <F label="Endereço"><input style={input} value={d.logradouro} onChange={(e) => set("logradouro", e.target.value)} autoComplete="address-line1" /></F>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                <F label="Número"><input style={input} value={d.numero} onChange={(e) => set("numero", e.target.value)} /></F>
                <F label="Complemento"><input style={input} value={d.complemento} onChange={(e) => set("complemento", e.target.value)} /></F>
              </div>
              <F label="Bairro"><input style={input} value={d.bairro} onChange={(e) => set("bairro", e.target.value)} /></F>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 10 }}>
                <F label="Cidade"><input style={input} value={d.cidade} onChange={(e) => set("cidade", e.target.value)} /></F>
                <F label="UF"><input style={input} value={d.estado} maxLength={2} onChange={(e) => set("estado", e.target.value.toUpperCase())} /></F>
              </div>
            </div>
            {error && <div style={{ color: C.brick, fontSize: 13.5, marginTop: 12 }}>{error}</div>}
            <button type="submit" disabled={busy} className="btn-glass-primary" style={{ marginTop: 18, width: "100%", minHeight: 50, border: "none", borderRadius: 25, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: FONT_BODY }}>
              {busy ? "Enviando..." : "Enviar dados"}
            </button>
          </form>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

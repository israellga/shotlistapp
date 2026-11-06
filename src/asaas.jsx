import React, { useEffect, useState, useCallback } from "react";
import { Zap, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_BODY, FONT_MONO } from "./theme";

// Estado da conexão do gestor com a própria conta do Asaas (a chave nunca volta ao navegador).
export function useAsaasStatus(workspaceId) {
  const [st, setSt] = useState(null); // null = carregando
  const reload = useCallback(async () => {
    if (!workspaceId) { setSt({ connected: false }); return; }
    const { data, error } = await supabase.rpc("get_asaas_status", { ws_id: workspaceId });
    setSt(error || !data ? { connected: false } : data);
  }, [workspaceId]);
  useEffect(() => { reload(); }, [reload]);
  return [st, reload];
}

async function callAsaas(body) {
  const { data, error } = await supabase.functions.invoke("asaas", { body });
  if (error) {
    let detail = "";
    try { detail = (await error.context?.json?.())?.error || ""; } catch { /* ignore */ }
    throw new Error(detail || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function AsaasConnect({ workspaceId, email }) {
  const [st, reload] = useAsaasStatus(workspaceId);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null); // {ok, text}

  async function connect() {
    setBusy("connect"); setMsg(null);
    try {
      const { data, error } = await supabase.rpc("save_asaas_key", { ws_id: workspaceId, key_in: key });
      if (error || !data?.ok) throw new Error(data?.error || "Não consegui salvar a chave.");
      await callAsaas({ action: "setup_webhook", workspace_id: workspaceId, email: email || "" });
      setKey("");
      setMsg({ ok: true, text: `Conectado (${data.env === "production" ? "conta real" : "ambiente de testes"}). A baixa automática está ativa.` });
      await reload();
    } catch (e) { setMsg({ ok: false, text: e.message || "Falha ao conectar." }); await reload(); }
    setBusy("");
  }
  async function reactivate() {
    setBusy("hook"); setMsg(null);
    try { await callAsaas({ action: "setup_webhook", workspace_id: workspaceId, email: email || "" }); setMsg({ ok: true, text: "Baixa automática reativada." }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy("");
  }
  async function disconnect() {
    if (!window.confirm("Desconectar o Asaas? Novas cobranças deixam de ser geradas.")) return;
    setBusy("off"); setMsg(null);
    await supabase.rpc("disconnect_asaas", { ws_id: workspaceId });
    await reload();
    setBusy("");
  }

  const on = st?.connected;
  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.lineSoft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Zap size={15} color={C.amber} />
        <span style={{ fontSize: 14, fontWeight: 600, color: C.paper }}>Cobranças com Asaas</span>
        {on && <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.sage, border: `1px solid ${C.sage}`, borderRadius: 10, padding: "1px 7px" }}>{st.env === "production" ? "CONECTADO" : "TESTES"}</span>}
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
        {on
          ? "As cobranças (Pix, boleto e cartão) saem na sua conta do Asaas e o dinheiro cai direto nela. A parcela é marcada como paga sozinha."
          : "Conecte a sua conta do Asaas para gerar Pix, boleto e cartão nas parcelas. Gere a chave em Asaas > Integrações > Chave de API e cole abaixo."}
      </div>
      {st === null ? (
        <Loader2 size={16} color={C.faint} style={{ animation: "spin 1s linear infinite" }} />
      ) : on ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={!!busy} onClick={reactivate} style={btn}>{busy === "hook" ? "Ativando…" : "Reativar baixa automática"}</button>
          <button disabled={!!busy} onClick={disconnect} style={{ ...btn, color: C.brick, borderColor: C.brick }}>Desconectar</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Chave de API ($aact_...)" autoComplete="off" spellCheck={false} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "11px 13px", color: C.paper, fontFamily: FONT_MONO, fontSize: 12.5, outline: "none" }} />
          <button disabled={!!busy || key.trim().length < 20} onClick={connect} style={{ ...btn, background: C.amberDim, borderColor: C.amber, color: C.amber, opacity: key.trim().length < 20 ? 0.5 : 1 }}>
            {busy === "connect" ? "Conectando…" : "Conectar Asaas"}
          </button>
        </div>
      )}
      {msg && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: msg.ok ? C.sage : C.brick }}>
          {msg.ok ? <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />} {msg.text}
        </div>
      )}
    </div>
  );
}
const btn = { minHeight: 40, padding: "0 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer" };

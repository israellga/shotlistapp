import React, { useEffect, useState, useCallback } from "react";
import { Zap, Loader2, CheckCircle2, AlertCircle, Bell } from "lucide-react";
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

const brl = (n) => (n == null || isNaN(Number(n)) ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

// Avisos automáticos ao cliente (e-mail, WhatsApp, SMS) + taxas reais da conta do Asaas.
function AsaasNotifs({ workspaceId, st, reload }) {
  const [canais, setCanais] = useState({ email: !!st?.notificacoes?.email, whatsapp: !!st?.notificacoes?.whatsapp, sms: !!st?.notificacoes?.sms });
  const [fees, setFees] = useState(null);
  const [feesErr, setFeesErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let live = true;
    callAsaas({ action: "get_fees", workspace_id: workspaceId }).then((d) => live && setFees(d)).catch((e) => live && setFeesErr(e.message));
    return () => { live = false; };
  }, [workspaceId]);

  const n = fees?.notification || {};
  const price = { email: null, whatsapp: n.whatsappFeeValue ?? n.whatsAppFeeValue, sms: n.smsFeeValue };
  const saved = st?.notificacoes || {};
  const dirty = ["email", "whatsapp", "sms"].some((k) => !!canais[k] !== !!saved[k]);
  const perCharge = ["whatsapp", "sms"].reduce((t, k) => t + (canais[k] && price[k] ? Number(price[k]) * 3 : 0), 0);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await callAsaas({ action: "save_notifications", workspace_id: workspaceId, canais });
      setMsg(r.ok ? { ok: true, text: "Avisos salvos. Valem para as próximas cobranças e para clientes que já têm cobrança." } : { ok: false, text: "Salvei, mas não consegui atualizar alguns clientes. Tente de novo." });
      await reload();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  }
  const Row = ({ k, label, hint }) => (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", cursor: "pointer" }}>
      <input type="checkbox" checked={!!canais[k]} onChange={(e) => setCanais({ ...canais, [k]: e.target.checked })} style={{ marginTop: 3, width: 17, height: 17 }} />
      <span style={{ flex: 1 }}>
        <span style={{ fontSize: 13.5, color: C.paper, fontWeight: 600 }}>{label}</span>
        <span style={{ display: "block", fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{hint}</span>
      </span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: price[k] ? C.amber : C.sage, whiteSpace: "nowrap" }}>{k === "email" ? "sem custo informado" : price[k] ? `${brl(price[k])} / aviso` : "—"}</span>
    </label>
  );
  const pay = fees?.payment || {};
  const feeLine = (label, f) => f && (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "3px 0" }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: C.paper, fontFamily: FONT_MONO, textAlign: "right" }}>{f}</span>
    </div>
  );
  const fixed = (o) => o && (o.promotionalFixedFee != null && o.promotionalFixedFee < (o.defaultFixedFee ?? Infinity) ? `${brl(o.promotionalFixedFee)} (promo; normal ${brl(o.defaultFixedFee)})` : brl(o.fixedFee ?? o.defaultFixedFee ?? o.promotionalFixedFee));
  const cardFee = (o) => o && `${brl(o.operationValue ?? o.fixedFee)} + ${o.defaultPercentage ?? o.percentage ?? o.upfrontPercentage ?? "—"}%`;

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px dashed ${C.lineSoft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Bell size={14} color={C.amber} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.paper }}>Avisos automáticos ao cliente</span>
      </div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 6 }}>
        O Asaas avisa o cliente quando a cobrança é criada, no dia do vencimento e se atrasar (até 3 avisos por cobrança). Quando o cliente paga, a parcela é baixada sozinha aqui.
      </div>
      <Row k="email" label="E-mail" hint="Precisa do e-mail do cliente cadastrado." />
      <Row k="whatsapp" label="WhatsApp" hint="Precisa do celular do cliente cadastrado." />
      <Row k="sms" label="SMS" hint="Precisa do celular do cliente cadastrado." />
      <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", margin: "6px 0 10px", fontSize: 12, lineHeight: 1.5, color: C.muted }}>
        <b style={{ color: C.amber }}>Quem paga:</b> você. Cada aviso por WhatsApp ou SMS é cobrado pelo Asaas e <b style={{ color: C.paper }}>descontado do saldo que você recebe</b> — o cliente não paga nada a mais.
        {perCharge > 0 && <div style={{ marginTop: 6, color: C.paper }}>Estimativa com os canais marcados: até <b>{brl(perCharge)}</b> por cobrança (3 avisos).</div>}
        {!fees && !feesErr && <div style={{ marginTop: 6 }}>Buscando valores da sua conta…</div>}
        {feesErr && <div style={{ marginTop: 6, color: C.brick }}>Não consegui buscar os valores agora ({feesErr}). Confira em Asaas &gt; Minha conta &gt; Taxas.</div>}
        {fees && <div style={{ marginTop: 6 }}>Valores lidos da sua conta do Asaas. E-mail não tem valor listado por lá; confirme em Asaas &gt; Minha conta &gt; Taxas.</div>}
      </div>
      {fees && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.paper, marginBottom: 2 }}>Taxas por pagamento recebido (também descontadas do que você recebe)</div>
          {feeLine("Pix", fixed(pay.pix))}
          {feeLine("Boleto", fixed(pay.bankSlip))}
          {feeLine("Cartão (à vista)", cardFee(pay.creditCard))}
        </div>
      )}
      <button disabled={busy || !dirty} onClick={save} style={{ ...btn, background: C.amberDim, borderColor: C.amber, color: C.amber, opacity: dirty ? 1 : 0.5 }}>{busy ? "Salvando…" : "Salvar avisos"}</button>
      {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: msg.ok ? C.sage : C.brick }}>{msg.text}</div>}
    </div>
  );
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
      {on && <AsaasNotifs workspaceId={workspaceId} st={st} reload={reload} />}
      {msg && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: msg.ok ? C.sage : C.brick }}>
          {msg.ok ? <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />} {msg.text}
        </div>
      )}
    </div>
  );
}
const btn = { minHeight: 40, padding: "0 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer" };

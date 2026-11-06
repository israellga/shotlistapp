import { uid as secureUid } from "./uid";
import React, { useState } from "react";
import { Paperclip, Zap, ExternalLink } from "lucide-react";
import { Plus, Trash2, Check, Copy, ChevronRight, Save, Loader2, CreditCard, Circle, CheckCircle2, Mail, MessageCircle, FileDown } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";
import { IconButton, ConfirmDialog } from "./ui";
import { formatBRL } from "./finance";
import { exportReceiptPDF } from "./receiptPdf";
import { useAsaasStatus } from "./asaas";

const uid = () => secureUid();

export function emptyPaymentPlan(clientId, productionId = null, titulo = "") {
  return { id: uid(), client_id: clientId, production_id: productionId, titulo, valor_total: "", parcelas: [], share_enabled: false, notify_enabled: false, notify_days_before: 3, pagamento: {} };
}

function addMonths(dateStr, n) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function planTotals(plan) {
  const parcelas = plan.parcelas || [];
  const total = Number(plan.valor_total) || parcelas.reduce((a, p) => a + (Number(p.valor) || 0), 0);
  const pago = parcelas.filter((p) => p.pago).reduce((a, p) => a + (Number(p.valor) || 0), 0);
  const restante = total - pago;
  const proxima = parcelas.filter((p) => !p.pago).sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))[0];
  return { total, pago, restante, proxima, count: parcelas.length, countPagas: parcelas.filter((p) => p.pago).length };
}

function CopyLinkButton({ link }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  }
  return (
    <button
      onClick={copy}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: copied ? C.sageDim : C.amberDim, border: `1px solid ${copied ? C.sage : C.amber}`,
        borderRadius: 7, padding: "8px 12px", color: copied ? C.sage : C.amber, fontSize: 12.5, fontWeight: 600,
        fontFamily: FONT_BODY, cursor: "pointer", flexShrink: 0,
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function waDigits(phone) {
  const d = (phone || "").replace(/\D/g, "");
  return d.length >= 10 ? (d.length <= 11 ? "55" + d : d) : "";
}
function waParcelaLink(phone, name, plan, parc, link) {
  const [y, m, d] = (parc.vencimento || "").split("-");
  const data = parc.vencimento ? `${d}/${m}/${y}` : "";
  const valor = formatBRL(Number(parc.valor) || 0);
  const first = (name || "").trim().split(" ")[0];
  const msg = `Olá${first ? ", " + first : ""}! Passando para lembrar da parcela ${parc.numero}${plan.titulo ? " de " + plan.titulo : ""}, no valor de ${valor}${data ? ", com vencimento em " + data : ""}.${plan.share_enabled ? " Você acompanha tudo aqui: " + link : ""} Qualquer dúvida é só me chamar!`;
  return `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(msg)}`;
}

const miniInput = { width: "100%", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, padding: "7px 9px", color: C.paper, fontFamily: FONT_BODY, fontSize: 12.5, outline: "none", boxSizing: "border-box" };

async function openComprovante(c) {
  const { data } = await supabase.storage.from("comprovantes").createSignedUrl(c.path, 300);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
}

export function PaymentPlanRow({ plan, clientEmail, clientPhone, clientName, clientDoc, issuer, onChange, onSave, onDelete }) {
  const [testState, setTestState] = useState(""); // "" | "sending" | "ok" | mensagem de erro
  const [expanded, setExpanded] = useState(!plan.titulo);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [genCount, setGenCount] = useState(3);
  const [genFirstDate, setGenFirstDate] = useState("");

  async function sendTestEmail() {
    setTestState("sending");
    try {
      const { data, error } = await supabase.functions.invoke("send-payment-reminders", {
        body: { test: true, titulo: plan.titulo, valor: (plan.parcelas || [])[0]?.valor, dias: plan.notify_days_before },
      });
      if (error) {
        let detail = "";
        try { detail = (await error.context?.json?.())?.error || ""; } catch { /* ignore */ }
        throw new Error(detail || error.message);
      }
      if (data?.error) throw new Error(data.error);
      setTestState("ok");
    } catch (e) {
      setTestState(e?.message || "Falha ao enviar.");
    }
  }

  function patch(fields) { onChange({ ...plan, ...fields }); }
  const parcelas = plan.parcelas || [];
  const t = planTotals(plan);
  const [asaasSt] = useAsaasStatus(plan.workspace_id);
  const asaasOn = !!asaasSt?.connected;
  const [asaasBusy, setAsaasBusy] = useState("");
  const [asaasMsg, setAsaasMsg] = useState("");

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
  const avisos = plan.pagamento?.avisos || {};
  const [avisoMsg, setAvisoMsg] = useState("");
  async function setAviso(k, v) {
    const next = { ...avisos, [k]: v };
    patch({ pagamento: { ...(plan.pagamento || {}), avisos: next } });
    setAvisoMsg("");
    try {
      await onSave();
      await callAsaas({ action: "set_plan_notifications", plan_id: plan.id, canais: next });
      setAvisoMsg("Salvo.");
      setTimeout(() => setAvisoMsg(""), 2500);
    } catch (e) { setAvisoMsg(e.message || "Falha ao salvar."); }
  }
  async function createCharge(pc) {
    setAsaasBusy(pc.id); setAsaasMsg("");
    try {
      await onSave();
      const r = await callAsaas({ action: "create_charge", plan_id: plan.id, parcela_id: pc.id });
      const { data: fresh } = await supabase.from("payment_plans").select("*").eq("id", plan.id).maybeSingle();
      if (fresh) onChange(fresh);
      setAsaasMsg(`Cobrança ${r.reused ? "já existia no Asaas e foi vinculada" : "criada"}${r.env === "sandbox" ? " (ambiente de testes)" : ""}.`);
      setTimeout(() => setAsaasMsg(""), 4000);
    } catch (e) { setAsaasMsg(e.message || "Falha ao criar a cobrança."); }
    setAsaasBusy("");
  }

  function updateParcela(id, fields) {
    patch({ parcelas: parcelas.map((p) => (p.id === id ? { ...p, ...fields } : p)) });
  }
  function addParcela() {
    const n = parcelas.length + 1;
    patch({ parcelas: [...parcelas, { id: uid(), numero: n, valor: "", vencimento: "", pago: false }] });
  }
  function removeParcela(id) {
    patch({ parcelas: parcelas.filter((p) => p.id !== id).map((p, i) => ({ ...p, numero: i + 1 })) });
  }
  function generateParcelas() {
    const total = Number(plan.valor_total) || 0;
    const n = Math.max(1, Number(genCount) || 1);
    const each = Math.round((total / n) * 100) / 100;
    const list = Array.from({ length: n }, (_, i) => ({
      id: uid(), numero: i + 1, valor: i === n - 1 ? Math.round((total - each * (n - 1)) * 100) / 100 : each,
      vencimento: genFirstDate ? addMonths(genFirstDate, i) : "", pago: false,
    }));
    patch({ parcelas: list });
  }

  async function handleSave() {
    setSaving(true);
    await onSave();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const link = `${window.location.origin}/?payment=${plan.id}`;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "12px 14px" }}>
      <div className="hover-line" onClick={() => setExpanded((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {plan.titulo || "Sem título"}
          </div>
          <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, marginTop: 2 }}>
            {formatBRL(t.pago)} / {formatBRL(t.total)} · {t.countPagas}/{t.count} parcelas
          </div>
        </div>
        <ChevronRight size={15} color={C.faint} className={`chevron-rotate${expanded ? " open" : ""}`} />
      </div>

      {expanded && (
        <div className="fade-in-up" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 10 }}>
            <input
              value={plan.titulo}
              onChange={(e) => patch({ titulo: e.target.value })}
              placeholder="Título (ex: Pacote anual 2026)"
              style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13, outline: "none" }}
            />
            <input
              type="number"
              value={plan.valor_total}
              onChange={(e) => patch({ valor_total: e.target.value })}
              placeholder="Valor total"
              style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13, outline: "none" }}
            />
          </div>

          <div style={{ fontSize: 11, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3, marginBottom: 6 }}>COMO O CLIENTE PAGA (aparece no link dele)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input value={plan.pagamento?.pix || ""} onChange={(e) => patch({ pagamento: { ...(plan.pagamento || {}), pix: e.target.value } })} placeholder="Chave Pix" style={miniInput} />
            <input value={plan.pagamento?.favorecido || ""} onChange={(e) => patch({ pagamento: { ...(plan.pagamento || {}), favorecido: e.target.value } })} placeholder="Nome do favorecido" style={miniInput} />
          </div>
          <input value={plan.pagamento?.instrucoes || ""} onChange={(e) => patch({ pagamento: { ...(plan.pagamento || {}), instrucoes: e.target.value } })} placeholder="Instruções (opcional). Ex: enviar o comprovante após pagar" style={{ ...miniInput, marginBottom: 14 }} />

          {parcelas.length === 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: C.faint }}>Gerar</span>
              <input
                type="number" value={genCount} onChange={(e) => setGenCount(e.target.value)}
                style={{ width: 50, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 8px", color: C.paper, fontSize: 12.5, outline: "none" }}
              />
              <span style={{ fontSize: 11.5, color: C.faint }}>parcelas a partir de</span>
              <input
                type="date" value={genFirstDate} onChange={(e) => setGenFirstDate(e.target.value)}
                style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 8px", color: C.paper, fontSize: 12.5, outline: "none", colorScheme: "dark" }}
              />
              <button
                onClick={generateParcelas}
                style={{ background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 6, padding: "6px 10px", color: C.amber, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
              >
                Gerar
              </button>
            </div>
          )}

          <div style={{ fontSize: 11, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3, marginBottom: 8 }}>
            PARCELAS ({parcelas.length})
          </div>
          {parcelas.map((p) => (
            <div key={p.id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}>
              <button
                onClick={() => updateParcela(p.id, { pago: !p.pago, pagoEm: !p.pago ? new Date().toISOString() : null })}
                title={p.pago ? "Marcar como pendente" : "Marcar como pago"}
                className={`pop-check${p.pago ? " checked" : ""}`}
                style={{ background: "transparent", border: "none", color: p.pago ? C.sage : C.faint, cursor: "pointer", flexShrink: 0 }}
              >
                {p.pago ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              </button>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.faint, width: 20 }}>{String(p.numero).padStart(2, "0")}</span>
              <input
                type="number" value={p.valor} onChange={(e) => updateParcela(p.id, { valor: e.target.value })}
                placeholder="Valor"
                style={{ flex: 1, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, padding: "7px 9px", color: C.paper, fontSize: 12.5, outline: "none" }}
              />
              <input
                type="date" value={p.vencimento} onChange={(e) => updateParcela(p.id, { vencimento: e.target.value })}
                style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, padding: "7px 9px", color: C.paper, fontSize: 12.5, outline: "none", colorScheme: "dark" }}
              />
              {p.pago && (
                <button onClick={() => exportReceiptPDF({ issuer, clientName, clientDoc, plan, parcela: p })} title="Baixar recibo em PDF" style={{ display: "grid", placeItems: "center", minWidth: 32, minHeight: 32, background: "transparent", border: "none", color: C.amber, cursor: "pointer", flexShrink: 0 }}>
                  <FileDown size={16} />
                </button>
              )}
              {!p.pago && waDigits(clientPhone) && (
                <a
                  href={waParcelaLink(clientPhone, clientName, plan, p, link)}
                  target="_blank" rel="noreferrer" title="Lembrar pelo WhatsApp"
                  style={{ display: "grid", placeItems: "center", minWidth: 32, minHeight: 32, color: C.sage, flexShrink: 0 }}
                >
                  <MessageCircle size={16} />
                </a>
              )}
              <IconButton onClick={() => removeParcela(p.id)} tone="brick" size={28}><Trash2 size={13} /></IconButton>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", paddingLeft: 52 }}>
              <input value={p.boleto || ""} onChange={(e) => updateParcela(p.id, { boleto: e.target.value })} placeholder="Linha digitável do boleto (opcional)" inputMode="numeric" style={{ ...miniInput, fontFamily: FONT_MONO, fontSize: 11.5 }} />
              {(p.comprovantes || []).length > 0 && (
                <button onClick={() => openComprovante(p.comprovantes[p.comprovantes.length - 1])} title="Ver comprovante enviado pelo cliente" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32, padding: "0 10px", borderRadius: 16, border: `1px solid ${C.amber}`, background: C.amberDim, color: C.amber, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                  <Paperclip size={12} /> {p.comprovantes.length}
                </button>
              )}
            </div>
            {!p.pago && (asaasOn || p.asaasUrl) && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", paddingLeft: 52, marginTop: 6, flexWrap: "wrap" }}>
                {p.asaasUrl ? (
                  <>
                    <a href={p.asaasUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 32, padding: "0 10px", borderRadius: 16, border: `1px solid ${C.sage}`, background: C.sageDim, color: C.sage, fontSize: 12, fontWeight: 600, textDecoration: "none" }}><Zap size={12} /> Cobrança Asaas <ExternalLink size={11} /></a>
                  </>
                ) : (
                  <button disabled={asaasBusy === p.id} onClick={() => createCharge(p)} style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 32, padding: "0 12px", borderRadius: 16, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    <Zap size={12} /> {asaasBusy === p.id ? "Criando…" : "Gerar cobrança (Pix, boleto, cartão)"}
                  </button>
                )}
              </div>
            )}
            </div>
          ))}
          {asaasMsg && <div style={{ fontSize: 12, marginBottom: 10, color: /Falha|Cadastre|Informe|Chave|permiss|Erro|inv|Conecte/i.test(asaasMsg) ? C.brick : C.sage }}>{asaasMsg}</div>}
          {asaasOn && parcelas.length > 0 && (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.paper, marginBottom: 2 }}>Avisar o cliente pelo Asaas</div>
              <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.45, marginBottom: 6 }}>
                Desligado por padrão. Combine com o cliente antes de ativar. Até 3 avisos por cobrança (criação, vencimento, atraso); WhatsApp e SMS têm custo, descontado do que você recebe (veja os valores em Minha conta).
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {[["email", "E-mail"], ["whatsapp", "WhatsApp"], ["sms", "SMS"]].map(([k, l]) => (
                  <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.paper, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!avisos[k]} onChange={(e) => setAviso(k, e.target.checked)} style={{ width: 16, height: 16 }} /> {l}
                  </label>
                ))}
              </div>
              {avisoMsg && <div style={{ fontSize: 12, marginTop: 6, color: /Falha|Erro|permiss|Conecte/i.test(avisoMsg) ? C.brick : C.sage }}>{avisoMsg}</div>}
            </div>
          )}
          {!asaasOn && asaasSt && parcelas.length > 0 && <div style={{ fontSize: 12, color: C.faint, marginBottom: 10 }}>Para gerar Pix, boleto e cartão automáticos, conecte o Asaas em Minha conta.</div>}
          <button
            onClick={addParcela}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px dashed ${C.line}`, borderRadius: 7, padding: "7px 11px", color: C.muted, fontSize: 12.5, cursor: "pointer", marginBottom: 14 }}
          >
            <Plus size={13} /> Adicionar parcela
          </button>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
            <span style={{ fontSize: 12.5, color: C.muted }}>
              {plan.share_enabled ? "Cliente pode ver este pagamento" : "Link de acompanhamento pro cliente"}
            </span>
            <button
              onClick={() => patch({ share_enabled: !plan.share_enabled })}
              style={{ display: "flex", alignItems: "center", gap: 8, background: plan.share_enabled ? C.amberDim : C.panel, border: `1px solid ${plan.share_enabled ? C.amber : C.line}`, borderRadius: 20, padding: "5px 10px 5px 5px", cursor: "pointer" }}
            >
              <div style={{ width: 28, height: 16, borderRadius: 9, background: plan.share_enabled ? C.amber : C.line, position: "relative" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.ink, position: "absolute", top: 2, left: plan.share_enabled ? 14 : 2, transition: "left 0.3s cubic-bezier(0.32,0.72,0,1)" }} />
              </div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: plan.share_enabled ? C.amber : C.muted }}>{plan.share_enabled ? "ATIVO" : "INATIVO"}</span>
            </button>
          </div>
          {plan.share_enabled && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <div style={{ flex: 1, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", color: C.muted, fontFamily: FONT_MONO, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {link}
              </div>
              <CopyLinkButton link={link} />
            </div>
          )}

          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: C.muted }}>
                <Mail size={14} /> Avisar o cliente por e-mail
              </span>
              <button
                onClick={() => patch({ notify_enabled: !plan.notify_enabled })}
                style={{ display: "flex", alignItems: "center", gap: 8, background: plan.notify_enabled ? C.amberDim : C.panel, border: `1px solid ${plan.notify_enabled ? C.amber : C.line}`, borderRadius: 20, padding: "5px 10px 5px 5px", cursor: "pointer" }}
              >
                <div style={{ width: 28, height: 16, borderRadius: 9, background: plan.notify_enabled ? C.amber : C.line, position: "relative" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.ink, position: "absolute", top: 2, left: plan.notify_enabled ? 14 : 2, transition: "left 0.3s cubic-bezier(0.32,0.72,0,1)" }} />
                </div>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: plan.notify_enabled ? C.amber : C.muted }}>{plan.notify_enabled ? "ATIVO" : "INATIVO"}</span>
              </button>
            </div>
            {plan.notify_enabled && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: C.muted }}>
                  <span>Enviar</span>
                  <input
                    type="number" min="1" max="60"
                    value={plan.notify_days_before ?? 3}
                    onChange={(e) => patch({ notify_days_before: e.target.value === "" ? "" : Math.max(1, Math.min(60, Number(e.target.value))) })}
                    style={{ width: 60, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 8px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13, outline: "none", textAlign: "center" }}
                  />
                  <span>dia(s) antes do vencimento, no dia e 1 dia depois se não estiver paga.</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: clientEmail ? C.faint : C.brick }}>
                  {clientEmail ? `Para: ${clientEmail}` : "Este cliente não tem e-mail cadastrado. Adicione na ficha do cliente para os avisos funcionarem."}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <button
                    disabled={testState === "sending"}
                    onClick={sendTestEmail}
                    style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 11px", color: C.muted, fontSize: 12, fontFamily: FONT_BODY, cursor: "pointer" }}
                  >
                    {testState === "sending" ? "Enviando..." : "Enviar e-mail de teste pra mim"}
                  </button>
                  {testState === "ok" && <span style={{ fontSize: 12, color: C.sage }}>Enviado! Confira sua caixa de entrada.</span>}
                  {testState && testState !== "ok" && testState !== "sending" && <span style={{ fontSize: 12, color: C.brick }}>{testState}</span>}
                </div>
                <div style={{ marginTop: 8, fontSize: 11.5, color: C.faint }}>Lembre de clicar em Salvar para valer a configuração.</div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: saved ? C.sageDim : C.panel2, border: `1px solid ${saved ? C.sage : C.line}`,
                borderRadius: 8, padding: "8px 14px", color: saved ? C.sage : C.muted,
                fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : saved ? <Check size={13} /> : <Save size={13} />}
              {saved ? "Salvo" : "Salvar"}
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 14px", color: C.brick, fontSize: 12.5, fontFamily: FONT_BODY, cursor: "pointer" }}
            >
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </div>
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title="Excluir plano de pagamento?"
          message={`"${plan.titulo || "Este plano"}" e todas as parcelas vão ser apagados. Se o link estiver ativo, ele para de funcionar.`}
          confirmLabel="Excluir"
          danger
          onConfirm={() => { setConfirmingDelete(false); onDelete(); }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

export function PaymentPlansSection({ plans, clientEmail, clientPhone, clientName, clientDoc, issuer, onAdd, onChange, onSave, onDelete }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <CreditCard size={15} color={C.faint} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.5 }}>
            PAGAMENTOS ({plans.length})
          </span>
        </div>
        <button
          onClick={onAdd}
          style={{ display: "flex", alignItems: "center", gap: 5, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 7, padding: "6px 10px", color: C.amber, fontSize: 11.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer" }}
        >
          <Plus size={12} /> Plano de pagamento
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {plans.length === 0 && (
          <div style={{ color: C.faint, fontSize: 13, padding: "10px 4px" }}>Nenhum plano de pagamento ainda.</div>
        )}
        {plans.map((plan) => (
          <PaymentPlanRow
            key={plan.id}
            plan={plan}
            clientEmail={clientEmail}
            clientPhone={clientPhone}
            clientName={clientName}
            clientDoc={clientDoc}
            issuer={issuer}
            onChange={(next) => onChange(plan.id, next)}
            onSave={() => onSave(plan.id)}
            onDelete={() => onDelete(plan.id)}
          />
        ))}
      </div>
    </div>
  );
}

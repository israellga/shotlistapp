import React, { useState } from "react";
import { Plus, Trash2, Check, Copy, ChevronDown, ChevronRight, Save, Loader2, CreditCard, Circle, CheckCircle2 } from "lucide-react";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";
import { IconButton, ConfirmDialog } from "./ui";
import { formatBRL } from "./finance";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyPaymentPlan(clientId) {
  return { id: uid(), client_id: clientId, titulo: "", valor_total: "", parcelas: [], share_enabled: false };
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

export function PaymentPlanRow({ plan, onChange, onSave, onDelete }) {
  const [expanded, setExpanded] = useState(!plan.titulo);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [genCount, setGenCount] = useState(3);
  const [genFirstDate, setGenFirstDate] = useState("");

  function patch(fields) { onChange({ ...plan, ...fields }); }
  const parcelas = plan.parcelas || [];
  const t = planTotals(plan);

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
      <div onClick={() => setExpanded((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {plan.titulo || "Sem título"}
          </div>
          <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, marginTop: 2 }}>
            {formatBRL(t.pago)} / {formatBRL(t.total)} · {t.countPagas}/{t.count} parcelas
          </div>
        </div>
        {expanded ? <ChevronDown size={15} color={C.faint} /> : <ChevronRight size={15} color={C.faint} />}
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
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
            <div key={p.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <button
                onClick={() => updateParcela(p.id, { pago: !p.pago })}
                title={p.pago ? "Marcar como pendente" : "Marcar como pago"}
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
              <IconButton onClick={() => removeParcela(p.id)} tone="brick" size={28}><Trash2 size={13} /></IconButton>
            </div>
          ))}
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
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.ink, position: "absolute", top: 2, left: plan.share_enabled ? 14 : 2, transition: "left 0.15s" }} />
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

export function PaymentPlansSection({ plans, onAdd, onChange, onSave, onDelete }) {
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
            onChange={(next) => onChange(plan.id, next)}
            onSave={() => onSave(plan.id)}
            onDelete={() => onDelete(plan.id)}
          />
        ))}
      </div>
    </div>
  );
}

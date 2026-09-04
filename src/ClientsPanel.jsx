import React from "react";
import {
  Plus, Trash2, ArrowLeft, ChevronRight, ChevronDown, Save, Check, Loader2,
  Building2, Phone, Mail, FileText, User,
} from "lucide-react";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";
import { Field, IconButton, EditableTitle } from "./ui";
import { ClientBalanceSummary, FinanceSection } from "./finance";
import { PaymentPlansSection } from "./payments";
import { maskPhone, maskCEP, maskCNPJ, lookupCEP } from "./masks";

export function ClientsList({ clients, onOpen, onDelete, currentClientId }) {
  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return (
    <div style={{ paddingBottom: 10 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.5, margin: "0 4px 14px" }}>
        CLIENTES ({clients.length})
      </div>
      {sorted.length === 0 && (
        <div style={{ color: C.faint, fontSize: 13.5, padding: "40px 8px", textAlign: "center" }}>
          <Building2 size={24} color={C.line} style={{ marginBottom: 10 }} />
          <div>Nenhum cliente ainda.</div>
          <div>Cadastre pra organizar as produções por cliente.</div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((c) => (
          <div
            key={c.id}
            onClick={() => onOpen(c.id)}
            style={{
              background: currentClientId === c.id ? C.panel2 : C.panel,
              border: `1px solid ${currentClientId === c.id ? C.amber : C.line}`,
              borderRadius: 10, padding: "13px 14px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 8, background: C.panel2, display: "grid",
              placeItems: "center", flexShrink: 0, color: C.amber, fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600,
            }}>
              {(c.name || "?").trim().charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, color: C.paper, fontWeight: 600, fontFamily: FONT_BODY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.name || "Sem nome"}
              </div>
              {c.responsavel && (
                <div style={{ fontSize: 12, color: C.faint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Responsável: {c.responsavel}
                </div>
              )}
            </div>
            <IconButton onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} tone="brick" size={28} title="Excluir cliente">
              <Trash2 size={14} />
            </IconButton>
            <ChevronRight size={16} color={C.faint} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClientDetail({
  client, onChange, onSaveNow, onBack, onDelete, productions, onOpenProduction, onAddProduction, showBack, isGestor, financeMap,
  financeRecords, onAddFinanceRecord, onChangeFinanceRecord, onSaveFinanceRecord, onDeleteFinanceRecord,
  paymentPlans, onAddPaymentPlan, onChangePaymentPlan, onSavePaymentPlan, onDeletePaymentPlan,
}) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [lookingUpCep, setLookingUpCep] = React.useState(false);

  function patch(fields) { onChange({ ...client, ...fields }); }

  async function handleCepBlur() {
    const digits = (client.cep || "").replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLookingUpCep(true);
    const addr = await lookupCEP(client.cep);
    setLookingUpCep(false);
    if (addr) patch(addr);
  }

  async function handleSave() {
    setSaving(true);
    await onSaveNow();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 4px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
        {showBack && (
          <IconButton onClick={onBack} tone="paper" title="Voltar"><ArrowLeft size={19} /></IconButton>
        )}
        <EditableTitle value={client.name} onChange={(v) => patch({ name: v })} placeholder="Nome do cliente" />
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            background: saved ? C.sageDim : C.panel2, border: `1px solid ${saved ? C.sage : C.line}`,
            borderRadius: 8, padding: "8px 12px", color: saved ? C.sage : C.muted,
            fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? "Salvo" : "Salvar"}
        </button>
        <IconButton onClick={() => onDelete(client.id)} tone="brick" title="Excluir cliente"><Trash2 size={17} /></IconButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Field label="Responsável" value={client.responsavel || ""} onChange={(v) => patch({ responsavel: v })} placeholder="Nome de quem responde por esse cliente" />
        <Field label="Telefone" value={client.phone || ""} onChange={(v) => patch({ phone: maskPhone(v) })} placeholder="(11) 99999-9999" mono />
        <Field label="Email" value={client.email || ""} onChange={(v) => patch({ email: v })} placeholder="contato@cliente.com" mono />
        <Field label="CNPJ" value={client.cnpj || ""} onChange={(v) => patch({ cnpj: maskCNPJ(v) })} placeholder="00.000.000/0000-00" mono />
      </div>

      <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.faint, letterSpacing: 0.3, marginBottom: 8, marginTop: 4 }}>
        ENDEREÇO
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
          <span style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3 }}>CEP</span>
          <input
            value={client.cep || ""}
            onChange={(e) => patch({ cep: maskCEP(e.target.value) })}
            onBlur={handleCepBlur}
            placeholder="00000-000"
            style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "9px 11px", color: C.paper, fontFamily: FONT_MONO, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" }}
          />
          {lookingUpCep && (
            <Loader2 size={13} color={C.faint} style={{ position: "absolute", right: 10, top: 34, animation: "spin 1s linear infinite" }} />
          )}
        </label>
        <Field label="Cidade" value={client.cidade || ""} onChange={(v) => patch({ cidade: v })} placeholder="Cidade" style={{ gridColumn: "span 2" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Field label="Logradouro" value={client.logradouro || ""} onChange={(v) => patch({ logradouro: v })} placeholder="Rua, avenida..." />
        <Field label="Número" value={client.numero || ""} onChange={(v) => patch({ numero: v })} placeholder="123" />
        <Field label="Estado" value={client.estado || ""} onChange={(v) => patch({ estado: v.toUpperCase().slice(0, 2) })} placeholder="UF" mono />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Field label="Bairro" value={client.bairro || ""} onChange={(v) => patch({ bairro: v })} placeholder="Bairro" />
        <Field label="Complemento" value={client.complemento || ""} onChange={(v) => patch({ complemento: v })} placeholder="Sala, andar, referência..." />
      </div>
      <Field
        label="Observações"
        value={client.notes || ""}
        onChange={(v) => patch({ notes: v })}
        placeholder="Preferências, histórico, combinados gerais..."
        multiline
        style={{ marginBottom: 24 }}
      />

      {isGestor && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.5, marginBottom: 10 }}>
            BALANCETE
          </div>
          <ClientBalanceSummary productions={productions} financeMap={financeMap || {}} financeRecords={financeRecords || []} />
        </div>
      )}

      {isGestor && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.5, flex: 1 }}>
              REGISTROS FINANCEIROS ({(financeRecords || []).length})
            </div>
            <button
              onClick={onAddFinanceRecord}
              style={{ display: "flex", alignItems: "center", gap: 5, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 7, padding: "6px 10px", color: C.amber, fontSize: 11.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer" }}
            >
              <Plus size={12} /> Registro financeiro
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5, marginTop: -4, marginBottom: 10 }}>
            Pra lançar valores de trabalhos passados sem precisar criar uma produção com shotlist.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(financeRecords || []).length === 0 && (
              <div style={{ color: C.faint, fontSize: 13, padding: "10px 4px" }}>Nenhum registro financeiro ainda.</div>
            )}
            {(financeRecords || []).map((rec) => (
              <FinanceRecordRow
                key={rec.id}
                record={rec}
                onChange={(next) => onChangeFinanceRecord(rec.id, next)}
                onSave={() => onSaveFinanceRecord(rec.id)}
                onDelete={() => onDeleteFinanceRecord(rec.id)}
              />
            ))}
          </div>
        </div>
      )}

      {isGestor && (
        <div style={{ marginBottom: 24 }}>
          <PaymentPlansSection
            plans={paymentPlans || []}
            onAdd={onAddPaymentPlan}
            onChange={onChangePaymentPlan}
            onSave={onSavePaymentPlan}
            onDelete={onDeletePaymentPlan}
          />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.5, flex: 1 }}>
          PRODUÇÕES ({productions.length})
        </div>
        <button
          onClick={onAddProduction}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 10px", color: C.muted, fontSize: 11.5, fontFamily: FONT_BODY, cursor: "pointer" }}
        >
          <Plus size={12} /> Nova produção
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {productions.length === 0 && (
          <div style={{ color: C.faint, fontSize: 13.5, padding: "16px 4px" }}>
            Nenhuma produção vinculada a este cliente ainda.
          </div>
        )}
        {productions.map((p) => (
          <div
            key={p.id}
            onClick={() => onOpenProduction(p.id)}
            style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
          >
            <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.paper }}>{p.cliente || "Sem nome"}</div>
            <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO }}>{p.data || "sem data"}</div>
            <ChevronRight size={15} color={C.faint} />
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function FinanceRecordRow({ record, onChange, onSave, onDelete }) {
  const [expanded, setExpanded] = React.useState(!record.label);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  function patch(fields) { onChange({ ...record, ...fields }); }

  async function handleSave() {
    setSaving(true);
    await onSave();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "12px 14px" }}>
      <div onClick={() => setExpanded((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {record.label || "Sem descrição"}
        </div>
        <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO }}>{record.data || "sem data"}</div>
        {expanded ? <ChevronDown size={15} color={C.faint} /> : <ChevronRight size={15} color={C.faint} />}
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 10 }}>
            <input
              value={record.label}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder="Descrição (ex: Sessão de fotos - Agosto)"
              style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13, outline: "none" }}
            />
            <input
              type="date"
              value={record.data}
              onChange={(e) => patch({ data: e.target.value })}
              style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13, outline: "none", colorScheme: "dark" }}
            />
          </div>

          <FinanceSection finance={record} onChange={(next) => onChange({ ...record, ...next })} />

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
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
              onClick={onDelete}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 14px", color: C.brick, fontSize: 12.5, fontFamily: FONT_BODY, cursor: "pointer" }}
            >
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientPickerInline({ clients, valueId, onSelect }) {
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  if (creating) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome do novo cliente"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              onSelect({ createName: newName.trim() });
              setCreating(false);
              setNewName("");
            }
            if (e.key === "Escape") setCreating(false);
          }}
          style={{ flex: 1, background: C.panel2, border: `1px solid ${C.amber}`, borderRadius: 7, padding: "8px 10px", color: C.paper, fontSize: 13.5, fontFamily: FONT_BODY, outline: "none" }}
        />
        <button
          onClick={() => { if (newName.trim()) { onSelect({ createName: newName.trim() }); setCreating(false); setNewName(""); } }}
          style={{ background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 7, padding: "8px 12px", color: C.amber, fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer" }}
        >
          Criar
        </button>
      </div>
    );
  }

  return (
    <select
      value={valueId || ""}
      onChange={(e) => {
        if (e.target.value === "__new__") setCreating(true);
        else onSelect({ id: e.target.value || null });
      }}
      style={{
        background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
        padding: "9px 11px", color: C.paper, fontSize: 14, fontFamily: FONT_BODY, outline: "none",
        width: "100%", boxSizing: "border-box", colorScheme: "dark",
      }}
    >
      <option value="">Sem cliente vinculado</option>
      {sorted.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      <option value="__new__">+ Novo cliente...</option>
    </select>
  );
}

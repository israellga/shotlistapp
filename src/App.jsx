import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Users, Clock,
  ExternalLink, ArrowLeft, CheckCircle2, Circle, PlayCircle,
  Loader2, AlertCircle, Wifi, WifiOff, LogOut, Share2, Copy, Check, Save, KeyRound,
  Building2, Phone, Mail, FileText, Menu, X as XIcon, FileDown, ShieldCheck, DollarSign,
} from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import AuthScreen from "./AuthScreen";
import AccountPanel from "./AccountPanel";
import ShotlistMark from "./ShotlistMark";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";
import { formatDataComDiaSemana, formatHorario, horarioMinutos } from "./datetime";
import {
  uid, IconButton, Field, DateField, selectFieldStyle, selectInlineStyle,
  inputInlineStyle, dashedAddStyle, ConfirmDialog, EditableTitle,
} from "./ui";
import { ClientsList, ClientDetail, ClientPickerInline } from "./ClientsPanel";
import { fetchThumbnail } from "./thumbnail";
import { exportProductionPDF } from "./pdfExport";
import AccountsPanel from "./AccountsPanel";
import { FinanceSection, ClientBalanceSummary, totalCustos } from "./finance";
import { ProductionsDashboard, ClientsDashboard } from "./dashboards";
import { saveDraft, loadDraft, clearDraft, getDraftIndex } from "./draftStorage";

const TABLE = "productions";
const TABLE_CLIENTS = "clients";

const STATUS = {
  afazer: { label: "A fazer", color: C.muted, bg: "transparent", border: C.line },
  andamento: { label: "Em andamento", color: C.amber, bg: C.amberDim, border: C.amber },
  concluido: { label: "Concluído", color: C.sage, bg: C.sageDim, border: C.sage },
};
const STATUS_ORDER = ["afazer", "andamento", "concluido"];

function emptyProduction() {
  return {
    id: uid(),
    cliente: "",
    clienteId: null,
    data: "",
    responsavel: "",
    objetivoDia: "",
    equipe: [],
    cronograma: [],
    shots: [],
    clientShareEnabled: false,
  };
}

function emptyShot(n) {
  return {
    id: uid(), numero: n, nome: "", contexto: "", tipo: "",
    objetivo: "", equipamentos: [], equipamentoOutro: "", plano: "", lente: "",
    referencia: "", status: "afazer", takes: [],
  };
}

function emptyTake(n) {
  return { id: uid(), numero: n, acao: "", transicao: "", tempo: "", feito: false };
}

// ---------------------------------------------------------------------------
// Domain constants
// ---------------------------------------------------------------------------

const FUNCOES_PADRAO = [
  "Diretor(a)", "Produtor(a)", "Roteiro", "Ator/Atriz", "Fotógrafo(a)",
  "Assistente de câmera", "Assistente de set", "Videomaker", "Storymaker",
  "Editor(a)", "Gaffer", "Maquiagem", "Som/Áudio", "Motorista", "Catering",
];

const TIPOS_PRODUCAO = ["Foto", "Reels", "Curta", "Stopmotion"];

const EQUIPAMENTOS_PADRAO = [
  "Câmera", "Tripé de câmera", "LED", "Tripé de luz", "Microfone",
  "Softbox", "Panela", "Rebatedor", "Gimbal", "Slider", "Drone",
];

const TABLE_TEAM = "team_members";

function StatusPill({ status, onCycle, big }) {
  const s = STATUS[status];
  return (
    <button
      onClick={onCycle}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: big ? "8px 14px" : "5px 10px", borderRadius: 20,
        border: `1px solid ${s.border}`, background: s.bg, color: s.color,
        fontFamily: FONT_MONO, fontSize: big ? 13 : 11.5, fontWeight: 600,
        letterSpacing: 0.3, cursor: "pointer", whiteSpace: "nowrap",
      }}
      title="Clique para mudar o status"
    >
      {status === "concluido" ? <CheckCircle2 size={big ? 16 : 13} /> : status === "andamento" ? <PlayCircle size={big ? 16 : 13} /> : <Circle size={big ? 16 : 13} />}
      {s.label}
    </button>
  );
}

function cycleStatus(current) {
  const i = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}

// ---------------------------------------------------------------------------
// Take row
// ---------------------------------------------------------------------------

function TakeRow({ take, fieldMode, onChange, onDelete }) {
  if (fieldMode) {
    return (
      <div
        onClick={() => onChange({ ...take, feito: !take.feito })}
        style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 4px",
          borderBottom: `1px solid ${C.lineSoft}`, cursor: "pointer", opacity: take.feito ? 0.5 : 1,
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 7, border: `2px solid ${take.feito ? C.sage : C.line}`,
          background: take.feito ? C.sage : "transparent", display: "grid", placeItems: "center",
          flexShrink: 0, marginTop: 1,
        }}>
          {take.feito && <CheckCircle2 size={16} color={C.ink} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.amber, marginBottom: 3 }}>
            TAKE {String(take.numero).padStart(2, "0")}
            {take.tempo && <span style={{ color: C.faint }}> · {take.tempo}</span>}
          </div>
          <div style={{ fontSize: 14.5, color: C.paper, textDecoration: take.feito ? "line-through" : "none", lineHeight: 1.4 }}>
            {take.acao || <span style={{ color: C.faint }}>(sem descrição)</span>}
          </div>
          {take.transicao && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>→ {take.transicao}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "44px 1fr 1fr 90px 30px", gap: 8,
      alignItems: "start", padding: "8px 0", borderBottom: `1px solid ${C.lineSoft}`,
    }}>
      <div style={{ fontFamily: FONT_MONO, color: C.amber, fontSize: 13, paddingTop: 8 }}>
        {String(take.numero).padStart(2, "0")}
      </div>
      <textarea
        value={take.acao}
        onChange={(e) => onChange({ ...take, acao: e.target.value })}
        placeholder="Ação do take..."
        rows={2}
        style={{ background: "transparent", border: "none", color: C.paper, fontSize: 13.5, fontFamily: FONT_BODY, resize: "vertical", outline: "none", padding: "6px 4px" }}
      />
      <textarea
        value={take.transicao}
        onChange={(e) => onChange({ ...take, transicao: e.target.value })}
        placeholder="Transição / efeito..."
        rows={2}
        style={{ background: "transparent", border: "none", color: C.paper, fontSize: 13.5, fontFamily: FONT_BODY, resize: "vertical", outline: "none", padding: "6px 4px" }}
      />
      <input
        value={take.tempo}
        onChange={(e) => onChange({ ...take, tempo: e.target.value })}
        placeholder="tempo"
        style={{ background: "transparent", border: "none", color: C.muted, fontSize: 12.5, fontFamily: FONT_MONO, outline: "none", padding: "8px 4px" }}
      />
      <div style={{ paddingTop: 4 }}>
        <IconButton onClick={onDelete} tone="brick" size={26} title="Remover take">
          <Trash2 size={14} />
        </IconButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shot card
// ---------------------------------------------------------------------------

function EquipmentPicker({ value, outro, onChange, onChangeOutro }) {
  const selected = value || [];
  function toggle(item) {
    onChange(selected.includes(item) ? selected.filter((x) => x !== item) : [...selected, item]);
  }
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {EQUIPAMENTOS_PADRAO.map((item) => {
          const on = selected.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 20,
                border: `1px solid ${on ? C.amber : C.line}`, background: on ? C.amberDim : C.panel2,
                color: on ? C.amber : C.muted, fontSize: 12.5, fontFamily: FONT_BODY, cursor: "pointer",
              }}
            >
              {on ? <CheckCircle2 size={13} /> : <Circle size={13} />}
              {item}
            </button>
          );
        })}
      </div>
      <input
        value={outro || ""}
        onChange={(e) => onChangeOutro(e.target.value)}
        placeholder="Outro equipamento..."
        style={{ ...inputInlineStyle(1), width: "100%", marginTop: 8 }}
      />
    </div>
  );
}

function ShotCard({ shot, fieldMode, expanded, onToggle, onChange, onDelete }) {
  const doneCount = shot.takes.filter((t) => t.feito).length;
  const [thumbLoading, setThumbLoading] = useState(false);

  function updateTake(id, next) {
    const nextTakes = shot.takes.map((t) => (t.id === id ? next : t));
    const done = nextTakes.filter((t) => t.feito).length;
    const total = nextTakes.length;
    const status = total > 0 ? (done === 0 ? "afazer" : done === total ? "concluido" : "andamento") : shot.status;
    onChange({ ...shot, takes: nextTakes, status });
  }
  function addTake() {
    onChange({ ...shot, takes: [...shot.takes, emptyTake(shot.takes.length + 1)] });
  }
  function deleteTake(id) {
    onChange({ ...shot, takes: shot.takes.filter((t) => t.id !== id).map((t, i) => ({ ...t, numero: i + 1 })) });
  }

  async function attemptFetchThumbnail(url) {
    if (!url) return;
    setThumbLoading(true);
    const thumb = await fetchThumbnail(url);
    setThumbLoading(false);
    onChange({ ...shot, thumbnailUrl: thumb || shot.thumbnailUrl, thumbnailSourceUrl: url, thumbnailFailed: !thumb });
  }

  async function handleReferenciaBlur() {
    const url = (shot.referencia || "").trim();
    if (!url || url === shot.thumbnailSourceUrl) return;
    attemptFetchThumbnail(url);
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 20, color: C.faint, minWidth: 34 }}>
          {String(shot.numero).padStart(2, "0")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, color: C.paper, fontWeight: 600 }}>{shot.nome || "Sem nome"}</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>
            {shot.tipo && <span style={{ color: C.muted }}>{shot.tipo} · </span>}
            {shot.contexto || "Sem contexto"}
            {shot.takes.length > 0 && <span style={{ color: C.muted }}> · {doneCount}/{shot.takes.length} takes</span>}
          </div>
        </div>
        <StatusPill status={shot.status} onCycle={(e) => { e.stopPropagation(); onChange({ ...shot, status: cycleStatus(shot.status) }); }} />
        {!fieldMode && (
          <IconButton onClick={(e) => { e.stopPropagation(); onDelete(); }} tone="brick" title="Excluir shot">
            <Trash2 size={16} />
          </IconButton>
        )}
        {expanded ? <ChevronDown size={18} color={C.faint} /> : <ChevronRight size={18} color={C.faint} />}
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 18px", borderTop: `1px solid ${C.lineSoft}` }}>
          {!fieldMode && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16, marginBottom: 6 }}>
              <Field label="Nome do prato / peça" value={shot.nome} onChange={(v) => onChange({ ...shot, nome: v })} placeholder="Ex: Garden" />
              <Field label="Contexto" value={shot.contexto} onChange={(v) => onChange({ ...shot, contexto: v })} placeholder="Ex: Magic phone transition" />
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3 }}>Tipo de produção</span>
                <select value={shot.tipo} onChange={(e) => onChange({ ...shot, tipo: e.target.value })} style={selectFieldStyle()}>
                  <option value="">Selecionar...</option>
                  {TIPOS_PRODUCAO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <Field label="Plano" value={shot.plano} onChange={(v) => onChange({ ...shot, plano: v })} placeholder="Ex: Plano médio, zenital..." />
              <Field label="Lente" value={shot.lente} onChange={(v) => onChange({ ...shot, lente: v })} placeholder="Ex: 35mm, macro..." />
              <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3 }}>Equipamento</span>
                <EquipmentPicker
                  value={shot.equipamentos}
                  outro={shot.equipamentoOutro}
                  onChange={(list) => onChange({ ...shot, equipamentos: list })}
                  onChangeOutro={(v) => onChange({ ...shot, equipamentoOutro: v })}
                />
              </label>
              <Field label="Roteiro" value={shot.objetivo} onChange={(v) => onChange({ ...shot, objetivo: v })} placeholder="Como a cena se desenrola, passo a passo" multiline style={{ gridColumn: "1 / -1" }} />
              <Field
                label="Referência (link)"
                value={shot.referencia}
                onChange={(v) => onChange({ ...shot, referencia: v })}
                onBlur={handleReferenciaBlur}
                placeholder="https://instagram.com/..."
                mono
                style={{ gridColumn: "1 / -1" }}
              />
              {(thumbLoading || shot.thumbnailUrl || (shot.referencia && shot.thumbnailFailed)) && (
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10 }}>
                  {thumbLoading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.faint, fontSize: 12 }}>
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Buscando miniatura...
                    </div>
                  ) : shot.thumbnailUrl ? (
                    <>
                      <img src={shot.thumbnailUrl} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.line}` }} />
                      <span style={{ fontSize: 11.5, color: C.faint }}>Miniatura da referência</span>
                      <button
                        onClick={() => attemptFetchThumbnail(shot.referencia.trim())}
                        style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 9px", color: C.muted, fontSize: 11, cursor: "pointer", marginLeft: "auto" }}
                      >
                        Atualizar
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 11.5, color: C.faint }}>Não consegui buscar a miniatura dessa referência.</span>
                      <button
                        onClick={() => attemptFetchThumbnail(shot.referencia.trim())}
                        style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 9px", color: C.amber, fontSize: 11, cursor: "pointer", marginLeft: "auto" }}
                      >
                        Tentar de novo
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {fieldMode && shot.referencia && (
            <a href={shot.referencia} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, textDecoration: "none" }}>
              {shot.thumbnailUrl && (
                <img src={shot.thumbnailUrl} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.line}`, flexShrink: 0 }} />
              )}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: C.amber }}>
                Ver referência <ExternalLink size={12} />
              </span>
            </a>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.faint, letterSpacing: 0.5, marginBottom: 6 }}>
              SHOTLIST — {shot.takes.length} TAKE{shot.takes.length !== 1 ? "S" : ""}
            </div>
            {shot.takes.map((t) => (
              <TakeRow key={t.id} take={t} fieldMode={fieldMode} onChange={(next) => updateTake(t.id, next)} onDelete={() => deleteTake(t.id)} />
            ))}
            {!fieldMode && (
              <button onClick={addTake} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px dashed ${C.line}`, borderRadius: 7, padding: "8px 12px", color: C.muted, fontSize: 13, cursor: "pointer" }}>
                <Plus size={14} /> Adicionar take
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipe & Cronograma
// ---------------------------------------------------------------------------


function EquipeSection({ equipe, onChange, onKnowPerson }) {
  function update(id, patch) { onChange(equipe.map((m) => (m.id === id ? { ...m, ...patch } : m))); }
  function add() { onChange([...equipe, { id: uid(), funcao: FUNCOES_PADRAO[0], responsavel: "" }]); }
  function remove(id) { onChange(equipe.filter((m) => m.id !== id)); }
  return (
    <div>
      {equipe.map((m) => {
        const isCustom = m.funcao && !FUNCOES_PADRAO.includes(m.funcao);
        return (
          <div key={m.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            {isCustom ? (
              <input
                value={m.funcao}
                onChange={(e) => update(m.id, { funcao: e.target.value })}
                placeholder="Função"
                style={inputInlineStyle(1)}
              />
            ) : (
              <select
                value={m.funcao}
                onChange={(e) => update(m.id, { funcao: e.target.value === "__custom__" ? "" : e.target.value })}
                style={selectInlineStyle(1)}
              >
                {FUNCOES_PADRAO.map((f) => <option key={f} value={f}>{f}</option>)}
                <option value="__custom__">Outra função...</option>
              </select>
            )}
            <input
              value={m.responsavel}
              onChange={(e) => update(m.id, { responsavel: e.target.value })}
              onBlur={() => onKnowPerson && onKnowPerson(m.responsavel)}
              placeholder="Responsável"
              list="team-roster"
              style={inputInlineStyle(1)}
            />
            <IconButton onClick={() => remove(m.id)} tone="brick" size={30}><Trash2 size={14} /></IconButton>
          </div>
        );
      })}
      <button onClick={add} style={dashedAddStyle}><Plus size={14} /> Adicionar pessoa</button>
    </div>
  );
}

function CronogramaSection({ cronograma, onChange }) {
  function update(id, patch) { onChange(cronograma.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
  function add() { onChange([...cronograma, { id: uid(), horario: "", local: "", equipe: "", elenco: "", observacao: "" }]); }
  function remove(id) { onChange(cronograma.filter((c) => c.id !== id)); }
  const sorted = [...cronograma].sort((a, b) => horarioMinutos(a.horario) - horarioMinutos(b.horario));
  return (
    <div>
      {sorted.map((c) => (
        <div key={c.id} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <HorarioInput value={c.horario} onCommit={(v) => update(c.id, { horario: v })} />
            <input value={c.local} onChange={(e) => update(c.id, { local: e.target.value })} placeholder="Local" style={inputInlineStyle(2)} />
            <IconButton onClick={() => remove(c.id)} tone="brick" size={28}><Trash2 size={13} /></IconButton>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input value={c.equipe} onChange={(e) => update(c.id, { equipe: e.target.value })} placeholder="Equipe" style={inputInlineStyle(1)} />
            <input value={c.elenco} onChange={(e) => update(c.id, { elenco: e.target.value })} placeholder="Elenco" style={inputInlineStyle(1)} />
          </div>
          <input value={c.observacao} onChange={(e) => update(c.id, { observacao: e.target.value })} placeholder="Observação" style={{ ...inputInlineStyle(1), width: "100%" }} />
        </div>
      ))}
      <button onClick={add} style={dashedAddStyle}><Plus size={14} /> Adicionar horário</button>
    </div>
  );
}

function HorarioInput({ value, onCommit }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(formatHorario(local))}
      placeholder="10h30"
      style={{ ...inputInlineStyle(1), fontFamily: FONT_MONO, color: C.amber, textAlign: "center" }}
    />
  );
}

function CopyLinkButton({ link, big }) {
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — link is still visible to select manually */
    }
  }
  return (
    <button
      onClick={copyLink}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: copied ? C.sageDim : C.amberDim, border: `1px solid ${copied ? C.sage : C.amber}`,
        borderRadius: big ? 20 : 7, padding: big ? "9px 16px" : "8px 12px",
        color: copied ? C.sage : C.amber, fontSize: big ? 13 : 12.5, fontWeight: 600,
        cursor: "pointer", flexShrink: 0,
      }}
    >
      {copied ? <Check size={big ? 15 : 13} /> : <Copy size={big ? 15 : 13} />}
      {copied ? "Copiado" : big ? "Copiar link do cliente" : "Copiar"}
    </button>
  );
}

function ShareControl({ production, onChange }) {
  const enabled = !!production.clientShareEnabled;
  const link = `${window.location.origin}/?client=${production.id}`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enabled ? 12 : 0 }}>
        <span style={{ fontSize: 13, color: C.muted }}>
          {enabled ? "O cliente pode ver o andamento por este link" : "Gerar um link de acompanhamento pro cliente"}
        </span>
        <button
          onClick={() => onChange(!enabled)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: enabled ? C.amberDim : C.panel2, border: `1px solid ${enabled ? C.amber : C.line}`, borderRadius: 20, padding: "5px 10px 5px 5px", cursor: "pointer", flexShrink: 0 }}
        >
          <div style={{ width: 28, height: 16, borderRadius: 9, background: enabled ? C.amber : C.line, position: "relative" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.ink, position: "absolute", top: 2, left: enabled ? 14 : 2, transition: "left 0.15s" }} />
          </div>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: enabled ? C.amber : C.muted }}>{enabled ? "ATIVO" : "INATIVO"}</span>
        </button>
      </div>

      {enabled && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", color: C.muted, fontFamily: FONT_MONO, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {link}
          </div>
          <CopyLinkButton link={link} />
        </div>
      )}
      <p style={{ fontSize: 11.5, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
        O cliente vê só o nome e status de cada shot, sem detalhes internos de produção. Não precisa de login.
      </p>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen, count }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", cursor: "pointer" }}>
        {icon}
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.5, flex: 1 }}>
          {title.toUpperCase()}{typeof count === "number" && <span style={{ color: C.faint }}> ({count})</span>}
        </span>
        {open ? <ChevronDown size={16} color={C.faint} /> : <ChevronRight size={16} color={C.faint} />}
      </div>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Production detail
// ---------------------------------------------------------------------------

function ProductionDetail({ production, fieldMode, onChange, onSaveNow, onBack, roster, onKnowPerson, clients, onSelectClient, onOpenClient, showBack, isGestor, finance, onFinanceChange, onFinanceSaveNow }) {
  const [expandedShot, setExpandedShot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function patch(fields) { onChange({ ...production, ...fields }); }
  function updateShot(id, next) { patch({ shots: production.shots.map((s) => (s.id === id ? next : s)) }); }
  function addShot() {
    const s = emptyShot(production.shots.length + 1);
    patch({ shots: [...production.shots, s] });
    setExpandedShot(s.id);
  }
  function deleteShot(id) {
    patch({ shots: production.shots.filter((s) => s.id !== id).map((s, i) => ({ ...s, numero: i + 1 })) });
  }

  async function handleSave() {
    setSaving(true);
    await onSaveNow();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const totalTakes = production.shots.reduce((a, s) => a + s.takes.length, 0);
  const doneTakes = production.shots.reduce((a, s) => a + s.takes.filter((t) => t.feito).length, 0);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 4px 60px" }}>
      <datalist id="team-roster">
        {roster.map((n) => <option key={n} value={n} />)}
      </datalist>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        {showBack && (
          <IconButton onClick={onBack} tone="paper" title="Voltar"><ArrowLeft size={19} /></IconButton>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {fieldMode ? (
            <>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: C.paper }}>{production.cliente || "Produção sem nome"}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.faint }}>
                {formatDataComDiaSemana(production.data) || "sem data"}{totalTakes > 0 && <span> · {doneTakes}/{totalTakes} takes concluídos</span>}
              </div>
            </>
          ) : (
            <EditableTitle
              value={production.cliente}
              onChange={(v) => patch({ cliente: v })}
              placeholder="Nome do cliente / produção"
            />
          )}
        </div>
        {!fieldMode && (
          <button
            onClick={() => exportProductionPDF(production)}
            title="Exportar PDF"
            style={{
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8,
              padding: "8px 12px", color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            <FileDown size={14} /> PDF
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            background: saved ? C.sageDim : C.panel2, border: `1px solid ${saved ? C.sage : C.line}`,
            borderRadius: 8, padding: "8px 12px", color: saved ? C.sage : C.muted,
            fontSize: 12.5, fontWeight: 600, cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? "Salvo" : "Salvar"}
        </button>
      </div>

      {fieldMode && production.clientShareEnabled && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18, marginTop: -8 }}>
          <CopyLinkButton link={`${window.location.origin}/?client=${production.id}`} big />
        </div>
      )}

      {!fieldMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <ClientPickerInline
              clients={clients}
              valueId={production.clienteId}
              onSelect={(sel) => onSelectClient(sel)}
            />
          </div>
          {production.clienteId && (
            <button
              onClick={() => onOpenClient(production.clienteId)}
              style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 7, padding: "9px 12px", color: C.muted, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Ver cliente
            </button>
          )}
        </div>
      )}

      {!fieldMode && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <DateField label="Data" value={production.data} onChange={(v) => patch({ data: v })} />
          <Field
            label="Responsável"
            value={production.responsavel}
            onChange={(v) => patch({ responsavel: v })}
            onBlur={() => onKnowPerson && onKnowPerson(production.responsavel)}
            listId="team-roster"
            placeholder="Israel"
          />
        </div>
      )}

      {!fieldMode && (
        <Field
          label="Demanda"
          value={production.objetivoDia}
          onChange={(v) => patch({ objetivoDia: v })}
          placeholder="5 Reels + fotos"
          multiline
          autoGrow
          style={{ marginBottom: 18 }}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
        {!fieldMode && (
          <Section title="Equipe" icon={<Users size={15} color={C.faint} />} count={production.equipe.length}>
            <EquipeSection equipe={production.equipe} onChange={(equipe) => patch({ equipe })} onKnowPerson={onKnowPerson} />
          </Section>
        )}
        {!fieldMode && (
          <Section title="Ordem do dia" icon={<Clock size={15} color={C.faint} />} count={production.cronograma.length}>
            <CronogramaSection cronograma={production.cronograma} onChange={(cronograma) => patch({ cronograma })} />
          </Section>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", marginTop: 26, marginBottom: 12 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.5, flex: 1 }}>SHOTS ({production.shots.length})</span>
        {!fieldMode && (
          <button onClick={addShot} style={{ display: "flex", alignItems: "center", gap: 6, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 8, padding: "7px 12px", color: C.amber, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={14} /> Novo shot
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {production.shots.length === 0 && (
          <div style={{ color: C.faint, fontSize: 13.5, padding: "20px 4px", textAlign: "center" }}>
            Nenhum shot ainda. Adicione o primeiro pra montar a shotlist.
          </div>
        )}
        {production.shots.map((s) => (
          <ShotCard
            key={s.id}
            shot={s}
            fieldMode={fieldMode}
            expanded={expandedShot === s.id}
            onToggle={() => setExpandedShot(expandedShot === s.id ? null : s.id)}
            onChange={(next) => updateShot(s.id, next)}
            onDelete={() => deleteShot(s.id)}
          />
        ))}
      </div>

      {!fieldMode && (
        <Section title="Compartilhar com cliente" icon={<Share2 size={15} color={C.faint} />}>
          <ShareControl production={production} onChange={(v) => patch({ clientShareEnabled: v })} />
        </Section>
      )}

      {!fieldMode && isGestor && (
        <div style={{ marginTop: 12 }}>
          <Section title="Financeiro" icon={<DollarSign size={15} color={C.faint} />}>
            <FinanceSection
              finance={finance}
              onChange={onFinanceChange}
            />
            <SaveFinanceButton onSave={onFinanceSaveNow} />
          </Section>
        </div>
      )}
    </div>
  );
}

function SaveFinanceButton({ onSave }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  async function handle() {
    setSaving(true);
    setErrorMsg("");
    const error = await onSave();
    setSaving(false);
    if (error) {
      setErrorMsg(error.message || String(error));
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }
  return (
    <div>
      <button
        onClick={handle}
        disabled={saving}
        style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 14,
          background: saved ? C.sageDim : errorMsg ? C.brickDim : C.panel2,
          border: `1px solid ${saved ? C.sage : errorMsg ? C.brick : C.line}`,
          borderRadius: 8, padding: "8px 14px", color: saved ? C.sage : errorMsg ? C.brick : C.muted,
          fontSize: 12.5, fontWeight: 600, cursor: saving ? "default" : "pointer",
        }}
      >
        {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : saved ? <Check size={13} /> : <Save size={13} />}
        {saved ? "Salvo" : errorMsg ? "Erro ao salvar" : "Salvar financeiro"}
      </button>
      {errorMsg && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.brick, fontFamily: "monospace", wordBreak: "break-word" }}>
          {errorMsg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Production list
// ---------------------------------------------------------------------------

function ProductionCard({ p, selected, onOpen, onDelete }) {
  const totalTakes = p.shots.reduce((a, s) => a + s.takes.length, 0);
  const doneTakes = p.shots.reduce((a, s) => a + s.takes.filter((t) => t.feito).length, 0);
  const pct = totalTakes ? Math.round((doneTakes / totalTakes) * 100) : 0;
  return (
    <div onClick={onOpen} style={{ background: selected ? C.panel2 : C.panel, border: `1px solid ${selected ? C.amber : C.line}`, borderRadius: 10, padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 600, color: C.paper }}>{p.cliente || "Sem nome"}</div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 3, fontFamily: FONT_MONO }}>
          {formatDataComDiaSemana(p.data) || "sem data"} · {p.shots.length} shot{p.shots.length !== 1 ? "s" : ""}{totalTakes > 0 && ` · ${pct}% concluído`}
        </div>
      </div>
      <IconButton onClick={(e) => { e.stopPropagation(); onDelete(); }} tone="brick" title="Excluir produção"><Trash2 size={16} /></IconButton>
      <ChevronRight size={18} color={C.faint} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Responsive helper
// ---------------------------------------------------------------------------

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

function emptyClient() {
  return {
    id: uid(), name: "", responsavel: "", phone: "", email: "", notes: "",
    cnpj: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
  };
}

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out
  const [productions, setProductions] = useState({});
  const [order, setOrder] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [clients, setClients] = useState({});
  const [clientOrder, setClientOrder] = useState([]);
  const [currentClientId, setCurrentClientId] = useState(null);
  const [activeTab, setActiveTab] = useState("producoes"); // producoes | clientes
  const [fieldMode, setFieldMode] = useState(false);
  const [status, setStatus] = useState("boot"); // boot | loading | ready
  const [online, setOnline] = useState(true);
  const [roster, setRoster] = useState([]);
  const [showAccount, setShowAccount] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [myRole, setMyRole] = useState(null); // null until known: 'regular' | 'gestor'
  const [myStatus, setMyStatus] = useState(null); // 'pending' | 'approved' | 'rejected'
  const [showAccounts, setShowAccounts] = useState(false);
  const [financeMap, setFinanceMap] = useState({});
  const [financeRecords, setFinanceRecords] = useState({});
  const [financeRecordOrder, setFinanceRecordOrder] = useState([]);
  const isGestor = myRole === "gestor";
  const isWide = useMediaQuery("(min-width: 900px)");
  const saveTimers = useRef({});

  useEffect(() => {
    if (!supabaseConfigured) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setMyRole(null);
      setMyStatus(null);
      return;
    }
    supabase.from("profiles").select("role, status").eq("id", session.user.id).single().then(({ data }) => {
      setMyRole(data?.role || "regular");
      setMyStatus(data?.status || "pending");
    });
  }, [session]);

  const loadFinance = useCallback(async () => {
    const { data, error } = await supabase.from("production_finance").select("*");
    if (error) return; // regular users: RLS blocks this, that's expected
    const map = {};
    for (const row of data || []) map[row.production_id] = { orcamento: row.orcamento, custos: row.custos || [] };
    setFinanceMap(map);
  }, []);

  const loadFinanceRecords = useCallback(async () => {
    const { data, error } = await supabase.from("client_financial_records").select("*").order("data", { ascending: false });
    if (error) return; // regular users: RLS blocks this, that's expected
    const map = {};
    const ord = [];
    for (const row of data || []) {
      map[row.id] = row;
      ord.push(row.id);
    }
    setFinanceRecords(map);
    setFinanceRecordOrder(ord);
  }, []);

  const loadAll = useCallback(async () => {
    setStatus("loading");
    const { data, error } = await supabase.from(TABLE).select("id, payload, updated_at").order("updated_at", { ascending: false });
    if (error) {
      setOnline(false);
      setStatus("ready");
      return;
    }
    setOnline(true);
    const map = {};
    const ord = [];
    for (const row of data || []) {
      map[row.id] = row.payload;
      ord.push(row.id);
    }
    // restore any local, not-yet-saved drafts (survives page reloads without touching the shared db)
    for (const id of getDraftIndex("productions")) {
      const draft = loadDraft("productions", id);
      if (draft) {
        map[id] = draft;
        if (!ord.includes(id)) ord.unshift(id);
      }
    }
    setProductions(map);
    setOrder(ord);
    setStatus("ready");
  }, []);

  const loadClients = useCallback(async () => {
    const { data, error } = await supabase.from(TABLE_CLIENTS).select("*").order("name");
    if (error) return;
    const map = {};
    const ord = [];
    for (const row of data || []) {
      map[row.id] = row;
      ord.push(row.id);
    }
    for (const id of getDraftIndex("clients")) {
      const draft = loadDraft("clients", id);
      if (draft) {
        map[id] = draft;
        if (!ord.includes(id)) ord.push(id);
      }
    }
    setClients(map);
    setClientOrder(ord);
  }, []);

  useEffect(() => {
    if (!session) return;
    loadAll();
    loadClients();
    loadFinance();
    loadFinanceRecords();
    supabase.from(TABLE_TEAM).select("name").order("name").then(({ data }) => {
      setRoster((data || []).map((r) => r.name));
    });

    const channel = supabase
      .channel("productions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        if (payload.eventType === "DELETE") {
          setProductions((prev) => {
            const next = { ...prev };
            delete next[payload.old.id];
            return next;
          });
          setOrder((prev) => prev.filter((id) => id !== payload.old.id));
        } else {
          const row = payload.new;
          setProductions((prev) => ({ ...prev, [row.id]: row.payload }));
          setOrder((prev) => (prev.includes(row.id) ? prev : [row.id, ...prev]));
        }
      })
      .subscribe();

    const clientsChannel = supabase
      .channel("clients-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE_CLIENTS }, (payload) => {
        if (payload.eventType === "DELETE") {
          setClients((prev) => {
            const next = { ...prev };
            delete next[payload.old.id];
            return next;
          });
          setClientOrder((prev) => prev.filter((id) => id !== payload.old.id));
        } else {
          const row = payload.new;
          setClients((prev) => ({ ...prev, [row.id]: row }));
          setClientOrder((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
        }
      })
      .subscribe();

    const financeChannel = supabase
      .channel("finance-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "production_finance" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setFinanceMap((prev) => {
            const next = { ...prev };
            delete next[payload.old.production_id];
            return next;
          });
        } else {
          const row = payload.new;
          setFinanceMap((prev) => ({ ...prev, [row.production_id]: { orcamento: row.orcamento, custos: row.custos || [] } }));
        }
      })
      .subscribe();

    const financeRecordsChannel = supabase
      .channel("finance-records-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_financial_records" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setFinanceRecords((prev) => {
            const next = { ...prev };
            delete next[payload.old.id];
            return next;
          });
          setFinanceRecordOrder((prev) => prev.filter((id) => id !== payload.old.id));
        } else {
          const row = payload.new;
          setFinanceRecords((prev) => ({ ...prev, [row.id]: row }));
          setFinanceRecordOrder((prev) => (prev.includes(row.id) ? prev : [row.id, ...prev]));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(clientsChannel);
      supabase.removeChannel(financeChannel);
      supabase.removeChannel(financeRecordsChannel);
    };
  }, [session, loadAll, loadClients, loadFinance, loadFinanceRecords]);

  async function saveNow(id) {
    if (saveTimers.current["p:" + id]) {
      clearTimeout(saveTimers.current["p:" + id]);
      delete saveTimers.current["p:" + id];
    }
    const payload = productions[id];
    if (!payload) return;
    const { error } = await supabase.from(TABLE).upsert({ id, payload, updated_at: new Date().toISOString() });
    setOnline(!error);
    if (!error) clearDraft("productions", id);
  }

  async function saveFinanceNow(productionId) {
    const f = financeMap[productionId] || { orcamento: "", custos: [] };
    const { error } = await supabase.from("production_finance").upsert({
      production_id: productionId,
      orcamento: f.orcamento === "" ? null : Number(f.orcamento),
      custos: f.custos || [],
      updated_at: new Date().toISOString(),
    });
    setOnline(!error);
    return error;
  }

  function addFinanceRecord(clientId) {
    const rec = { id: uid(), client_id: clientId, label: "", data: "", orcamento: "", custos: [] };
    setFinanceRecords((prev) => ({ ...prev, [rec.id]: rec }));
    setFinanceRecordOrder((prev) => [rec.id, ...prev]);
    return rec.id;
  }

  function updateFinanceRecord(id, next) {
    setFinanceRecords((prev) => ({ ...prev, [id]: next }));
  }

  async function saveFinanceRecordNow(id) {
    const rec = financeRecords[id];
    if (!rec) return;
    const { error } = await supabase.from("client_financial_records").upsert({
      ...rec,
      orcamento: rec.orcamento === "" ? null : Number(rec.orcamento),
      updated_at: new Date().toISOString(),
    });
    setOnline(!error);
    return error;
  }

  async function deleteFinanceRecord(id) {
    setFinanceRecords((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setFinanceRecordOrder((prev) => prev.filter((x) => x !== id));
    const { error } = await supabase.from("client_financial_records").delete().eq("id", id);
    setOnline(!error);
  }

  function updateFinance(productionId, next) {
    setFinanceMap((prev) => ({ ...prev, [productionId]: next }));
  }

  function knowPerson(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    setRoster((prev) => {
      if (prev.some((n) => n.toLowerCase() === trimmed.toLowerCase())) return prev;
      supabase.from(TABLE_TEAM).upsert({ name: trimmed }).then(() => {});
      return [...prev, trimmed].sort((a, b) => a.localeCompare(b, "pt-BR"));
    });
  }

  function addProduction() {
    const p = emptyProduction();
    setProductions((prev) => ({ ...prev, [p.id]: p }));
    setOrder((prev) => [p.id, ...prev]);
    setCurrentId(p.id);
    saveDraft("productions", p.id, p);
    supabase.from(TABLE).upsert({ id: p.id, payload: p, updated_at: new Date().toISOString() }).then(({ error }) => {
      setOnline(!error);
      if (!error) clearDraft("productions", p.id);
    });
  }

  function addProductionForClient(client) {
    const p = emptyProduction();
    p.clienteId = client.id;
    p.cliente = client.name;
    setProductions((prev) => ({ ...prev, [p.id]: p }));
    setOrder((prev) => [p.id, ...prev]);
    setCurrentId(p.id);
    setActiveTab("producoes");
    saveDraft("productions", p.id, p);
    supabase.from(TABLE).upsert({ id: p.id, payload: p, updated_at: new Date().toISOString() }).then(({ error }) => {
      setOnline(!error);
      if (!error) clearDraft("productions", p.id);
    });
  }

  function updateProduction(id, next) {
    setProductions((prev) => ({ ...prev, [id]: next }));
    saveDraft("productions", id, next);
    if (saveTimers.current["p:" + id]) clearTimeout(saveTimers.current["p:" + id]);
    saveTimers.current["p:" + id] = setTimeout(async () => {
      const { error } = await supabase.from(TABLE).upsert({ id, payload: next, updated_at: new Date().toISOString() });
      setOnline(!error);
      if (!error) clearDraft("productions", id);
    }, 700);
  }

  async function deleteProduction(id) {
    setProductions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setOrder((prev) => prev.filter((o) => o !== id));
    if (currentId === id) setCurrentId(null);
    clearDraft("productions", id);
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    setOnline(!error);
  }

  async function saveClientNow(id) {
    if (saveTimers.current["c:" + id]) {
      clearTimeout(saveTimers.current["c:" + id]);
      delete saveTimers.current["c:" + id];
    }
    const record = clients[id];
    if (!record) return;
    const { error } = await supabase.from(TABLE_CLIENTS).upsert({ ...record, updated_at: new Date().toISOString() });
    setOnline(!error);
    if (!error) clearDraft("clients", id);
  }

  function addClient(prefillName) {
    const c = emptyClient();
    if (prefillName) c.name = prefillName;
    setClients((prev) => ({ ...prev, [c.id]: c }));
    setClientOrder((prev) => [...prev, c.id]);
    saveDraft("clients", c.id, c);
    supabase.from(TABLE_CLIENTS).upsert({ ...c, updated_at: new Date().toISOString() }).then(({ error }) => {
      setOnline(!error);
      if (!error) clearDraft("clients", c.id);
    });
    return c.id;
  }

  function updateClient(id, next) {
    setClients((prev) => ({ ...prev, [id]: next }));
    saveDraft("clients", id, next);
    if (saveTimers.current["c:" + id]) clearTimeout(saveTimers.current["c:" + id]);
    saveTimers.current["c:" + id] = setTimeout(async () => {
      const { error } = await supabase.from(TABLE_CLIENTS).upsert({ ...next, updated_at: new Date().toISOString() });
      setOnline(!error);
      if (!error) clearDraft("clients", id);
    }, 700);
  }

  async function deleteClient(id) {
    setClients((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setClientOrder((prev) => prev.filter((o) => o !== id));
    if (currentClientId === id) setCurrentClientId(null);
    clearDraft("clients", id);
    const { error } = await supabase.from(TABLE_CLIENTS).delete().eq("id", id);
    setOnline(!error);
  }

  function handleSelectClient(current, sel) {
    if (sel.createName) {
      const newId = addClient(sel.createName);
      updateProduction(current.id, { ...current, clienteId: newId, cliente: current.cliente || sel.createName });
    } else {
      const c = sel.id ? clients[sel.id] : null;
      updateProduction(current.id, {
        ...current,
        clienteId: sel.id || null,
        cliente: c ? (current.cliente || c.name) : current.cliente,
      });
    }
  }

  function openClientFromProduction(id) {
    setCurrentClientId(id);
    setActiveTab("clientes");
  }

  function openProductionFromClient(id) {
    setCurrentId(id);
    setActiveTab("producoes");
  }

  const current = currentId ? productions[currentId] : null;
  const currentClient = currentClientId ? clients[currentClientId] : null;
  const clientList = clientOrder.map((id) => clients[id]).filter(Boolean);

  if (session === undefined) {
    return (
      <div style={rootStyle}>
        <div style={{ display: "grid", placeItems: "center", height: 300, color: C.faint }}>
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuthed={() => {}} />;
  }

  if (recovery) {
    return (
      <AccountPanel
        email={session.user?.email}
        forced
        onDone={() => setRecovery(false)}
      />
    );
  }

  if (myStatus === null) {
    return (
      <div style={rootStyle}>
        <div style={{ display: "grid", placeItems: "center", height: 300, color: C.faint }}>
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (myStatus !== "approved" && myRole !== "gestor") {
    return (
      <div style={{ minHeight: "100vh", background: C.ink, display: "grid", placeItems: "center", padding: 20, fontFamily: FONT_BODY }}>
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <ShotlistMark size={30} lit={false} amber={C.line} dim={C.line} style={{ margin: "0 auto 18px" }} />
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: C.paper, marginBottom: 10 }}>
            {myStatus === "rejected" ? "Acesso não liberado" : "Aguardando aprovação"}
          </div>
          <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, marginBottom: 22 }}>
            {myStatus === "rejected"
              ? "Sua conta não foi aprovada pra usar o Shotlist. Fale com quem administra a equipe."
              : "Sua conta foi criada e já está esperando um gestor liberar o acesso. Assim que aprovarem, é só entrar de novo."}
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 18px", color: C.muted, fontSize: 13, cursor: "pointer" }}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  if (status === "boot" || status === "loading") {
    return (
      <div style={rootStyle}>
        <div style={{ display: "grid", placeItems: "center", height: 300, color: C.faint }}>
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const showingProductions = activeTab === "producoes" || fieldMode;
  const showList = isWide || (showingProductions ? !current : !currentClient);
  const showMain = isWide || (showingProductions ? !!current : !!currentClient);

  return (
    <div className="shell">
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${C.faint}; }
        button, input, select, textarea { font-family: inherit; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .shell { height: 100vh; height: 100dvh; background: ${C.ink}; font-family: ${FONT_BODY}; display: flex; flex-direction: column; overflow: hidden; }
        .topbar { display: flex; align-items: center; gap: 10px; padding: 12px 16px; padding-top: max(12px, env(safe-area-inset-top)); border-bottom: 1px solid ${C.line}; flex-shrink: 0; }
        .body { flex: 1; display: flex; flex-direction: column; min-height: 0; }
        @media (min-width: 900px) {
          .body { display: grid; grid-template-columns: 340px 1fr; }
        }
        .sidebar { display: flex; flex-direction: column; min-height: 0; }
        @media (min-width: 900px) {
          .sidebar { border-right: 1px solid ${C.line}; }
        }
        .pane-list { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 14px 0; }
        @media (min-width: 700px) {
          .pane-list { padding-top: 62px; }
          .pane-main { padding-top: 68px; }
        }
        @media (min-width: 900px) {
          .pane-list { padding-top: 66px; }
        }
        .sidebar-footer { flex-shrink: 0; padding: 12px 14px; padding-bottom: max(12px, env(safe-area-inset-bottom)); border-top: 1px solid ${C.line}; }
        .pane-main { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 14px 90px; }
        @media (min-width: 900px) {
          .pane-main { padding-left: 24px; padding-right: 24px; padding-bottom: 60px; padding-top: 76px; }
        }
        .tabs { display: flex; gap: 4px; background: ${C.panel2}; border-radius: 9px; padding: 4px; margin-bottom: 14px; }
        .tab-btn { flex: 1; padding: 8px 0; border-radius: 6px; border: none; cursor: pointer; font-family: ${FONT_MONO}; font-size: 12px; font-weight: 600; letter-spacing: 0.4px; }
        .fm-label { display: none; }
        @media (min-width: 640px) { .fm-label { display: inline; } }
      `}</style>

      <div className="topbar">
        <ShotlistMark size={22} lit />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: 1, color: C.paper, flex: 1 }}>
          SHOTLIST
        </div>
        {online ? <Wifi size={15} color={C.sage} /> : <WifiOff size={15} color={C.brick} />}
        <FieldModeToggle value={fieldMode} onChange={setFieldMode} />
        {isGestor && (
          <IconButton onClick={() => setShowAccounts(true)} title="Contas da equipe">
            <ShieldCheck size={17} />
          </IconButton>
        )}
        <IconButton onClick={() => setShowAccount(true)} title="Minha conta">
          <KeyRound size={17} />
        </IconButton>
        <IconButton onClick={() => setConfirmLogout(true)} title="Sair">
          <LogOut size={17} />
        </IconButton>
      </div>

      {showAccounts && (
        <AccountsPanel onClose={() => setShowAccounts(false)} myUserId={session.user.id} />
      )}

      {confirmLogout && (
        <ConfirmDialog
          title="Sair da conta?"
          message="Você vai precisar entrar de novo com seu email e senha."
          confirmLabel="Sair"
          danger
          onConfirm={() => { setConfirmLogout(false); supabase.auth.signOut(); }}
          onCancel={() => setConfirmLogout(false)}
        />
      )}

      {showAccount && (
        <AccountPanel email={session.user?.email} onClose={() => setShowAccount(false)} />
      )}

      {!online && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.brickDim, borderBottom: `1px solid ${C.brick}`, padding: "10px 16px", color: C.brick, fontSize: 13, flexShrink: 0 }}>
          <AlertCircle size={15} /> Sem conexão com o banco agora. Suas últimas alterações podem não ter sido salvas.
        </div>
      )}

      <div className="body">
        {showList && (
          <div className="sidebar">
            <div className="pane-list">
              {!fieldMode && (
                <div className="tabs" style={{ position: "relative" }}>
                  <div style={{
                    position: "absolute", top: 4, bottom: 4, left: 4,
                    width: "calc(50% - 4px)", borderRadius: 6, background: C.amberDim,
                    transform: activeTab === "clientes" ? "translateX(100%)" : "translateX(0%)",
                    transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  }} />
                  <button
                    className="tab-btn"
                    onClick={() => setActiveTab("producoes")}
                    style={{ position: "relative", zIndex: 1, background: "transparent", color: activeTab !== "clientes" ? C.amber : C.muted, transition: "color 0.2s" }}
                  >
                    PRÓXIMAS PRODUÇÕES
                  </button>
                  <button
                    className="tab-btn"
                    onClick={() => setActiveTab("clientes")}
                    style={{ position: "relative", zIndex: 1, background: "transparent", color: activeTab === "clientes" ? C.amber : C.muted, transition: "color 0.2s" }}
                  >
                    CLIENTES
                  </button>
                </div>
              )}

              {activeTab === "clientes" && !fieldMode ? (
                <ClientsList
                  clients={clientList}
                  currentClientId={currentClientId}
                  onOpen={setCurrentClientId}
                  onDelete={deleteClient}
                />
              ) : (
                <ProductionsListPane
                  order={order}
                  productions={productions}
                  clients={clients}
                  currentId={currentId}
                  onOpen={setCurrentId}
                  onDelete={deleteProduction}
                />
              )}
            </div>
            <div className="sidebar-footer">
              {showingProductions ? (
                <button onClick={addProduction} style={addButtonStyle}>
                  <Plus size={16} /> Nova produção
                </button>
              ) : (
                <button onClick={() => setCurrentClientId(addClient())} style={addButtonStyle}>
                  <Plus size={16} /> Novo cliente
                </button>
              )}
            </div>
          </div>
        )}

        {showMain && (
          <div className="pane-main">
            {showingProductions ? (
              current ? (
                <ProductionDetail
                  production={current}
                  fieldMode={fieldMode}
                  onChange={(next) => updateProduction(current.id, next)}
                  onSaveNow={() => saveNow(current.id)}
                  onBack={() => setCurrentId(null)}
                  roster={roster}
                  onKnowPerson={knowPerson}
                  clients={clientList}
                  onSelectClient={(sel) => handleSelectClient(current, sel)}
                  onOpenClient={openClientFromProduction}
                  showBack={!isWide}
                  isGestor={isGestor}
                  finance={financeMap[current.id]}
                  onFinanceChange={(next) => updateFinance(current.id, next)}
                  onFinanceSaveNow={() => saveFinanceNow(current.id)}
                />
              ) : (
                <ProductionsDashboard order={order} productions={productions} />
              )
            ) : currentClient ? (
              <ClientDetail
                client={currentClient}
                onChange={(next) => updateClient(currentClient.id, next)}
                onSaveNow={() => saveClientNow(currentClient.id)}
                onBack={() => setCurrentClientId(null)}
                onDelete={deleteClient}
                productions={order.map((id) => productions[id]).filter((p) => p && p.clienteId === currentClient.id)}
                onOpenProduction={openProductionFromClient}
                onAddProduction={() => addProductionForClient(currentClient)}
                showBack={!isWide}
                isGestor={isGestor}
                financeMap={financeMap}
                financeRecords={financeRecordOrder.map((id) => financeRecords[id]).filter((r) => r && r.client_id === currentClient.id)}
                onAddFinanceRecord={() => addFinanceRecord(currentClient.id)}
                onChangeFinanceRecord={updateFinanceRecord}
                onSaveFinanceRecord={saveFinanceRecordNow}
                onDeleteFinanceRecord={deleteFinanceRecord}
              />
            ) : isGestor ? (
              <ClientsDashboard
                clients={clients}
                productions={order.map((id) => productions[id]).filter(Boolean)}
                financeMap={financeMap}
                financeRecords={financeRecordOrder.map((id) => financeRecords[id]).filter(Boolean)}
              />
            ) : (
              <EmptyMainState label="Selecione um cliente à esquerda, ou cadastre um novo." />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const addButtonStyle = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: C.amber, border: "none", borderRadius: 24, padding: "12px 16px",
  color: C.ink, fontSize: 14, fontWeight: 700, cursor: "pointer",
};

function EmptyMainState({ label }) {
  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", color: C.faint, fontSize: 13.5, textAlign: "center", padding: 40 }}>
      <div>
        <ShotlistMark size={30} lit={false} amber={C.line} dim={C.line} />
        <div style={{ marginTop: 14 }}>{label}</div>
      </div>
    </div>
  );
}

function ProductionsListPane({ order, productions, clients, currentId, onOpen, onDelete }) {
  const groups = [];
  const byClient = {};
  const semCliente = [];

  for (const id of order) {
    const p = productions[id];
    if (!p) continue;
    if (p.clienteId && clients[p.clienteId]) {
      if (!byClient[p.clienteId]) byClient[p.clienteId] = [];
      byClient[p.clienteId].push(p);
    } else {
      semCliente.push(p);
    }
  }
  const clientIds = Object.keys(byClient).sort((a, b) => (clients[a]?.name || "").localeCompare(clients[b]?.name || "", "pt-BR"));
  for (const cid of clientIds) groups.push({ label: clients[cid].name, items: byClient[cid] });
  if (semCliente.length) groups.push({ label: "Sem cliente", items: semCliente });

  return (
    <div style={{ paddingBottom: 10 }}>
      {order.length === 0 && (
        <div style={{ color: C.faint, fontSize: 13.5, padding: "50px 4px 30px", textAlign: "center" }}>
          <ShotlistMark size={26} lit={false} amber={C.line} dim={C.line} style={{ marginBottom: 12 }} />
          <div>Nenhuma produção ainda.</div>
          <div>Toque em "Nova produção" abaixo pra montar cronograma, equipe e shotlist.</div>
        </div>
      )}
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.faint, letterSpacing: 0.5, margin: "0 4px 8px" }}>
            {g.label.toUpperCase()} ({g.items.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map((p) => (
              <ProductionCard key={p.id} p={p} selected={currentId === p.id} onOpen={() => onOpen(p.id)} onDelete={() => onDelete(p.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldModeToggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{ display: "flex", alignItems: "center", gap: 8, background: value ? C.amberDim : C.panel2, border: `1px solid ${value ? C.amber : C.line}`, borderRadius: 20, padding: "6px 12px 6px 6px", cursor: "pointer" }}
      title="Alternar modo campo"
    >
      <div style={{ width: 30, height: 18, borderRadius: 10, background: value ? C.amber : C.line, position: "relative", transition: "background 0.15s" }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: C.ink, position: "absolute", top: 2, left: value ? 14 : 2, transition: "left 0.15s" }} />
      </div>
      <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: value ? C.amber : C.muted, letterSpacing: 0.3 }} className="fm-label">MODO CAMPO</span>
    </button>
  );
}

const rootStyle = {
  minHeight: "100vh",
  background: C.ink,
  fontFamily: FONT_BODY,
  padding: "24px 12px 60px",
};

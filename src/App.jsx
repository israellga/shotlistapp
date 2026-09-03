import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Users, Clock,
  ExternalLink, ArrowLeft, CheckCircle2, Circle, PlayCircle,
  Film, Loader2, AlertCircle, Wifi, WifiOff, LogOut, Share2, Copy, Check, Save, KeyRound
} from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import AuthScreen from "./AuthScreen";
import AccountPanel from "./AccountPanel";

// ---------------------------------------------------------------------------
// Design tokens — film-set / call-sheet aesthetic.
// ---------------------------------------------------------------------------
const C = {
  ink: "#17181A",
  panel: "#1F2124",
  panel2: "#26282C",
  line: "#37393E",
  lineSoft: "#2C2E32",
  paper: "#ECE8DF",
  muted: "#96938B",
  faint: "#6B6963",
  amber: "#E2A33D",
  amberDim: "#4A3B21",
  teal: "#4FA9A0",
  sage: "#6FA07E",
  sageDim: "#233A2A",
  brick: "#C1613F",
  brickDim: "#3A241C",
};

const FONT_DISPLAY = "'Oswald', 'Arial Narrow', sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";
const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const TABLE = "productions";

const STATUS = {
  afazer: { label: "A fazer", color: C.muted, bg: "transparent", border: C.line },
  andamento: { label: "Em andamento", color: C.amber, bg: C.amberDim, border: C.amber },
  concluido: { label: "Concluído", color: C.sage, bg: C.sageDim, border: C.sage },
};
const STATUS_ORDER = ["afazer", "andamento", "concluido"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyProduction() {
  return {
    id: uid(),
    cliente: "",
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
    objetivo: "", equipamento: "", referencia: "", status: "afazer", takes: [],
  };
}

function emptyTake(n) {
  return { id: uid(), numero: n, acao: "", transicao: "", tempo: "", feito: false };
}

// ---------------------------------------------------------------------------
// Domain constants
// ---------------------------------------------------------------------------

const FUNCOES_PADRAO = [
  "Diretor(a)", "Ator/Atriz", "Fotógrafo(a)", "Assistente de câmera",
  "Assistente de set", "Videomaker", "Storymaker", "Catering", "Editor(a)", "Gaffer",
];

const TIPOS_PRODUCAO = ["Foto", "Reels", "Curta", "Stopmotion"];

const TABLE_TEAM = "team_members";

// ---------------------------------------------------------------------------
// Date & time helpers
// ---------------------------------------------------------------------------

function formatDataComDiaSemana(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return iso;
  const dia = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const semana = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${dia} · ${semana}`;
}

function parseHorario(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (!digits) return null;
  let h, m;
  if (digits.length <= 2) {
    h = parseInt(digits, 10);
    m = 0;
  } else if (digits.length === 3) {
    h = parseInt(digits.slice(0, 1), 10);
    m = parseInt(digits.slice(1), 10);
  } else {
    h = parseInt(digits.slice(0, digits.length - 2), 10);
    m = parseInt(digits.slice(-2), 10);
  }
  if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return null;
  return { h, m };
}

function formatHorario(raw) {
  const parsed = parseHorario(raw);
  if (!parsed) return raw;
  return parsed.m === 0 ? `${parsed.h}h` : `${parsed.h}h${String(parsed.m).padStart(2, "0")}`;
}

function horarioMinutos(raw) {
  const parsed = parseHorario(raw);
  if (!parsed) return 9999;
  return parsed.h * 60 + parsed.m;
}

// ---------------------------------------------------------------------------
// Small primitives
// ---------------------------------------------------------------------------

function IconButton({ onClick, title, children, tone = "muted", size = 34 }) {
  const colors = { muted: C.muted, brick: C.brick, amber: C.amber, paper: C.paper };
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: size, height: size, display: "grid", placeItems: "center",
        background: "transparent", border: "none", borderRadius: 6,
        color: colors[tone] || C.muted, cursor: "pointer", flexShrink: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

function Field({ label, value, onChange, onBlur, listId, placeholder, mono, multiline, style }) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <span style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3 }}>
          {label}
        </span>
      )}
      <Tag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        list={listId}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        style={{
          background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
          padding: "9px 11px", color: C.paper, fontFamily: mono ? FONT_MONO : FONT_BODY,
          fontSize: 14, outline: "none", resize: multiline ? "vertical" : undefined,
          width: "100%", boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = C.amber)}
        onBlurCapture={(e) => (e.target.style.borderColor = C.line)}
      />
    </label>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <span style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3 }}>{label}</span>
      )}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
          padding: "9px 11px", color: C.paper, fontFamily: FONT_MONO,
          fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
          colorScheme: "dark",
        }}
      />
      {value && (
        <span style={{ fontSize: 11.5, color: C.amber, fontFamily: FONT_MONO }}>
          {formatDataComDiaSemana(value)}
        </span>
      )}
    </label>
  );
}

function selectFieldStyle() {
  return {
    background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
    padding: "9px 11px", color: C.paper, fontFamily: FONT_BODY,
    fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", colorScheme: "dark",
  };
}

function selectInlineStyle(flex) {
  return {
    flex, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
    padding: "8px 10px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13.5,
    outline: "none", minWidth: 0, colorScheme: "dark",
  };
}

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
          {take.transicao && <div style={{ fontSize: 12.5, color: C.teal, marginTop: 3 }}>→ {take.transicao}</div>}
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
        style={{ background: "transparent", border: "none", color: C.teal, fontSize: 13.5, fontFamily: FONT_BODY, resize: "vertical", outline: "none", padding: "6px 4px" }}
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

function ShotCard({ shot, fieldMode, expanded, onToggle, onChange, onDelete }) {
  const doneCount = shot.takes.filter((t) => t.feito).length;

  function updateTake(id, next) {
    onChange({ ...shot, takes: shot.takes.map((t) => (t.id === id ? next : t)) });
  }
  function addTake() {
    onChange({ ...shot, takes: [...shot.takes, emptyTake(shot.takes.length + 1)] });
  }
  function deleteTake(id) {
    onChange({ ...shot, takes: shot.takes.filter((t) => t.id !== id).map((t, i) => ({ ...t, numero: i + 1 })) });
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 20, color: C.faint, minWidth: 34 }}>
          {String(shot.numero).padStart(2, "0")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, color: C.paper, fontWeight: 500 }}>{shot.nome || "Sem nome"}</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>
            {shot.tipo && <span style={{ color: C.teal }}>{shot.tipo} · </span>}
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
              <Field label="Equipamento" value={shot.equipamento} onChange={(v) => onChange({ ...shot, equipamento: v })} placeholder="Câmera, tripé, taça..." />
              <Field label="Objetivo" value={shot.objetivo} onChange={(v) => onChange({ ...shot, objetivo: v })} placeholder="O que essa cena precisa comunicar" multiline style={{ gridColumn: "1 / -1" }} />
              <Field label="Referência (link)" value={shot.referencia} onChange={(v) => onChange({ ...shot, referencia: v })} placeholder="https://instagram.com/..." mono style={{ gridColumn: "1 / -1" }} />
            </div>
          )}

          {fieldMode && shot.referencia && (
            <a href={shot.referencia} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: C.teal, marginTop: 14, textDecoration: "none" }}>
              Ver referência <ExternalLink size={12} />
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

const dashedAddStyle = {
  display: "flex", alignItems: "center", gap: 6, background: "transparent",
  border: `1px dashed ${C.line}`, borderRadius: 7, padding: "8px 12px",
  color: C.muted, fontSize: 13, cursor: "pointer",
};

function inputInlineStyle(flex) {
  return {
    flex, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
    padding: "8px 10px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13.5,
    outline: "none", minWidth: 0,
  };
}

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
  function add() { onChange([...cronograma, { id: uid(), horario: "", item: "", local: "", elenco: "", equipamento: "" }]); }
  function remove(id) { onChange(cronograma.filter((c) => c.id !== id)); }
  const sorted = [...cronograma].sort((a, b) => horarioMinutos(a.horario) - horarioMinutos(b.horario));
  return (
    <div>
      {sorted.map((c) => (
        <div key={c.id} style={{ display: "grid", gridTemplateColumns: "72px 1.4fr 1fr 1fr 30px", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <HorarioInput value={c.horario} onCommit={(v) => update(c.id, { horario: v })} />
          <input value={c.item} onChange={(e) => update(c.id, { item: e.target.value })} placeholder="Roteiro / item" style={inputInlineStyle(1)} />
          <input value={c.local} onChange={(e) => update(c.id, { local: e.target.value })} placeholder="Local" style={inputInlineStyle(1)} />
          <input value={c.elenco} onChange={(e) => update(c.id, { elenco: e.target.value })} placeholder="Elenco" style={inputInlineStyle(1)} />
          <IconButton onClick={() => remove(c.id)} tone="brick" size={30}><Trash2 size={14} /></IconButton>
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

function ProductionDetail({ production, fieldMode, onChange, onSaveNow, onBack, roster, onKnowPerson }) {
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
        <IconButton onClick={onBack} tone="paper" title="Voltar"><ArrowLeft size={19} /></IconButton>
        <div style={{ flex: 1, minWidth: 0 }}>
          {fieldMode ? (
            <>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: C.paper }}>{production.cliente || "Produção sem nome"}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.faint }}>
                {formatDataComDiaSemana(production.data) || "sem data"}{totalTakes > 0 && <span> · {doneTakes}/{totalTakes} takes concluídos</span>}
              </div>
            </>
          ) : (
            <input
              value={production.cliente}
              onChange={(e) => patch({ cliente: e.target.value })}
              placeholder="Nome do cliente / produção"
              style={{ background: "transparent", border: "none", outline: "none", fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, color: C.paper, width: "100%" }}
            />
          )}
        </div>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          <DateField label="Data" value={production.data} onChange={(v) => patch({ data: v })} />
          <Field
            label="Responsável"
            value={production.responsavel}
            onChange={(v) => patch({ responsavel: v })}
            onBlur={() => onKnowPerson && onKnowPerson(production.responsavel)}
            listId="team-roster"
            placeholder="Israel"
          />
          <Field label="Objetivo do dia" value={production.objetivoDia} onChange={(v) => patch({ objetivoDia: v })} placeholder="5 Reels + fotos" />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
        {!fieldMode && (
          <Section title="Equipe" icon={<Users size={15} color={C.faint} />} count={production.equipe.length}>
            <EquipeSection equipe={production.equipe} onChange={(equipe) => patch({ equipe })} onKnowPerson={onKnowPerson} />
          </Section>
        )}
        {!fieldMode && (
          <Section title="Cronograma do dia" icon={<Clock size={15} color={C.faint} />} count={production.cronograma.length}>
            <CronogramaSection cronograma={production.cronograma} onChange={(cronograma) => patch({ cronograma })} />
          </Section>
        )}
        {!fieldMode && (
          <Section title="Compartilhar com cliente" icon={<Share2 size={15} color={C.faint} />}>
            <ShareControl production={production} onChange={(v) => patch({ clientShareEnabled: v })} />
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

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Production list
// ---------------------------------------------------------------------------

function ProductionCard({ p, onOpen, onDelete }) {
  const totalTakes = p.shots.reduce((a, s) => a + s.takes.length, 0);
  const doneTakes = p.shots.reduce((a, s) => a + s.takes.filter((t) => t.feito).length, 0);
  const pct = totalTakes ? Math.round((doneTakes / totalTakes) * 100) : 0;
  return (
    <div onClick={onOpen} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
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
// App root
// ---------------------------------------------------------------------------

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out
  const [productions, setProductions] = useState({});
  const [order, setOrder] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [fieldMode, setFieldMode] = useState(false);
  const [status, setStatus] = useState("boot"); // boot | loading | ready
  const [online, setOnline] = useState(true);
  const [roster, setRoster] = useState([]);
  const [showAccount, setShowAccount] = useState(false);
  const [recovery, setRecovery] = useState(false);
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
    setProductions(map);
    setOrder(ord);
    setStatus("ready");
  }, []);

  useEffect(() => {
    if (!session) return;
    loadAll();
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, loadAll]);

  function scheduleSave(id, payload) {
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      const { error } = await supabase.from(TABLE).upsert({ id, payload, updated_at: new Date().toISOString() });
      setOnline(!error);
    }, 400);
  }

  async function saveNow(id) {
    if (saveTimers.current[id]) {
      clearTimeout(saveTimers.current[id]);
      delete saveTimers.current[id];
    }
    const payload = productions[id];
    if (!payload) return;
    const { error } = await supabase.from(TABLE).upsert({ id, payload, updated_at: new Date().toISOString() });
    setOnline(!error);
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
    scheduleSave(p.id, p);
    setCurrentId(p.id);
  }

  function updateProduction(id, next) {
    setProductions((prev) => ({ ...prev, [id]: next }));
    scheduleSave(id, next);
  }

  async function deleteProduction(id) {
    setProductions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setOrder((prev) => prev.filter((o) => o !== id));
    if (currentId === id) setCurrentId(null);
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    setOnline(!error);
  }

  const current = currentId ? productions[currentId] : null;

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

  return (
    <div style={rootStyle}>
      <style>{`* { box-sizing: border-box; } input::placeholder, textarea::placeholder { color: ${C.faint}; }`}</style>

      <div style={{ maxWidth: 720, margin: "0 auto 20px", display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
        <Film size={20} color={C.amber} />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, letterSpacing: 0.5, color: C.paper, flex: 1 }}>
          PRODUÇÃO — ROTEIRO &amp; CAPTAÇÃO
        </div>
        {online ? <Wifi size={15} color={C.sage} /> : <WifiOff size={15} color={C.brick} />}
        <FieldModeToggle value={fieldMode} onChange={setFieldMode} />
        <IconButton onClick={() => setShowAccount(true)} title="Minha conta">
          <KeyRound size={17} />
        </IconButton>
        <IconButton onClick={() => supabase.auth.signOut()} title="Sair">
          <LogOut size={17} />
        </IconButton>
      </div>

      {showAccount && (
        <AccountPanel email={session.user?.email} onClose={() => setShowAccount(false)} />
      )}

      {!online && (
        <div style={{ maxWidth: 720, margin: "0 auto 16px", display: "flex", alignItems: "center", gap: 8, background: C.brickDim, border: `1px solid ${C.brick}`, borderRadius: 8, padding: "10px 14px", color: C.brick, fontSize: 13 }}>
          <AlertCircle size={15} /> Sem conexão com o banco agora. Suas últimas alterações podem não ter sido salvas.
        </div>
      )}

      {!current ? (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 4px 90px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.5, flex: 1 }}>PRODUÇÕES ({order.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {order.length === 0 && (
              <div style={{ color: C.faint, fontSize: 13.5, padding: "50px 4px 30px", textAlign: "center" }}>
                <Film size={26} color={C.line} style={{ marginBottom: 12 }} />
                <div>Nenhuma produção ainda.</div>
                <div>Toque em "Nova produção" abaixo pra montar cronograma, equipe e shotlist.</div>
              </div>
            )}
            {order.map((id) => {
              const p = productions[id];
              if (!p) return null;
              return <ProductionCard key={id} p={p} onOpen={() => setCurrentId(id)} onDelete={() => deleteProduction(id)} />;
            })}
          </div>
          <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 10 }}>
            <button
              onClick={addProduction}
              style={{
                display: "flex", alignItems: "center", gap: 8, background: C.amber,
                border: "none", borderRadius: 30, padding: "13px 22px", color: C.ink,
                fontSize: 14.5, fontWeight: 600, cursor: "pointer",
                boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
              }}
            >
              <Plus size={17} /> Nova produção
            </button>
          </div>
        </div>
      ) : (
        <ProductionDetail
          production={current}
          fieldMode={fieldMode}
          onChange={(next) => updateProduction(current.id, next)}
          onSaveNow={() => saveNow(current.id)}
          onBack={() => setCurrentId(null)}
          roster={roster}
          onKnowPerson={knowPerson}
        />
      )}
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
      <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: value ? C.amber : C.muted, letterSpacing: 0.3 }}>MODO CAMPO</span>
    </button>
  );
}

const rootStyle = {
  minHeight: "100vh",
  background: C.ink,
  fontFamily: FONT_BODY,
  padding: "24px 12px 60px",
};

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Users, Clock,
  ExternalLink, ArrowLeft, CheckCircle2, Circle, PlayCircle,
  Loader2, AlertCircle, Wifi, WifiOff, LogOut, Share2, Copy, Check, Save, KeyRound,
  Building2, Phone, Mail, FileText, Menu, X as XIcon, FileDown, ShieldCheck, DollarSign, Film, Sparkles,
} from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import AuthScreen from "./AuthScreen";
import AccountPanel from "./AccountPanel";
import ShotlistMark from "./ShotlistMark";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";
import { formatDataComDiaSemana, formatIntervaloDatas, formatHorario, horarioMinutos } from "./datetime";
import {
  uid, IconButton, Field, DateField, selectFieldStyle, selectInlineStyle,
  inputInlineStyle, dashedAddStyle, ConfirmDialog, EditableTitle, ConfirmIconButton,
} from "./ui";
import { ClientsList, ClientDetail, ClientPickerInline } from "./ClientsPanel";
import { fetchThumbnail } from "./thumbnail";
import { analyzeReferenceFrames } from "./aiAnalysis";
import AccountsPanel from "./AccountsPanel";
import { FinanceSection, ClientBalanceSummary, totalCustos } from "./finance";
import { ProductionsDashboard, ClientsDashboard } from "./dashboards";
import { PaymentPlansSection, emptyPaymentPlan } from "./payments";
import WorkspaceOnboarding from "./WorkspaceOnboarding";
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
    dataFim: "",
    responsavel: "",
    horaInicio: "",
    horaFim: "",
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
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [suggestion, setSuggestion] = useState(null);

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

  async function handleExtractRoteiro() {
    setAnalysisError("");
    setAnalyzing(true);
    try {
      const result = await analyzeReferenceFrames(shot.thumbnailUrl);
      setSuggestion(result);
    } catch (e) {
      setAnalysisError(e?.message || "Não consegui analisar essa referência.");
    }
    setAnalyzing(false);
  }

  function applySuggestion() {
    if (!suggestion) return;
    onChange({
      ...shot,
      tipo: suggestion.tipo && TIPOS_PRODUCAO.includes(suggestion.tipo) ? suggestion.tipo : shot.tipo,
      equipamentos: Array.isArray(suggestion.equipamentos) && suggestion.equipamentos.length ? suggestion.equipamentos : shot.equipamentos,
      objetivo: suggestion.roteiro || shot.objetivo,
      takes: Array.isArray(suggestion.takes) && suggestion.takes.length
        ? suggestion.takes.map((t, i) => ({ id: uid(), numero: i + 1, acao: t.acao || "", transicao: t.transicao || "", tempo: "", feito: false }))
        : shot.takes,
    });
    setSuggestion(null);
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
          <ConfirmIconButton onConfirm={onDelete} title="Excluir shot" confirmTitle="Excluir shot?" confirmMessage={`"${shot.nome || "Este shot"}" e todos os seus takes vão ser apagados.`} stopPropagation>
            <Trash2 size={16} />
          </ConfirmIconButton>
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

              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3, display: "block", marginBottom: 8 }}>REFERÊNCIA</span>
                <input
                  value={shot.referencia}
                  onChange={(e) => onChange({ ...shot, referencia: e.target.value })}
                  onBlur={handleReferenciaBlur}
                  placeholder="https://instagram.com/..."
                  style={{ ...inputInlineStyle(1), width: "100%", fontFamily: FONT_MONO }}
                />

                {(thumbLoading || shot.thumbnailUrl || (shot.referencia && shot.thumbnailFailed)) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
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

                {shot.thumbnailUrl && !thumbLoading && (
                  <div style={{ marginTop: 12 }}>
                    {!suggestion && (
                      <button
                        onClick={handleExtractRoteiro}
                        disabled={analyzing}
                        style={{ display: "flex", alignItems: "center", gap: 7, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 8, padding: "8px 13px", color: C.amber, fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: analyzing ? "default" : "pointer" }}
                      >
                        {analyzing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
                        {analyzing ? "Analisando..." : "Extrair roteiro dessa referência"}
                      </button>
                    )}
                    {analysisError && (
                      <div style={{ color: C.brick, fontSize: 11.5, marginTop: 8 }}>{analysisError}</div>
                    )}
                    {suggestion && (
                      <div style={{ background: C.panel2, border: `1px solid ${C.amber}`, borderRadius: 9, padding: 14, marginTop: 4 }}>
                        <div style={{ fontSize: 12, color: C.amber, fontWeight: 600, marginBottom: 10 }}>Sugestão da análise</div>
                        {suggestion.tipo && (
                          <div style={{ fontSize: 12.5, color: C.paper, marginBottom: 6 }}><strong>Tipo:</strong> {suggestion.tipo}</div>
                        )}
                        {Array.isArray(suggestion.equipamentos) && suggestion.equipamentos.length > 0 && (
                          <div style={{ fontSize: 12.5, color: C.paper, marginBottom: 6 }}><strong>Equipamento:</strong> {suggestion.equipamentos.join(", ")}</div>
                        )}
                        {suggestion.roteiro && (
                          <div style={{ fontSize: 12.5, color: C.paper, marginBottom: 6 }}><strong>Roteiro:</strong> {suggestion.roteiro}</div>
                        )}
                        {Array.isArray(suggestion.takes) && suggestion.takes.length > 0 && (
                          <div style={{ fontSize: 12.5, color: C.paper, marginBottom: 10 }}>
                            <strong>Takes ({suggestion.takes.length}):</strong>
                            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                              {suggestion.takes.map((t, i) => (
                                <li key={i} style={{ marginBottom: 3 }}>{t.acao}{t.transicao ? ` → ${t.transicao}` : ""}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <button
                            onClick={applySuggestion}
                            style={{ background: C.sageDim, border: `1px solid ${C.sage}`, borderRadius: 7, padding: "7px 13px", color: C.sage, fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer" }}
                          >
                            Aplicar sugestões
                          </button>
                          <button
                            onClick={() => setSuggestion(null)}
                            style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 7, padding: "7px 13px", color: C.muted, fontSize: 12.5, fontFamily: FONT_BODY, cursor: "pointer" }}
                          >
                            Descartar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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

function CronogramaSection({ cronograma, onChange, shots }) {
  function update(id, patch) { onChange(cronograma.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
  function add() { onChange([...cronograma, { id: uid(), horario: "", nome: "", local: "", elenco: "", observacao: "" }]); }
  function remove(id) { onChange(cronograma.filter((c) => c.id !== id)); }
  const sorted = [...cronograma].sort((a, b) => horarioMinutos(a.horario) - horarioMinutos(b.horario));
  return (
    <div>
      {sorted.map((c) => {
        const linkedShot = c.shotId ? (shots || []).find((s) => s.id === c.shotId) : null;
        return (
          <div key={c.id} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <HorarioInput value={c.horario} onCommit={(v) => update(c.id, { horario: v })} />
              {linkedShot ? (
                <div
                  title="Nome vem do shot vinculado"
                  style={{ flex: 2, background: "transparent", border: `1px dashed ${C.line}`, borderRadius: 7, padding: "8px 10px", color: C.muted, fontFamily: FONT_BODY, fontSize: 13.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {linkedShot.nome || "Sem nome"}
                </div>
              ) : (
                <input value={c.nome} onChange={(e) => update(c.id, { nome: e.target.value })} placeholder="Nome" style={inputInlineStyle(2)} />
              )}
              <input value={c.local} onChange={(e) => update(c.id, { local: e.target.value })} placeholder="Local" style={inputInlineStyle(1)} />
              <IconButton onClick={() => remove(c.id)} tone="brick" size={28}><Trash2 size={13} /></IconButton>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={c.elenco} onChange={(e) => update(c.id, { elenco: e.target.value })} placeholder="Elenco" style={inputInlineStyle(1)} />
              <input value={c.observacao} onChange={(e) => update(c.id, { observacao: e.target.value })} placeholder="Observação" style={inputInlineStyle(1)} />
            </div>
          </div>
        );
      })}
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

function LabeledHorarioInput({ label, value, onCommit }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3 }}>{label}</span>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onCommit(formatHorario(local))}
        placeholder="10h30"
        style={{
          background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
          padding: "9px 11px", color: C.paper, fontFamily: FONT_MONO,
          fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = C.amber)}
        onBlurCapture={(e) => (e.target.style.borderColor = C.line)}
      />
    </label>
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

function Section({ title, icon, children, defaultOpen, count, action }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px" }}>
        <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer" }}>
          {icon}
          <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.5 }}>
            {title.toUpperCase()}{typeof count === "number" && <span style={{ color: C.faint }}> ({count})</span>}
          </span>
        </div>
        {action}
        <div onClick={() => setOpen(!open)} style={{ cursor: "pointer", display: "flex" }}>
          {open ? <ChevronDown size={16} color={C.faint} /> : <ChevronRight size={16} color={C.faint} />}
        </div>
      </div>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Production detail
// ---------------------------------------------------------------------------

function nextAutoHorario(cronograma, horaInicio) {
  const times = (cronograma || []).map((c) => horarioMinutos(c.horario)).filter((m) => m < 9999);
  let baseMin;
  if (times.length > 0) {
    baseMin = Math.max(...times) + 30;
  } else if (horaInicio) {
    const parsed = horarioMinutos(horaInicio);
    baseMin = parsed < 9999 ? parsed : null;
  }
  if (baseMin == null || isNaN(baseMin)) return "";
  const h = Math.floor(baseMin / 60) % 24;
  const m = baseMin % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function ProductionDetail({ production, fieldMode, onChange, onSaveNow, onBack, roster, onKnowPerson, clients, onSelectClient, onOpenClient, showBack, isGestor, finance, onFinanceChange, onFinanceSaveNow }) {
  const [expandedShot, setExpandedShot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      const { exportProductionPDF } = await import("./pdfExport");
      exportProductionPDF(production);
    } finally {
      setExportingPdf(false);
    }
  }

  function patch(fields) { onChange({ ...production, ...fields }); }
  function updateShot(id, next) { patch({ shots: production.shots.map((s) => (s.id === id ? next : s)) }); }
  function addShot() {
    const s = emptyShot(production.shots.length + 1);
    const novoHorario = nextAutoHorario(production.cronograma, production.horaInicio);
    const novaOrdem = novoHorario
      ? [...production.cronograma, { id: uid(), horario: novoHorario, nome: "", local: "", elenco: "", observacao: "", shotId: s.id }]
      : production.cronograma;
    onChange({ ...production, shots: [...production.shots, s], cronograma: novaOrdem });
    setExpandedShot(s.id);
  }
  function deleteShot(id) {
    onChange({
      ...production,
      shots: production.shots.filter((s) => s.id !== id).map((s, i) => ({ ...s, numero: i + 1 })),
      cronograma: production.cronograma.filter((c) => c.shotId !== id),
    });
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
                {formatIntervaloDatas(production.data, production.dataFim) || "sem data"}
                {(production.horaInicio || production.horaFim) && (
                  <span> · {production.horaInicio || "?"}–{production.horaFim || "?"}</span>
                )}
                {totalTakes > 0 && <span> · {doneTakes}/{totalTakes} takes concluídos</span>}
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
            onClick={handleExportPdf}
            disabled={exportingPdf}
            title="Exportar PDF"
            style={{
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8,
              padding: "8px 12px", color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: exportingPdf ? "default" : "pointer",
            }}
          >
            {exportingPdf ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <FileDown size={14} />} PDF
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: production.dataFim ? 10 : 6 }}>
          <DateField label={production.dataFim ? "Data de início" : "Data"} value={production.data} onChange={(v) => patch({ data: v })} />
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
        production.dataFim ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 10, alignItems: "end" }}>
            <DateField label="Data de fim" value={production.dataFim} onChange={(v) => patch({ dataFim: v })} />
            <button
              onClick={() => patch({ dataFim: "" })}
              style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 7, padding: "0 12px", height: 40, color: C.muted, fontSize: 12, fontFamily: FONT_BODY, cursor: "pointer" }}
            >
              Remover
            </button>
          </div>
        ) : (
          <button
            onClick={() => patch({ dataFim: production.data || "" })}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px dashed ${C.line}`, borderRadius: 7, padding: "7px 11px", color: C.muted, fontSize: 12, fontFamily: FONT_BODY, cursor: "pointer", marginBottom: 10 }}
          >
            <Plus size={13} /> Mais de uma diária (adicionar data de fim)
          </button>
        )
      )}

      {!fieldMode && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <LabeledHorarioInput label="Horário de início" value={production.horaInicio} onCommit={(v) => patch({ horaInicio: v })} />
          <LabeledHorarioInput label="Horário de fim" value={production.horaFim} onCommit={(v) => patch({ horaFim: v })} />
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
      </div>

      <div style={{ marginBottom: 12 }}>
        <Section
          title="Shots"
          icon={<Film size={15} color={C.faint} />}
          count={production.shots.length}
          defaultOpen
          action={!fieldMode && (
            <button
              onClick={(e) => { e.stopPropagation(); addShot(); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 8, padding: "6px 11px", color: C.amber, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              <Plus size={13} /> Novo shot
            </button>
          )}
        >
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
        </Section>
      </div>

      {!fieldMode && (
        <div style={{ marginBottom: 12 }}>
          <Section title="Ordem do dia" icon={<Clock size={15} color={C.faint} />} count={production.cronograma.length}>
            <CronogramaSection cronograma={production.cronograma} onChange={(cronograma) => patch({ cronograma })} shots={production.shots} />
          </Section>
        </div>
      )}

      {!fieldMode && (
        <Section title="Compartilhar com cliente" icon={<Share2 size={15} color={C.faint} />}>
          <ShareControl production={production} onChange={(v) => patch({ clientShareEnabled: v })} />
        </Section>
      )}

      {!fieldMode && isGestor && !production.__shared && (
        <div style={{ marginTop: 12 }}>
          <Section title="Compartilhar com colaborador" icon={<Users size={15} color={C.faint} />}>
            <CollaboratorShareControl productionId={production.id} />
          </Section>
        </div>
      )}

      {!fieldMode && isGestor && !production.__shared && (
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

function CollaboratorShareControl({ productionId }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    supabase.from("production_shares").select("*").eq("production_id", productionId).then(({ data }) => {
      if (!cancelled) {
        setShares(data || []);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [productionId]);

  async function addShare(e) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setError("Digite um email válido.");
      return;
    }
    setError("");
    setAdding(true);
    const row = { id: uid(), production_id: productionId, shared_with_email: clean };
    const { error: err } = await supabase.from("production_shares").insert(row);
    setAdding(false);
    if (err) {
      setError(err.message || "Não consegui compartilhar agora.");
      return;
    }
    setShares((prev) => [...prev, row]);
    setEmail("");
  }

  async function removeShare(id) {
    setShares((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("production_shares").delete().eq("id", id);
  }

  return (
    <div>
      <p style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5, marginBottom: 10 }}>
        A pessoa vê e edita só esta produção, mesmo sem fazer parte do seu espaço de trabalho.
      </p>
      {loading ? (
        <Loader2 size={14} color={C.faint} style={{ animation: "spin 1s linear infinite" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {shares.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px" }}>
              <span style={{ flex: 1, fontSize: 12.5, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.shared_with_email}</span>
              <IconButton onClick={() => removeShare(s.id)} tone="brick" size={26}><Trash2 size={13} /></IconButton>
            </div>
          ))}
          {shares.length === 0 && (
            <div style={{ fontSize: 12.5, color: C.faint }}>Ninguém de fora tem acesso a esta produção ainda.</div>
          )}
        </div>
      )}
      <form onSubmit={addShare} style={{ display: "flex", gap: 8 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@colaborador.com"
          style={{ flex: 1, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "8px 10px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13, outline: "none" }}
        />
        <button
          type="submit"
          disabled={adding}
          style={{ display: "flex", alignItems: "center", gap: 6, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 7, padding: "8px 14px", color: C.amber, fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: adding ? "default" : "pointer" }}
        >
          {adding ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : "Compartilhar"}
        </button>
      </form>
      {error && <div style={{ color: C.brick, fontSize: 11.5, marginTop: 8 }}>{error}</div>}
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
        <div style={{ marginTop: 8, fontSize: 11, color: C.brick, fontFamily: FONT_MONO, wordBreak: "break-word" }}>
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
  const totalShots = p.shots.length;
  const doneShots = p.shots.filter((s) => s.status === "concluido").length;
  const pct = totalShots ? Math.round((doneShots / totalShots) * 100) : 0;
  return (
    <div onClick={onOpen} style={{ background: selected ? C.panel2 : C.panel, border: `1px solid ${selected ? C.amber : C.line}`, borderRadius: 10, padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 600, color: C.paper }}>{p.cliente || "Sem nome"}</div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 3, fontFamily: FONT_MONO }}>
          {formatIntervaloDatas(p.data, p.dataFim) || "sem data"} · {p.shots.length} shot{p.shots.length !== 1 ? "s" : ""}{totalShots > 0 && ` · ${pct}% concluído`}
        </div>
      </div>
      {!p.__shared && (
        <ConfirmIconButton onConfirm={onDelete} title="Excluir produção" confirmTitle="Excluir produção?" confirmMessage={`"${p.cliente || "Esta produção"}" e toda a shotlist vão ser apagadas.`} stopPropagation>
          <Trash2 size={16} />
        </ConfirmIconButton>
      )}
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
  const [myName, setMyName] = useState("");
  const [workspaceId, setWorkspaceId] = useState(undefined); // undefined = checking, null = none yet
  const [workspaceName, setWorkspaceName] = useState("");
  const [pendingInvites, setPendingInvites] = useState([]);
  const [showAccounts, setShowAccounts] = useState(false);
  const [financeMap, setFinanceMap] = useState({});
  const [financeRecords, setFinanceRecords] = useState({});
  const [financeRecordOrder, setFinanceRecordOrder] = useState([]);
  const [paymentPlans, setPaymentPlans] = useState({});
  const [paymentPlanOrder, setPaymentPlanOrder] = useState([]);
  const [sharedProductions, setSharedProductions] = useState({});
  const [sharedOrder, setSharedOrder] = useState([]);
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
      setMyName("");
      setWorkspaceId(undefined);
      setWorkspaceName("");
      return;
    }
    supabase.from("profiles").select("name").eq("id", session.user.id).single().then(({ data }) => {
      setMyName(data?.name || "");
    });
    loadMyWorkspace();
  }, [session]);

  const loadMyWorkspace = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const myId = userData?.user?.id;
    if (!myId) {
      setWorkspaceId(null);
      return;
    }
    const { data, error } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, status")
      .eq("user_id", myId)
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error("[Shotlist] loadMyWorkspace:", error);
      setWorkspaceId(null);
      setMyRole(null);
      setMyStatus(null);
      const { data: myUser } = await supabase.auth.getUser();
      const email = myUser?.user?.email;
      if (email) {
        const { data: invites } = await supabase.from("workspace_invites").select("*, workspaces ( name )").eq("email", email).eq("accepted", false);
        setPendingInvites(invites || []);
      }
      return;
    }
    setWorkspaceId(data.workspace_id);
    setMyRole(data.role);
    setMyStatus(data.status);
    const { data: ws } = await supabase.from("workspaces").select("name").eq("id", data.workspace_id).maybeSingle();
    setWorkspaceName(ws?.name || "");
    setPendingInvites([]);
  }, []);

  const loadFinance = useCallback(async () => {
    if (!workspaceId) return;
    const { data, error } = await supabase.from("production_finance").select("*").eq("workspace_id", workspaceId);
    if (error) return; // regular users: RLS blocks this, that's expected
    const map = {};
    for (const row of data || []) map[row.production_id] = { orcamento: row.orcamento, custos: row.custos || [] };
    setFinanceMap(map);
  }, [workspaceId]);

  const loadFinanceRecords = useCallback(async () => {
    if (!workspaceId) return;
    const { data, error } = await supabase.from("client_financial_records").select("*").eq("workspace_id", workspaceId).order("data", { ascending: false });
    if (error) return; // regular users: RLS blocks this, that's expected
    const map = {};
    const ord = [];
    for (const row of data || []) {
      map[row.id] = row;
      ord.push(row.id);
    }
    setFinanceRecords(map);
    setFinanceRecordOrder(ord);
  }, [workspaceId]);

  const loadPaymentPlans = useCallback(async () => {
    if (!workspaceId) return;
    const { data, error } = await supabase.from("payment_plans").select("*").eq("workspace_id", workspaceId);
    if (error) return; // regular users: RLS blocks this, that's expected
    const map = {};
    const ord = [];
    for (const row of data || []) {
      map[row.id] = row;
      ord.push(row.id);
    }
    setPaymentPlans(map);
    setPaymentPlanOrder(ord);
  }, [workspaceId]);

  const loadSharedProductions = useCallback(async () => {
    const email = session?.user?.email;
    if (!email) return;
    const { data, error } = await supabase
      .from("production_shares")
      .select("production_id, productions ( id, payload, updated_at )")
      .eq("shared_with_email", email);
    if (error) return;
    const map = {};
    const ord = [];
    for (const row of data || []) {
      if (!row.productions) continue;
      map[row.productions.id] = { ...row.productions.payload, __shared: true };
      ord.push(row.productions.id);
    }
    setSharedProductions(map);
    setSharedOrder(ord);
  }, [session]);

  const loadAll = useCallback(async () => {
    if (!workspaceId) return;
    setStatus("loading");
    const { data, error } = await supabase.from(TABLE).select("id, payload, updated_at").eq("workspace_id", workspaceId).order("updated_at", { ascending: false });
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
  }, [workspaceId]);

  const loadClients = useCallback(async () => {
    if (!workspaceId) return;
    const { data, error } = await supabase.from(TABLE_CLIENTS).select("*").eq("workspace_id", workspaceId).order("name");
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
  }, [workspaceId]);

  useEffect(() => {
    if (!session || !workspaceId) return;
    loadAll();
    loadClients();
    loadFinance();
    loadFinanceRecords();
    loadPaymentPlans();
    loadSharedProductions();
    supabase.from(TABLE_TEAM).select("name").eq("workspace_id", workspaceId).order("name").then(({ data }) => {
      setRoster((data || []).map((r) => r.name));
    });

    const channel = supabase
      .channel("productions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = payload.old.id;
          setProductions((prev) => {
            if (!(oldId in prev)) return prev;
            const next = { ...prev };
            delete next[oldId];
            return next;
          });
          setOrder((prev) => prev.filter((id) => id !== oldId));
          setSharedProductions((prev) => {
            if (!(oldId in prev)) return prev;
            const next = { ...prev };
            delete next[oldId];
            return next;
          });
          setSharedOrder((prev) => prev.filter((id) => id !== oldId));
        } else {
          const row = payload.new;
          if (row.workspace_id === workspaceId) {
            setProductions((prev) => ({ ...prev, [row.id]: row.payload }));
            setOrder((prev) => (prev.includes(row.id) ? prev : [row.id, ...prev]));
          } else {
            // RLS only delivers this if it's shared with me — safe to trust.
            setSharedProductions((prev) => ({ ...prev, [row.id]: { ...row.payload, __shared: true } }));
            setSharedOrder((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
          }
        }
      })
      .subscribe();

    const clientsChannel = supabase
      .channel("clients-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE_CLIENTS, filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
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
      .on("postgres_changes", { event: "*", schema: "public", table: "production_finance", filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
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
      .on("postgres_changes", { event: "*", schema: "public", table: "client_financial_records", filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
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

    const paymentPlansChannel = supabase
      .channel("payment-plans-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_plans", filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          setPaymentPlans((prev) => {
            const next = { ...prev };
            delete next[payload.old.id];
            return next;
          });
          setPaymentPlanOrder((prev) => prev.filter((id) => id !== payload.old.id));
        } else {
          const row = payload.new;
          setPaymentPlans((prev) => ({ ...prev, [row.id]: row }));
          setPaymentPlanOrder((prev) => (prev.includes(row.id) ? prev : [row.id, ...prev]));
        }
      })
      .subscribe();

    const sharesChannel = session?.user?.email
      ? supabase
          .channel("production-shares-changes")
          .on("postgres_changes", { event: "*", schema: "public", table: "production_shares", filter: `shared_with_email=eq.${session.user.email}` }, (payload) => {
            if (payload.eventType === "DELETE") {
              const prodId = payload.old.production_id;
              setSharedProductions((prev) => {
                if (!(prodId in prev)) return prev;
                const next = { ...prev };
                delete next[prodId];
                return next;
              });
              setSharedOrder((prev) => prev.filter((id) => id !== prodId));
            } else {
              // a production was just shared with me — fetch its data
              loadSharedProductions();
            }
          })
          .subscribe()
      : null;

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(clientsChannel);
      supabase.removeChannel(financeChannel);
      supabase.removeChannel(financeRecordsChannel);
      supabase.removeChannel(paymentPlansChannel);
      if (sharesChannel) supabase.removeChannel(sharesChannel);
    };
  }, [session, workspaceId, loadAll, loadClients, loadFinance, loadFinanceRecords, loadPaymentPlans, loadSharedProductions]);

  async function saveNow(id) {
    if (saveTimers.current["p:" + id]) {
      clearTimeout(saveTimers.current["p:" + id]);
      delete saveTimers.current["p:" + id];
    }
    const isShared = !!sharedProductions[id];
    const raw = isShared ? sharedProductions[id] : productions[id];
    if (!raw) return;
    const { __shared, ...payload } = raw;
    const upsertObj = { id, payload, updated_at: new Date().toISOString() };
    if (!isShared) upsertObj.workspace_id = workspaceId;
    const { error } = await supabase.from(TABLE).upsert(upsertObj);
    setOnline(!error);
    if (!error) clearDraft("productions", id);
  }

  async function saveFinanceNow(productionId) {
    const f = financeMap[productionId] || { orcamento: "", custos: [] };
    const { error } = await supabase.from("production_finance").upsert({
      production_id: productionId,
      workspace_id: workspaceId,
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
      workspace_id: workspaceId,
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

  function addPaymentPlan(clientId) {
    const plan = emptyPaymentPlan(clientId);
    setPaymentPlans((prev) => ({ ...prev, [plan.id]: plan }));
    setPaymentPlanOrder((prev) => [plan.id, ...prev]);
    return plan.id;
  }

  function updatePaymentPlan(id, next) {
    setPaymentPlans((prev) => ({ ...prev, [id]: next }));
  }

  async function savePaymentPlanNow(id) {
    const plan = paymentPlans[id];
    if (!plan) return;
    const { error } = await supabase.from("payment_plans").upsert({
      ...plan,
      workspace_id: workspaceId,
      valor_total: plan.valor_total === "" ? null : Number(plan.valor_total),
      updated_at: new Date().toISOString(),
    });
    setOnline(!error);
    return error;
  }

  async function deletePaymentPlan(id) {
    setPaymentPlans((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPaymentPlanOrder((prev) => prev.filter((x) => x !== id));
    const { error } = await supabase.from("payment_plans").delete().eq("id", id);
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
      supabase.from(TABLE_TEAM).upsert({ name: trimmed, workspace_id: workspaceId }).then(() => {});
      return [...prev, trimmed].sort((a, b) => a.localeCompare(b, "pt-BR"));
    });
  }

  function addProduction() {
    const p = emptyProduction();
    setProductions((prev) => ({ ...prev, [p.id]: p }));
    setOrder((prev) => [p.id, ...prev]);
    setCurrentId(p.id);
    saveDraft("productions", p.id, p);
    supabase.from(TABLE).upsert({ id: p.id, workspace_id: workspaceId, payload: p, updated_at: new Date().toISOString() }).then(({ error }) => {
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
    supabase.from(TABLE).upsert({ id: p.id, workspace_id: workspaceId, payload: p, updated_at: new Date().toISOString() }).then(({ error }) => {
      setOnline(!error);
      if (!error) clearDraft("productions", p.id);
    });
  }

  function updateProduction(id, next) {
    const isShared = !!sharedProductions[id];
    if (isShared) {
      setSharedProductions((prev) => ({ ...prev, [id]: next }));
    } else {
      setProductions((prev) => ({ ...prev, [id]: next }));
    }
    saveDraft("productions", id, next);
    if (saveTimers.current["p:" + id]) clearTimeout(saveTimers.current["p:" + id]);
    saveTimers.current["p:" + id] = setTimeout(async () => {
      const { __shared, ...payload } = next;
      const upsertObj = { id, payload, updated_at: new Date().toISOString() };
      if (!isShared) upsertObj.workspace_id = workspaceId;
      const { error } = await supabase.from(TABLE).upsert(upsertObj);
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
    const { error } = await supabase.from(TABLE_CLIENTS).upsert({ ...record, workspace_id: workspaceId, updated_at: new Date().toISOString() });
    setOnline(!error);
    if (!error) clearDraft("clients", id);
  }

  function addClient(prefillName) {
    const c = emptyClient();
    if (prefillName) c.name = prefillName;
    setClients((prev) => ({ ...prev, [c.id]: c }));
    setClientOrder((prev) => [...prev, c.id]);
    saveDraft("clients", c.id, c);
    supabase.from(TABLE_CLIENTS).upsert({ ...c, workspace_id: workspaceId, updated_at: new Date().toISOString() }).then(({ error }) => {
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
      const { error } = await supabase.from(TABLE_CLIENTS).upsert({ ...next, workspace_id: workspaceId, updated_at: new Date().toISOString() });
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

  const current = currentId ? (productions[currentId] || sharedProductions[currentId]) : null;
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

  if (workspaceId === undefined) {
    return (
      <div style={rootStyle}>
        <div style={{ display: "grid", placeItems: "center", height: 300, color: C.faint }}>
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (workspaceId === null) {
    return (
      <WorkspaceOnboarding
        userEmail={session.user?.email}
        onSignOut={() => supabase.auth.signOut()}
        onCreated={() => loadMyWorkspace()}
        pendingInvites={pendingInvites}
        onAcceptInvite={() => loadMyWorkspace()}
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
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: 1, color: C.paper }}>
            SHOTLIST
          </div>
          {workspaceName && (
            <div style={{ fontSize: 10.5, color: C.faint, fontFamily: FONT_MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {workspaceName}
            </div>
          )}
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
        <AccountsPanel
          onClose={() => setShowAccounts(false)}
          myUserId={session.user.id}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          onRenameWorkspace={setWorkspaceName}
        />
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
                  sharedOrder={sharedOrder}
                  sharedProductions={sharedProductions}
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
                <ProductionsDashboard order={order} productions={productions} userName={myName} />
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
                paymentPlans={paymentPlanOrder.map((id) => paymentPlans[id]).filter((p) => p && p.client_id === currentClient.id)}
                onAddPaymentPlan={() => addPaymentPlan(currentClient.id)}
                onChangePaymentPlan={updatePaymentPlan}
                onSavePaymentPlan={savePaymentPlanNow}
                onDeletePaymentPlan={deletePaymentPlan}
              />
            ) : isGestor ? (
              <ClientsDashboard
                clients={clients}
                productions={order.map((id) => productions[id]).filter(Boolean)}
                financeMap={financeMap}
                financeRecords={financeRecordOrder.map((id) => financeRecords[id]).filter(Boolean)}
                paymentPlans={paymentPlanOrder.map((id) => paymentPlans[id]).filter(Boolean)}
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

function ProductionsListPane({ order, productions, clients, currentId, onOpen, onDelete, sharedOrder, sharedProductions }) {
  function sortByDate(items) {
    return [...items].sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return a.data.localeCompare(b.data);
    });
  }

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
  for (const cid of clientIds) groups.push({ label: clients[cid].name, items: sortByDate(byClient[cid]) });
  if (semCliente.length) groups.push({ label: "Sem cliente", items: sortByDate(semCliente) });

  const sharedItems = sortByDate((sharedOrder || []).map((id) => sharedProductions[id]).filter(Boolean));
  if (sharedItems.length) groups.push({ label: "Compartilhado comigo", items: sharedItems, shared: true });

  return (
    <div style={{ paddingBottom: 10 }}>
      {order.length === 0 && sharedItems.length === 0 && (
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

import React from "react";
import { Plus, Trash2, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { C, FONT_MONO, FONT_BODY, FONT_DISPLAY } from "./theme";
import { DateField, Field, IconButton } from "./ui";

const uid = () => Math.random().toString(36).slice(2, 9);

// ---------------------------------------------------------------------------
// Entrega e pós-produção
// ---------------------------------------------------------------------------
export const ETAPAS = [
  { key: "captacao", label: "Captação" },
  { key: "selecao", label: "Seleção" },
  { key: "edicao", label: "Edição" },
  { key: "revisao", label: "Revisão" },
  { key: "entregue", label: "Entregue" },
];

export function etapaLabel(key) {
  return ETAPAS.find((e) => e.key === key)?.label || "Captação";
}

export function entregaPendente(p) {
  const e = p.entrega;
  return !!(e && e.etapa && e.etapa !== "entregue" && e.etapa !== "captacao") || !!(e && e.prazo && e.etapa !== "entregue");
}

export function EntregaSection({ entrega, onChange }) {
  const e = entrega || { etapa: "captacao", prazo: "", link: "", nota: "" };
  const set = (patch) => onChange({ ...e, ...patch });
  const idx = Math.max(0, ETAPAS.findIndex((x) => x.key === (e.etapa || "captacao")));
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {ETAPAS.map((et, i) => {
          const on = i === idx, done = i < idx;
          return (
            <button
              key={et.key}
              onClick={() => set({ etapa: et.key })}
              style={{
                minHeight: 40, padding: "0 14px", borderRadius: 20, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600,
                border: `1px solid ${on ? C.amber : C.line}`,
                background: on ? C.amberDim : done ? "rgba(255,255,255,0.06)" : "transparent",
                color: on ? C.amber : done ? C.paper : C.muted,
              }}
            >
              {done ? "✓ " : ""}{et.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        <DateField label="Prazo de entrega" value={e.prazo || ""} onChange={(v) => set({ prazo: v })} />
        <Field label="Link da entrega (Drive, WeTransfer, galeria)" value={e.link || ""} onChange={(v) => set({ link: v })} placeholder="https://" />
        <Field label="Observação para o cliente" value={e.nota || ""} onChange={(v) => set({ nota: v })} placeholder="Ex: 30 fotos tratadas + 1 vídeo de 60s" multiline autoGrow />
      </div>
      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
        O cliente vê a etapa e o prazo no link compartilhado. O link só aparece pra ele quando a etapa estiver em "Entregue".
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checklist de equipamento
// ---------------------------------------------------------------------------
export const CHECKLIST_BASE = [
  "Câmeras carregadas", "Baterias reserva", "Cartões formatados", "Lentes limpas",
  "Tripé", "Iluminação", "Microfones", "Cabos e carregadores", "HD / backup",
];

export function makeChecklist(names) {
  return names.map((nome) => ({ id: uid(), nome, ok: false }));
}

export function ChecklistSection({ checklist, onChange, fieldMode }) {
  const list = checklist || [];
  const done = list.filter((i) => i.ok).length;
  const [novo, setNovo] = React.useState("");
  const toggle = (id) => onChange(list.map((i) => (i.id === id ? { ...i, ok: !i.ok } : i)));
  const add = () => {
    const nome = novo.trim();
    if (!nome) return;
    onChange([...list, { id: uid(), nome, ok: false }]);
    setNovo("");
  };
  return (
    <div>
      {list.length === 0 && (
        <button
          onClick={() => onChange(makeChecklist(CHECKLIST_BASE))}
          style={{ minHeight: 44, width: "100%", background: "transparent", border: `1px dashed ${C.line}`, borderRadius: 12, color: C.muted, fontFamily: FONT_BODY, fontSize: 13.5, cursor: "pointer", marginBottom: 8 }}
        >
          Usar checklist padrão
        </button>
      )}
      {list.length > 0 && (
        <div style={{ fontSize: 12.5, color: done === list.length ? C.sage : C.faint, marginBottom: 8, fontFamily: FONT_MONO }}>
          {done}/{list.length} conferidos
        </div>
      )}
      {list.map((i) => (
        <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
          <button
            onClick={() => toggle(i.id)}
            style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, minHeight: 44, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT_BODY, fontSize: 15, color: i.ok ? C.faint : C.paper, textDecoration: i.ok ? "line-through" : "none", padding: 0 }}
          >
            {i.ok ? <CheckCircle2 size={20} color={C.sage} /> : <Circle size={20} color={C.faint} />}
            {i.nome}
          </button>
          {!fieldMode && <IconButton onClick={() => onChange(list.filter((x) => x.id !== i.id))} tone="brick" size={30}><Trash2 size={14} /></IconButton>}
        </div>
      ))}
      {!fieldMode && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Adicionar item"
            style={{ flex: 1, minHeight: 40, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "0 11px", color: C.paper, fontFamily: FONT_BODY, fontSize: 14, outline: "none" }}
          />
          <button onClick={add} style={{ minWidth: 44, minHeight: 40, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 8, color: C.amber, cursor: "pointer" }}><Plus size={16} /></button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modelos de produção
// ---------------------------------------------------------------------------
export const TEMPLATES = [
  {
    key: "vazio", nome: "Em branco", desc: "Começa do zero",
  },
  {
    key: "casamento", nome: "Casamento", desc: "Making of, cerimônia, família, casal e festa",
    equipe: ["Fotógrafo(a)", "Videomaker", "Assistente de câmera"],
    tipo: "Foto",
    shots: [
      ["Making of da noiva", "Preparação"], ["Making of do noivo", "Preparação"], ["Detalhes (alianças, vestido, convite)", "Preparação"],
      ["Entrada e cerimônia", "Cerimônia"], ["Votos e alianças", "Cerimônia"], ["Fotos em família", "Pós-cerimônia"],
      ["Ensaio do casal", "Casal"], ["Decoração e mesa", "Festa"], ["Primeira dança e pista", "Festa"],
    ],
    checklist: [...CHECKLIST_BASE, "Flash e difusor", "2ª câmera de reserva", "Lista de fotos de família"],
  },
  {
    key: "gastronomia", nome: "Gastronomia", desc: "Pratos, drinks e ambiente",
    equipe: ["Fotógrafo(a)", "Assistente de set", "Produtor(a)"],
    tipo: "Foto",
    shots: [
      ["Prato principal", "Pratos"], ["Entradas", "Pratos"], ["Sobremesas", "Pratos"], ["Drinks", "Bebidas"],
      ["Chef em ação", "Bastidores"], ["Ambiente e fachada", "Ambiente"],
    ],
    checklist: [...CHECKLIST_BASE, "Rebatedores", "Softbox", "Fundos e superfícies", "Utensílios de apoio"],
  },
  {
    key: "institucional", nome: "Vídeo institucional", desc: "Entrevistas, cobertura e takes de apoio",
    equipe: ["Diretor(a)", "Videomaker", "Som/Áudio", "Assistente de câmera"],
    tipo: "Reels",
    shots: [
      ["Entrevista principal", "Entrevistas"], ["Takes de apoio (cobertura)", "B-roll"], ["Fachada e ambiente", "B-roll"],
      ["Depoimentos", "Entrevistas"], ["Encerramento", "Finalização"],
    ],
    checklist: [...CHECKLIST_BASE, "Lapela / boom", "Refletor LED", "Teleprompter", "Autorização de imagem"],
  },
];

export function applyTemplate(p, key, { emptyShot, emptyTake }) {
  const t = TEMPLATES.find((x) => x.key === key);
  if (!t || key === "vazio") return p;
  p.equipe = (t.equipe || []).map((funcao) => ({ id: uid(), funcao, responsavel: "" }));
  p.shots = (t.shots || []).map(([nome, contexto], i) => {
    const s = emptyShot(i + 1);
    s.nome = nome; s.contexto = contexto; s.tipo = t.tipo || "";
    s.takes = [{ ...emptyTake(1), acao: t.tipo === "Foto" ? "Fotografar" : nome }];
    return s;
  });
  p.checklist = makeChecklist(t.checklist || CHECKLIST_BASE);
  return p;
}

export function TemplatePicker({ onPick, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, borderRadius: 26, padding: "20px 18px 14px" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: C.paper, marginBottom: 4 }}>Nova produção</div>
        <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 14 }}>Escolha um modelo pra já vir com equipe, shots e checklist.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => onPick(t.key)}
              className="glass hover-row tap-scale"
              style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minHeight: 56, padding: "10px 16px", borderRadius: 16, cursor: "pointer", textAlign: "left", fontFamily: FONT_BODY, color: C.paper }}
            >
              <span style={{ fontSize: 15, fontWeight: 600 }}>{t.nome}</span>
              <span style={{ fontSize: 12.5, color: C.muted }}>{t.desc}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ width: "100%", minHeight: 44, marginTop: 8, background: "transparent", border: "none", color: C.muted, fontFamily: FONT_BODY, fontSize: 14, cursor: "pointer" }}>Cancelar</button>
      </div>
    </div>
  );
}

export function EntregaLink({ href }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.amber, textDecoration: "none", fontWeight: 600 }}>
      Abrir entrega <ExternalLink size={14} />
    </a>
  );
}

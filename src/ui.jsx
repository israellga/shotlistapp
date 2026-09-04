import React from "react";
import { Check, Pencil } from "lucide-react";
import { C, FONT_MONO, FONT_BODY, FONT_DISPLAY } from "./theme";
import { formatDataComDiaSemana } from "./datetime";

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function IconButton({ onClick, title, children, tone = "muted", size = 34 }) {
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

export function Field({ label, value, onChange, onBlur, listId, placeholder, mono, multiline, autoGrow, style }) {
  const Tag = multiline ? "textarea" : "input";
  const taRef = React.useRef(null);

  function resize(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  React.useEffect(() => {
    if (multiline && autoGrow) resize(taRef.current);
  }, [value, multiline, autoGrow]);

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <span style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3 }}>
          {label}
        </span>
      )}
      <Tag
        ref={multiline && autoGrow ? taRef : undefined}
        value={value}
        onChange={(e) => { onChange(e.target.value); if (autoGrow) resize(e.target); }}
        onBlur={onBlur}
        list={listId}
        placeholder={placeholder}
        rows={multiline ? (autoGrow ? 1 : 3) : undefined}
        style={{
          background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
          padding: "9px 11px", color: C.paper, fontFamily: mono ? FONT_MONO : FONT_BODY,
          fontSize: 14, outline: "none", resize: multiline ? (autoGrow ? "none" : "vertical") : undefined,
          overflow: autoGrow ? "hidden" : undefined,
          width: "100%", boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = C.amber)}
        onBlurCapture={(e) => (e.target.style.borderColor = C.line)}
      />
    </label>
  );
}

export function DateField({ label, value, onChange }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      {label && (
        <span style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3 }}>{label}</span>
      )}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
          padding: "0 11px", color: C.paper, fontFamily: FONT_MONO,
          fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box",
          colorScheme: "dark", height: 40, lineHeight: "38px",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          WebkitAppearance: "none", appearance: "none", display: "block",
        }}
      />
      {value && (
        <span style={{ fontSize: 11.5, color: C.amber, fontFamily: FONT_MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {formatDataComDiaSemana(value)}
        </span>
      )}
    </label>
  );
}

export function selectFieldStyle() {
  return {
    background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
    padding: "9px 11px", color: C.paper, fontFamily: FONT_BODY,
    fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", colorScheme: "dark",
  };
}

export function selectInlineStyle(flex) {
  return {
    flex, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
    padding: "8px 10px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13.5,
    outline: "none", minWidth: 0, colorScheme: "dark",
  };
}

export function inputInlineStyle(flex) {
  return {
    flex, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7,
    padding: "8px 10px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13.5,
    outline: "none", minWidth: 0,
  };
}

export const dashedAddStyle = {
  display: "flex", alignItems: "center", gap: 6, background: "transparent",
  border: `1px dashed ${C.line}`, borderRadius: 7, padding: "8px 12px",
  color: C.muted, fontSize: 13, fontFamily: FONT_BODY, cursor: "pointer",
};

export function ConfirmDialog({ title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", danger, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60, display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 360, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 22 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: C.paper, marginBottom: 8 }}>{title}</div>
        {message && <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5, marginBottom: 20 }}>{message}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 14px", color: C.muted, fontSize: 13.5, fontFamily: FONT_BODY, cursor: "pointer" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, background: danger ? C.brickDim : C.amberDim,
              border: `1px solid ${danger ? C.brick : C.amber}`, borderRadius: 8, padding: "10px 14px",
              color: danger ? C.brick : C.amber, fontSize: 13.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditableTitle({ value, onChange, placeholder, size = 22 }) {
  const [editing, setEditing] = React.useState(!value);
  const [draft, setDraft] = React.useState(value || "");

  React.useEffect(() => {
    if (!editing) setDraft(value || "");
  }, [value, editing]);

  function commit() {
    onChange(draft.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          placeholder={placeholder}
          style={{
            flex: 1, minWidth: 0, background: C.panel2, border: `1px solid ${C.amber}`,
            borderRadius: 8, outline: "none", fontFamily: FONT_DISPLAY, fontWeight: 700,
            fontSize: size, color: C.paper, padding: "7px 10px",
          }}
        />
        <IconButton onClick={commit} tone="amber" title="Confirmar">
          <Check size={19} />
        </IconButton>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
      <div style={{
        flex: 1, minWidth: 0, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: size,
        color: value ? C.paper : C.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value || placeholder}
      </div>
      <IconButton onClick={() => setEditing(true)} title="Editar nome">
        <Pencil size={16} />
      </IconButton>
    </div>
  );
}

export function ConfirmIconButton({ onConfirm, title, confirmTitle, confirmMessage, tone = "brick", size = 34, stopPropagation, children }) {
  const [confirming, setConfirming] = React.useState(false);
  return (
    <>
      <IconButton
        onClick={(e) => { if (stopPropagation) e.stopPropagation(); setConfirming(true); }}
        tone={tone}
        size={size}
        title={title}
      >
        {children}
      </IconButton>
      {confirming && (
        <ConfirmDialog
          title={confirmTitle || "Excluir?"}
          message={confirmMessage}
          confirmLabel="Excluir"
          danger
          onConfirm={() => { setConfirming(false); onConfirm(); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

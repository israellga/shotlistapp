import React from "react";
import { C, FONT_MONO, FONT_BODY } from "./theme";
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

export function Field({ label, value, onChange, onBlur, listId, placeholder, mono, multiline, style }) {
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

export function DateField({ label, value, onChange }) {
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
  color: C.muted, fontSize: 13, cursor: "pointer",
};

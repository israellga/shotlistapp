import React, { useState } from "react";
import { X, Loader2, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";

export default function AccountPanel({ email, onClose, forced, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      if (forced) onDone?.();
      else onClose?.();
    }, 1400);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50,
      display: "grid", placeItems: "center", padding: 20, fontFamily: FONT_BODY,
    }}>
      <div style={{ width: "100%", maxWidth: 380, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 22, position: "relative" }}>
        {!forced && (
          <button
            onClick={onClose}
            style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <KeyRound size={17} color={C.amber} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.paper }}>
            {forced ? "CRIE UMA NOVA SENHA" : "TROCAR SENHA"}
          </div>
        </div>
        {email && (
          <div style={{ fontSize: 12, color: C.faint, fontFamily: FONT_MONO, marginBottom: 18 }}>{email}</div>
        )}
        {!email && <div style={{ marginBottom: 18 }} />}

        {done ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.sageDim, border: `1px solid ${C.sage}`, borderRadius: 8, padding: "12px 14px", color: C.sage, fontSize: 13.5 }}>
            <CheckCircle2 size={16} /> Senha atualizada!
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha"
              autoComplete="new-password"
              autoFocus
              style={inputStyle}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmar nova senha"
              autoComplete="new-password"
              style={inputStyle}
            />
            {error && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: C.brickDim, border: `1px solid ${C.brick}`, borderRadius: 8, padding: "10px 12px", color: C.brick, fontSize: 12.5, lineHeight: 1.5 }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 8,
                padding: "11px 14px", color: C.amber, fontSize: 14, fontWeight: 600,
                cursor: loading ? "default" : "pointer", marginTop: 2,
              }}
            >
              {loading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
              Salvar nova senha
            </button>
          </form>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const inputStyle = {
  background: C.panel2,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "11px 13px",
  color: C.paper,
  fontFamily: FONT_BODY,
  fontSize: 14,
  outline: "none",
};

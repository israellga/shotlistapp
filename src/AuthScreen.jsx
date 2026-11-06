import React, { useState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import BoltMark from "./BoltMark";
import ShotlistLogo from "./ShotlistLogo";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!supabaseConfigured) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
        <div style={{ maxWidth: 420, color: C.brick, fontFamily: FONT_BODY, fontSize: 14, textAlign: "center" }}>
          <AlertCircle size={22} style={{ marginBottom: 10 }} />
          <div>
            Este site ainda não está conectado a um banco de dados. Configure as
            variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Netlify e faça
            um novo deploy.
          </div>
        </div>
      </div>
    );
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Digite seu email.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (err) {
      setError(traduzErro(err.message));
    } else {
      setNotice("Enviamos um link pro seu email pra você criar uma nova senha.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim() || !password.trim()) {
      setError("Preencha email e senha.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Digite seu nome.");
      return;
    }
    setLoading(true);
    if (mode === "login") {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(traduzErro(err.message));
      } else {
        onAuthed();
      }
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() } },
      });
      if (err) {
        setError(traduzErro(err.message));
      } else if (data.session) {
        onAuthed();
      } else if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        // Supabase's documented signal for "email already registered" without
        // leaking that fact via a distinguishable error (anti-enumeration).
        setError("Esse email já tem conta. Tente entrar ou use \"Esqueci minha senha\".");
      } else {
        setNotice("Conta criada! Verifique seu email para confirmar antes de entrar.");
        setMode("login");
      }
    }
    setLoading(false);
  }

  const titles = { login: "Bem-vindo de volta", signup: "Crie sua conta", forgot: "Recuperar senha" };

  return (
    <div className="auth-shell">
      <style>{`
        .auth-shell { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; font-family: ${FONT_BODY}; position: relative; overflow: hidden; }
        .auth-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 32px 20px; padding-top: max(32px, env(safe-area-inset-top)); }
        .auth-wrap { width: 100%; max-width: 400px; }
        .auth-hero { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 26px; position: relative; }
        .auth-glow { position: absolute; top: 4px; width: 150px; height: 150px; border-radius: 50%; background: radial-gradient(circle, rgba(253,223,75,0.28), transparent 68%); filter: blur(18px); pointer-events: none; }
        .auth-card { border-radius: 30px; padding: 22px 20px 20px; }
        .auth-seg { position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 3px; border-radius: 15px; background: rgba(255,255,255,0.07); margin-bottom: 18px; }
        .auth-seg-thumb { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px); border-radius: 12px; background: rgba(255,255,255,0.16); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 8px rgba(0,0,0,0.3); transition: transform 0.4s cubic-bezier(0.32,0.72,0,1); }
        .auth-seg button { position: relative; z-index: 1; min-height: 40px; border: none; background: transparent; font-size: 14.5px; font-weight: 600; cursor: pointer; transition: color 0.25s cubic-bezier(0.25,0.1,0.25,1); }
        .auth-input { transition: border-color 0.25s cubic-bezier(0.25,0.1,0.25,1), background-color 0.25s cubic-bezier(0.25,0.1,0.25,1); }
        .auth-input:focus { border-color: rgba(253,223,75,0.55) !important; background: rgba(255,255,255,0.09) !important; }
        .auth-footer { padding: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; padding-bottom: max(16px, env(safe-area-inset-bottom)); }
        input::placeholder { color: ${C.faint}; }
        button, input, select, textarea { font-family: inherit; }
        @keyframes auth-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="auth-main">
        <div className="auth-wrap">
          <div className="auth-hero fade-in-up">
            <div className="auth-glow" />
            <ShotlistLogo size={88} style={{ position: "relative", filter: "drop-shadow(0 14px 28px rgba(0,0,0,0.55))" }} />
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 700, letterSpacing: 0.3, color: C.paper, marginTop: 16 }}>Shotlist</div>
            <div style={{ fontSize: 15, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>Cronograma, equipe e shotlist num só lugar.</div>
          </div>

          <div className="auth-card modal-card">
            {mode !== "forgot" ? (
              <div className="auth-seg">
                <div className="auth-seg-thumb" style={{ transform: mode === "signup" ? "translateX(100%)" : "none" }} />
                {["login", "signup"].map((m) => (
                  <button key={m} onClick={() => { setMode(m); setError(""); setNotice(""); }} style={{ color: mode === m ? C.paper : C.faint }}>
                    {m === "login" ? "Entrar" : "Criar conta"}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: C.paper, margin: "2px 2px 8px" }}>{titles.forgot}</div>
            )}

            {mode === "forgot" ? (
              <form onSubmit={handleForgotSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.5, margin: "0 2px 4px" }}>
                  Digite o email da sua conta. Vamos mandar um link pra você criar uma senha nova.
                </p>
                <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" style={inputStyle} />
                {error && <Notice tone="error">{error}</Notice>}
                {notice && <Notice tone="ok">{notice}</Notice>}
                <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
                  {loading && <Loader2 size={15} style={{ animation: "auth-spin 1s linear infinite" }} />}
                  Enviar link
                </button>
                <button type="button" onClick={() => { setMode("login"); setError(""); setNotice(""); }} style={linkButtonStyle}>
                  Voltar pro login
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {mode === "signup" && (
                  <input className="auth-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" style={inputStyle} />
                )}
                <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" style={inputStyle} />
                <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" autoComplete={mode === "login" ? "current-password" : "new-password"} style={inputStyle} />

                {error && <Notice tone="error">{error}</Notice>}
                {notice && <Notice tone="ok">{notice}</Notice>}

                <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
                  {loading && <Loader2 size={15} style={{ animation: "auth-spin 1s linear infinite" }} />}
                  {mode === "login" ? "Entrar" : "Criar conta"}
                </button>

                {mode === "login" && (
                  <button type="button" onClick={() => { setMode("forgot"); setError(""); setNotice(""); }} style={linkButtonStyle}>
                    Esqueci minha senha
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="auth-footer">
        <a href="https://israellga.com" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none", opacity: 0.6, minHeight: 36 }}>
          <BoltMark size={13} lit amber={C.faint} />
          <span style={{ fontSize: 11, color: C.faint, letterSpacing: 1 }}>ISRAELLGA.COM</span>
        </a>
      </div>
    </div>
  );
}

function Notice({ tone, children }) {
  const isError = tone === "error";
  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "flex-start",
      background: isError ? C.brickDim : C.sageDim,
      border: `1px solid ${isError ? C.brick : C.sage}`,
      borderRadius: 12, padding: "10px 12px",
      color: isError ? C.brick : C.sage, fontSize: 12.5, lineHeight: 1.5,
    }}>
      {isError ? <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
      {children}
    </div>
  );
}

function traduzErro(msg) {
  if (/invalid login credentials/i.test(msg)) return "Email ou senha incorretos.";
  if (/already registered/i.test(msg)) return "Esse email já tem conta. Tente entrar.";
  if (/password.*at least/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/email.*invalid/i.test(msg)) return "Email inválido.";
  return msg;
}

const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: "0 16px",
  minHeight: 52,
  color: C.paper,
  fontFamily: FONT_BODY,
  fontSize: 16,
  outline: "none",
};

function primaryButtonStyle(loading) {
  return {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "linear-gradient(180deg, #FFFFFF, #E4E4E8)", border: "none", borderRadius: 26,
    minHeight: 52, padding: "0 14px", color: "#0A0A0A", fontSize: 16, fontWeight: 700,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 22px rgba(0,0,0,0.35)",
    cursor: loading ? "default" : "pointer", marginTop: 6,
  };
}

const linkButtonStyle = {
  background: "transparent", border: "none", color: C.muted,
  fontSize: 14, cursor: "pointer", padding: 4, minHeight: 40,
};

import React, { useState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import BoltMark from "./BoltMark";
import ShotlistMark from "./ShotlistMark";
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
      <div style={{ minHeight: "100vh", background: C.ink, display: "grid", placeItems: "center", padding: 20 }}>
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

  return (
    <div className="auth-shell">
      <style>{`
        .auth-shell {
          min-height: 100vh; min-height: 100dvh;
          background: ${C.ink};
          display: flex; flex-direction: column;
          font-family: ${FONT_BODY};
        }
        .auth-main {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr;
        }
        .auth-brandpanel { display: none; }
        @media (min-width: 760px) {
          .auth-main { grid-template-columns: 1.15fr 1fr; }
          .auth-brandpanel { display: flex; }
        }
        .auth-formpanel {
          display: flex; align-items: center; justify-content: center;
          padding: 40px 22px;
          padding-top: max(40px, env(safe-area-inset-top));
        }
        @media (min-width: 760px) {
          .auth-formpanel { padding: 40px; padding-top: max(40px, env(safe-area-inset-top)); border-left: 1px solid ${C.line}; }
        }
        .auth-footer {
          padding: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding-bottom: max(16px, env(safe-area-inset-bottom));
          border-top: 1px solid ${C.line};
        }
        input::placeholder { color: ${C.faint}; }
        button, input, select, textarea { font-family: inherit; }
        @keyframes auth-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="auth-main">
        <BrandPanel />
        <div className="auth-formpanel">
          <div style={{ width: "100%", maxWidth: 340 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30 }}>
              <ShotlistMark size={26} lit />
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, letterSpacing: 1, color: C.paper }}>
                SHOTLIST
              </div>
            </div>

            {mode !== "forgot" && (
              <div style={{ position: "relative", display: "flex", background: C.panel2, borderRadius: 9, padding: 4, marginBottom: 22 }}>
                <div style={{
                  position: "absolute", top: 4, bottom: 4, left: 4,
                  width: "calc(50% - 4px)", borderRadius: 6, background: C.amberDim,
                  transform: mode === "signup" ? "translateX(100%)" : "translateX(0%)",
                  transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                }} />
                {["login", "signup"].map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(""); setNotice(""); }}
                    style={{
                      position: "relative", zIndex: 1,
                      flex: 1, padding: "9px 0", borderRadius: 6, border: "none", cursor: "pointer",
                      background: "transparent",
                      color: mode === m ? C.amber : C.muted,
                      fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.4,
                      transition: "color 0.2s",
                    }}
                  >
                    {m === "login" ? "ENTRAR" : "CRIAR CONTA"}
                  </button>
                ))}
              </div>
            )}

            {mode === "forgot" ? (
              <form onSubmit={handleForgotSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, margin: "0 0 4px" }}>
                  Digite o email da sua conta. Vamos mandar um link pra você criar uma senha nova.
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  style={inputStyle}
                />
                {error && <Notice tone="error">{error}</Notice>}
                {notice && <Notice tone="ok">{notice}</Notice>}
                <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
                  {loading && <Loader2 size={15} style={{ animation: "auth-spin 1s linear infinite" }} />}
                  Enviar link
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); setNotice(""); }}
                  style={linkButtonStyle}
                >
                  Voltar pro login
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {mode === "signup" && (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                    style={inputStyle}
                  />
                )}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  style={inputStyle}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  style={inputStyle}
                />

                {error && <Notice tone="error">{error}</Notice>}
                {notice && <Notice tone="ok">{notice}</Notice>}

                <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
                  {loading && <Loader2 size={15} style={{ animation: "auth-spin 1s linear infinite" }} />}
                  {mode === "login" ? "Entrar" : "Criar conta"}
                </button>

                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}
                    style={linkButtonStyle}
                  >
                    Esqueci minha senha
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="auth-footer">
        <a
          href="https://israellga.com"
          target="_blank"
          rel="noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none", opacity: 0.6 }}
        >
          <BoltMark size={13} lit amber={C.faint} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint, letterSpacing: 1 }}>ISRAELLGA.COM</span>
        </a>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="auth-brandpanel" style={{ background: "#000000", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ width: "min(78%, 620px)" }}>
        <ShotlistMark size="100%" interactive glowOpacity={0.35} glowRadius={30} />
      </div>
      <div style={{ position: "absolute", bottom: 40, left: 40, right: 40 }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.faint, letterSpacing: 0.2, lineHeight: 1.6 }}>
          Cronograma, equipe e shotlist de produção — tudo num só lugar, compartilhado com quem precisa acompanhar.
        </div>
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
      borderRadius: 8, padding: "10px 12px",
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
  background: C.panel2,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "12px 14px",
  color: C.paper,
  fontFamily: FONT_BODY,
  fontSize: 14.5,
  outline: "none",
};

function primaryButtonStyle(loading) {
  return {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: C.amber, border: "none", borderRadius: 24,
    padding: "13px 14px", color: C.ink, fontSize: 14.5, fontWeight: 700,
    cursor: loading ? "default" : "pointer", marginTop: 4,
  };
}

const linkButtonStyle = {
  background: "transparent", border: "none", color: C.muted,
  fontSize: 12.5, cursor: "pointer", padding: 4,
};

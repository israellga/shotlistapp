import React, { useState } from "react";
import { Film, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";

const C = {
  ink: "#17181A",
  panel: "#1F2124",
  panel2: "#26282C",
  line: "#37393E",
  paper: "#ECE8DF",
  muted: "#96938B",
  faint: "#6B6963",
  amber: "#E2A33D",
  amberDim: "#4A3B21",
  sage: "#6FA07E",
  sageDim: "#233A2A",
  brick: "#C1613F",
  brickDim: "#3A241C",
};

const FONT_DISPLAY = "'Oswald', 'Arial Narrow', sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";
const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim() || !password.trim()) {
      setError("Preencha email e senha.");
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
      });
      if (err) {
        setError(traduzErro(err.message));
      } else if (data.session) {
        onAuthed();
      } else {
        setNotice("Conta criada! Verifique seu email para confirmar antes de entrar.");
        setMode("login");
      }
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.ink, display: "grid", placeItems: "center", padding: 20, fontFamily: FONT_BODY }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26, justifyContent: "center" }}>
          <Film size={22} color={C.amber} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, letterSpacing: 0.5, color: C.paper }}>
            PRODUÇÃO — ROTEIRO &amp; CAPTAÇÃO
          </div>
        </div>

        <div style={{ display: "flex", background: C.panel2, borderRadius: 9, padding: 4, marginBottom: 20 }}>
          {["login", "signup"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); setNotice(""); }}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 6, border: "none", cursor: "pointer",
                background: mode === m ? C.amberDim : "transparent",
                color: mode === m ? C.amber : C.muted,
                fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.4,
              }}
            >
              {m === "login" ? "ENTRAR" : "CRIAR CONTA"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

          {error && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: C.brickDim, border: `1px solid ${C.brick}`, borderRadius: 8, padding: "10px 12px", color: C.brick, fontSize: 12.5, lineHeight: 1.5 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}
          {notice && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: C.sageDim, border: `1px solid ${C.sage}`, borderRadius: 8, padding: "10px 12px", color: C.sage, fontSize: 12.5, lineHeight: 1.5 }}>
              <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 8,
              padding: "11px 14px", color: C.amber, fontSize: 14, fontWeight: 600,
              cursor: loading ? "default" : "pointer", marginTop: 4,
            }}
          >
            {loading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
            {mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
  padding: "11px 13px",
  color: C.paper,
  fontFamily: FONT_BODY,
  fontSize: 14,
  outline: "none",
};

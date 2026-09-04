import React, { useState } from "react";
import { Loader2, AlertCircle, Building2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import ShotlistMark from "./ShotlistMark";
import { C, FONT_DISPLAY, FONT_BODY } from "./theme";

export default function WorkspaceOnboarding({ onCreated, userEmail, onSignOut }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Digite o nome da sua produtora ou empresa.");
      return;
    }
    setError("");
    setLoading(true);
    const { data, error: err } = await supabase.rpc("create_workspace", { ws_name: name.trim() });
    setLoading(false);
    if (err) {
      setError(err.message || "Não consegui criar seu espaço agora.");
      return;
    }
    onCreated(data);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.ink, display: "grid", placeItems: "center", padding: 20, fontFamily: FONT_BODY }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30, justifyContent: "center" }}>
          <ShotlistMark size={26} lit />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: 1, color: C.paper }}>
            SHOTLIST
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <Building2 size={26} color={C.amber} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: C.paper, marginBottom: 6 }}>
            Crie seu espaço
          </div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            {userEmail} ainda não faz parte de nenhum espaço de trabalho.
            Crie o seu — fica completamente separado de qualquer outra produtora usando o Shotlist.
          </div>
        </div>

        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da sua produtora/empresa"
            autoFocus
            style={{
              background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8,
              padding: "12px 14px", color: C.paper, fontFamily: FONT_BODY, fontSize: 14.5, outline: "none",
            }}
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
              background: C.amber, border: "none", borderRadius: 24,
              padding: "13px 14px", color: C.ink, fontSize: 14.5, fontWeight: 700,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
            Criar meu espaço
          </button>
          <button
            type="button"
            onClick={onSignOut}
            style={{ background: "transparent", border: "none", color: C.muted, fontSize: 12.5, cursor: "pointer", padding: 4 }}
          >
            Sair
          </button>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } button, input { font-family: inherit; }`}</style>
    </div>
  );
}

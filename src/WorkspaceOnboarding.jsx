import React, { useState } from "react";
import { Loader2, AlertCircle, Building2, Mail, Check } from "lucide-react";
import { supabase } from "./supabaseClient";
import ShotlistMark from "./ShotlistMark";
import { C, FONT_DISPLAY, FONT_BODY } from "./theme";

export default function WorkspaceOnboarding({ onCreated, userEmail, onSignOut, pendingInvites = [], onAcceptInvite }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptingId, setAcceptingId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(pendingInvites.length === 0);

  async function handleAccept(inviteId) {
    setAcceptingId(inviteId);
    setError("");
    const { error: err } = await supabase.rpc("accept_workspace_invite", { invite_id: inviteId });
    setAcceptingId(null);
    if (err) {
      setError(err.message || "Não consegui aceitar esse convite.");
      return;
    }
    onAcceptInvite && onAcceptInvite();
  }

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

        {pendingInvites.length > 0 && (
          <div style={{ marginBottom: 26 }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <Mail size={24} color={C.amber} style={{ marginBottom: 8 }} />
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: C.paper }}>
                Você foi convidado
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingInvites.map((inv) => (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel2, border: `1px solid ${C.amber}`, borderRadius: 9, padding: "12px 14px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: C.paper }}>{inv.workspaces?.name || "Espaço de trabalho"}</div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>como {inv.role === "gestor" ? "gestor" : "regular"}</div>
                  </div>
                  <button
                    onClick={() => handleAccept(inv.id)}
                    disabled={acceptingId === inv.id}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 7, padding: "8px 12px", color: C.amber, fontSize: 12.5, fontWeight: 600, cursor: acceptingId === inv.id ? "default" : "pointer" }}
                  >
                    {acceptingId === inv.id ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
                    Aceitar
                  </button>
                </div>
              ))}
            </div>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                style={{ display: "block", margin: "16px auto 0", background: "transparent", border: "none", color: C.muted, fontSize: 12.5, cursor: "pointer" }}
              >
                Prefiro criar meu próprio espaço
              </button>
            )}
          </div>
        )}

        {showCreateForm && (
          <>
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
            </form>
          </>
        )}

        {pendingInvites.length > 0 && error && !showCreateForm && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: C.brickDim, border: `1px solid ${C.brick}`, borderRadius: 8, padding: "10px 12px", color: C.brick, fontSize: 12.5, lineHeight: 1.5, marginTop: 12 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        <button
          type="button"
          onClick={onSignOut}
          style={{ display: "block", margin: "18px auto 0", background: "transparent", border: "none", color: C.muted, fontSize: 12.5, cursor: "pointer", padding: 4 }}
        >
          Sair
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } button, input { font-family: inherit; }`}</style>
    </div>
  );
}


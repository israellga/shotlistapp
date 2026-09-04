import React, { useState, useEffect } from "react";
import { X, Loader2, ShieldCheck, User, Check, XCircle, Pencil } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";

const STATUS_LABEL = { pending: "Pendente", approved: "Aprovado", rejected: "Recusado" };
const STATUS_COLOR = { pending: C.amber, approved: C.sage, rejected: C.brick };

export default function AccountsPanel({ onClose, myUserId, workspaceId, workspaceName, onRenameWorkspace }) {
  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [savingId, setSavingId] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(workspaceName || "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    setNameDraft(workspaceName || "");
  }, [workspaceName]);

  async function saveWorkspaceName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError("O nome não pode ficar em branco.");
      return;
    }
    setNameError("");
    setSavingName(true);
    const { error } = await supabase.from("workspaces").update({ name: trimmed }).eq("id", workspaceId);
    setSavingName(false);
    if (error) {
      setNameError(error.message || "Não consegui salvar agora.");
      return;
    }
    onRenameWorkspace && onRenameWorkspace(trimmed);
    setEditingName(false);
  }

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from("workspace_members").select("*").eq("workspace_id", workspaceId).order("status").order("email").then(({ data, error }) => {
      if (!error) setMembers(data || []);
      setStatus("ready");
    });
  }, [workspaceId]);

  async function changeRole(userId, role) {
    setSavingId(userId);
    const { error } = await supabase.from("workspace_members").update({ role }).eq("workspace_id", workspaceId).eq("user_id", userId);
    if (!error) {
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role } : m)));
    }
    setSavingId(null);
  }

  async function changeStatus(userId, newStatus) {
    setSavingId(userId);
    const { error } = await supabase.from("workspace_members").update({ status: newStatus }).eq("workspace_id", workspaceId).eq("user_id", userId);
    if (!error) {
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, status: newStatus } : m)));
    }
    setSavingId(null);
  }

  const pending = members.filter((m) => m.status === "pending");
  const others = members.filter((m) => m.status !== "pending");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 55, display: "grid", placeItems: "center", padding: 20, fontFamily: FONT_BODY }}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 18px", borderBottom: `1px solid ${C.line}` }}>
          <ShieldCheck size={17} color={C.amber} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: C.paper }}>CONTAS DA EQUIPE</div>
            {editingName ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveWorkspaceName(); if (e.key === "Escape") { setEditingName(false); setNameDraft(workspaceName || ""); setNameError(""); } }}
                  autoFocus
                  style={{ flex: 1, minWidth: 0, background: C.panel2, border: `1px solid ${C.amber}`, borderRadius: 6, padding: "4px 8px", color: C.paper, fontSize: 11.5, fontFamily: FONT_BODY, outline: "none" }}
                />
                <button
                  onClick={saveWorkspaceName}
                  disabled={savingName}
                  style={{ background: "transparent", border: "none", color: C.sage, cursor: savingName ? "default" : "pointer", flexShrink: 0 }}
                >
                  {savingName ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />}
                </button>
              </div>
            ) : (
              workspaceName && (
                <div
                  onClick={() => setEditingName(true)}
                  style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.faint, marginTop: 1, cursor: "pointer" }}
                >
                  {workspaceName}
                  <Pencil size={10} />
                </div>
              )
            )}
            {nameError && <div style={{ fontSize: 10.5, color: C.brick, marginTop: 3 }}>{nameError}</div>}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {status === "loading" ? (
            <div style={{ display: "grid", placeItems: "center", padding: 40 }}>
              <Loader2 size={20} color={C.faint} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.amber, letterSpacing: 0.5, marginBottom: 8 }}>
                    AGUARDANDO APROVAÇÃO ({pending.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pending.map((m) => (
                      <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 9, padding: "11px 12px" }}>
                        <User size={15} color={C.amber} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.email}
                        </div>
                        {savingId === m.user_id ? (
                          <Loader2 size={14} color={C.faint} style={{ animation: "spin 1s linear infinite" }} />
                        ) : (
                          <>
                            <button
                              onClick={() => changeStatus(m.user_id, "approved")}
                              title="Aprovar"
                              style={{ display: "flex", alignItems: "center", gap: 5, background: C.sageDim, border: `1px solid ${C.sage}`, borderRadius: 6, padding: "6px 10px", color: C.sage, fontSize: 12, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer" }}
                            >
                              <Check size={13} /> Aprovar
                            </button>
                            <button
                              onClick={() => changeStatus(m.user_id, "rejected")}
                              title="Recusar"
                              style={{ display: "flex", alignItems: "center", background: "transparent", border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px", color: C.faint, fontFamily: FONT_BODY, cursor: "pointer" }}
                            >
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.muted, letterSpacing: 0.5, marginBottom: 8 }}>
                CONTAS ({others.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {others.map((m) => (
                  <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 12px" }}>
                    <User size={15} color={C.faint} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.email}{m.user_id === myUserId && <span style={{ color: C.faint }}> (você)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: STATUS_COLOR[m.status], fontFamily: FONT_MONO, marginTop: 1 }}>
                        {STATUS_LABEL[m.status] || m.status}
                      </div>
                    </div>
                    {savingId === m.user_id ? (
                      <Loader2 size={14} color={C.faint} style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.user_id, e.target.value)}
                        disabled={m.user_id === myUserId}
                        style={{
                          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px",
                          color: C.paper, fontSize: 12.5, fontFamily: FONT_BODY, outline: "none", colorScheme: "dark",
                        }}
                      >
                        <option value="regular">Regular</option>
                        <option value="gestor">Gestor</option>
                      </select>
                    )}
                  </div>
                ))}
                {members.length === 0 && (
                  <div style={{ color: C.faint, fontSize: 13, textAlign: "center", padding: 30 }}>Nenhuma conta encontrada.</div>
                )}
              </div>

              <div style={{ marginTop: 18, fontSize: 11.5, color: C.faint, lineHeight: 1.5, textAlign: "center" }}>
                Convidar alguém de fora pro seu espaço chega numa próxima atualização.
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

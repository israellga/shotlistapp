import React, { useState, useEffect } from "react";
import { X, Loader2, ShieldCheck, User, Check } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";

const ROLE_LABEL = { regular: "Regular", gestor: "Gestor" };

export default function AccountsPanel({ onClose, myUserId }) {
  const [profiles, setProfiles] = useState([]);
  const [status, setStatus] = useState("loading");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    supabase.from("profiles").select("*").order("email").then(({ data, error }) => {
      if (!error) setProfiles(data || []);
      setStatus("ready");
    });
  }, []);

  async function changeRole(id, role) {
    setSavingId(id);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (!error) {
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
    }
    setSavingId(null);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 55, display: "grid", placeItems: "center", padding: 20, fontFamily: FONT_BODY }}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 18px", borderBottom: `1px solid ${C.line}` }}>
          <ShieldCheck size={17} color={C.amber} />
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: C.paper, flex: 1 }}>CONTAS DA EQUIPE</div>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {profiles.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 12px" }}>
                  <User size={15} color={C.faint} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.email}{p.id === myUserId && <span style={{ color: C.faint }}> (você)</span>}
                    </div>
                  </div>
                  {savingId === p.id ? (
                    <Loader2 size={14} color={C.faint} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <select
                      value={p.role}
                      onChange={(e) => changeRole(p.id, e.target.value)}
                      disabled={p.id === myUserId}
                      style={{
                        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px",
                        color: C.paper, fontSize: 12.5, outline: "none", colorScheme: "dark",
                      }}
                    >
                      <option value="regular">Regular</option>
                      <option value="gestor">Gestor</option>
                    </select>
                  )}
                </div>
              ))}
              {profiles.length === 0 && (
                <div style={{ color: C.faint, fontSize: 13, textAlign: "center", padding: 30 }}>Nenhuma conta encontrada.</div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

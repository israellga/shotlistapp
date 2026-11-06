import React, { useState } from "react";
import { X, Settings, User, Users, Zap, PenLine } from "lucide-react";
import AccountPanel from "./AccountPanel";
import AccountsPanel from "./AccountsPanel";
import { AsaasConnect } from "./asaas";
import { ZapsignConnect } from "./zapsign";
import { TemplatesManager } from "./contractTemplates";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";

// Janela única de configurações da conta: senha, equipe (nome, membros, permissões) e cobranças (Asaas).
export default function SettingsPanel({ onClose, email, myUserId, workspaceId, workspaceName, onRenameWorkspace, isGestor }) {
  const tabs = [
    { key: "conta", label: "Conta", icon: <User size={14} /> },
    ...(isGestor ? [
      { key: "equipe", label: "Equipe", icon: <Users size={14} /> },
      { key: "cobrancas", label: "Cobranças", icon: <Zap size={14} /> },
      { key: "assinaturas", label: "Assinaturas", icon: <PenLine size={14} /> },
    ] : []),
  ];
  const [tab, setTab] = useState("conta");
  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 55, display: "grid", placeItems: "center", padding: 20, fontFamily: FONT_BODY }}>
      <div className="modal-card" style={{ width: "100%", maxWidth: 520, maxHeight: "86vh", display: "flex", flexDirection: "column", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 18px 10px" }}>
          <Settings size={17} color={C.amber} />
          <div style={{ flex: 1, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: C.paper }}>CONFIGURAÇÕES</div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 4, padding: "0 14px 10px", borderBottom: `1px solid ${C.line}` }}>
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", padding: "7px 12px", borderRadius: 7, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, background: on ? C.amberDim : "transparent", color: on ? C.amber : C.muted }}>
                {t.icon}{t.label}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {tab === "conta" && (
            <>
              {email && <div style={{ fontSize: 12, color: C.faint, fontFamily: FONT_MONO, marginBottom: 14 }}>{email}</div>}
              <AccountPanel embedded email={email} onClose={onClose} />
            </>
          )}
          {tab === "equipe" && isGestor && (
            <AccountsPanel embedded onClose={onClose} myUserId={myUserId} workspaceId={workspaceId} workspaceName={workspaceName} onRenameWorkspace={onRenameWorkspace} />
          )}
          {tab === "cobrancas" && isGestor && workspaceId && (
            <div style={{ marginTop: -22 }}><AsaasConnect workspaceId={workspaceId} email={email} /></div>
          )}
          {tab === "assinaturas" && isGestor && workspaceId && (<><ZapsignConnect workspaceId={workspaceId} /><TemplatesManager workspaceId={workspaceId} /></>)}
        </div>
      </div>
    </div>
  );
}

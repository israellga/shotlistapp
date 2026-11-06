import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { C, FONT_BODY } from "./theme";
import { pushState, enablePush, isIOS, isStandalone, pushSupported } from "./push";

// Convite discreto pra ligar os avisos no celular (some depois de ativados).
export default function PushPrompt({ workspaceId }) {
  const [st, setSt] = useState("loading");
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setSt); }, []);

  if (st === "on" || st === "loading" || st === "denied") return null;
  const needsInstall = isIOS() && !isStandalone() && !pushSupported();
  if (st === "unsupported" && !needsInstall) return null;

  return (
    <div className="glass" style={{ borderRadius: 16, padding: "12px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
      <Bell size={18} color={C.amber} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 13.5, color: C.muted, lineHeight: 1.45 }}>
        {needsInstall
          ? "Para receber avisos de captação no iPhone, adicione o Shotlist à tela inicial (Compartilhar › Adicionar à Tela de Início) e abra por lá."
          : "Receba um aviso às 8h nos dias de captação e entrega."}
      </div>
      {!needsInstall && (
        <button
          disabled={busy}
          onClick={async () => { setBusy(true); const ok = await enablePush(workspaceId); setBusy(false); setSt(ok ? "on" : await pushState()); }}
          style={{ minHeight: 40, padding: "0 16px", borderRadius: 20, border: `1px solid ${C.amber}`, background: C.amberDim, color: C.amber, fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
        >
          {busy ? "Ativando…" : "Ativar"}
        </button>
      )}
    </div>
  );
}

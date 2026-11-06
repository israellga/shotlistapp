import React, { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_BODY, FONT_MONO } from "./theme";
import { BRIEFING_CAMPOS } from "./BriefingView";

// Lado do produtor: mostra o que o cliente respondeu e copia o link do briefing.
export default function BriefingSection({ production, onEnableShare }) {
  const [row, setRow] = useState(null);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/?briefing=${production.id}`;

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase.from("production_briefing").select("*").eq("production_id", production.id).maybeSingle();
      if (alive) setRow(data || null);
    }
    load();
    const ch = supabase.channel(`briefing:${production.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "production_briefing", filter: `production_id=eq.${production.id}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [production.id]);

  async function copy() {
    if (!production.clientShareEnabled) onEnableShare();
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* ignore */ }
  }
  const answered = row && BRIEFING_CAMPOS.some(([k]) => (row.data?.[k] || "").trim());

  return (
    <div>
      <button onClick={copy} style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 16px", borderRadius: 22, border: `1px solid ${C.line}`, background: "transparent", color: copied ? C.sage : C.paper, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Link copiado" : "Copiar link do briefing"}
      </button>
      {!production.clientShareEnabled && <div style={{ fontSize: 12, color: C.faint, marginTop: 8 }}>Ao copiar, o compartilhamento com o cliente é ativado, porque o briefing usa o mesmo link seguro.</div>}
      {!answered && <div style={{ fontSize: 13.5, color: C.faint, marginTop: 12 }}>O cliente ainda não respondeu.</div>}
      {answered && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: C.faint, fontFamily: FONT_MONO }}>
            RESPONDIDO{row.author ? ` POR ${row.author.toUpperCase()}` : ""} · {new Date(row.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </div>
          {BRIEFING_CAMPOS.filter(([k]) => (row.data?.[k] || "").trim()).map(([k, label]) => (
            <div key={k}>
              <div style={{ fontSize: 12, color: C.faint }}>{label}</div>
              <div style={{ fontSize: 14.5, color: C.paper, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{row.data[k]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

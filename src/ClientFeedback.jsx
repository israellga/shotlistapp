import React, { useEffect, useState } from "react";
import { CheckCircle2, MessageSquare, Trash2, ChevronDown } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_BODY } from "./theme";

function fmtWhen(iso) {
  try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

// What the client said on the shared link: approval, adjustment requests and per-shot comments.
export default function ClientFeedback({ productionId, enabled, isGestor }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || !productionId) { setItems([]); return; }
    let alive = true;
    async function load() {
      const { data } = await supabase.from("client_feedback").select("*").eq("production_id", productionId).order("created_at", { ascending: true });
      if (alive && Array.isArray(data)) setItems(data);
    }
    load();
    const ch = supabase
      .channel(`feedback:${productionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_feedback", filter: `production_id=eq.${productionId}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [productionId, enabled]);

  if (!enabled || items.length === 0) return null;
  const general = items.filter((i) => i.shot_numero == null && (i.kind === "approved" || i.kind === "adjust"));
  const last = general[general.length - 1];
  const comments = items.filter((i) => i.kind === "comment" || (i.kind === "adjust"));

  async function remove(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("client_feedback").delete().eq("id", id);
  }

  return (
    <div className="glass" style={{ borderRadius: 16, padding: "12px 14px", marginBottom: 18 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 44, background: "transparent", border: "none", color: C.paper, cursor: "pointer", padding: 0, fontFamily: FONT_BODY, textAlign: "left" }}
      >
        {last?.kind === "approved" ? <CheckCircle2 size={18} color={C.sage} /> : <MessageSquare size={18} color={C.amber} />}
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>
          {last?.kind === "approved" ? "Cliente aprovou o shotlist" : last?.kind === "adjust" ? "Cliente pediu ajuste" : "Comentários do cliente"}
          <span style={{ fontWeight: 400, color: C.faint, fontSize: 12.5 }}> · {comments.length} comentário{comments.length === 1 ? "" : "s"}</span>
        </span>
        <ChevronDown size={16} color={C.faint} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)" }} />
      </button>
      {open && (
        <div className="fade-in-up" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((i) => (
            <div key={i.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: C.paper, lineHeight: 1.45 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.faint }}>
                  {i.author || "Cliente"} · {fmtWhen(i.created_at)} · {i.kind === "approved" ? "aprovou" : i.kind === "adjust" ? "pediu ajuste" : i.shot_numero != null ? `shot ${String(i.shot_numero).padStart(2, "0")}` : "comentário"}
                </div>
                {i.message && <div>{i.message}</div>}
              </div>
              {isGestor && (
                <button onClick={() => remove(i.id)} title="Apagar" style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", minWidth: 36, minHeight: 36 }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

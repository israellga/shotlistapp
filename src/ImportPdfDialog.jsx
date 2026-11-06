import React, { useRef, useState } from "react";
import { X, FileUp, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_DISPLAY, FONT_BODY } from "./theme";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("Não consegui ler o arquivo."));
    r.readAsDataURL(file);
  });
}

export default function ImportPdfDialog({ onClose, onCreate, onApply, target, clients }) {
  const [mode, setMode] = useState("merge");
  const input = useRef(null);
  const [state, setState] = useState("pick"); // pick | reading | preview
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Escolha um arquivo PDF."); return; }
    if (file.size > 6 * 1024 * 1024) { setError("PDF acima de 6 MB. Exporte uma versão menor."); return; }
    setError(""); setState("reading");
    try {
      const pdfBase64 = await toBase64(file);
      const { data, error: err } = await supabase.functions.invoke("import-production-pdf", { body: { pdfBase64 } });
      if (err) {
        let detail = "";
        try { detail = (await err.context?.json?.())?.error || ""; } catch { /* ignore */ }
        throw new Error(detail || err.message);
      }
      if (data?.error) throw new Error(data.error);
      setDraft(data.data);
      setState("preview");
    } catch (e2) {
      setError(e2?.message || "Não consegui analisar esse PDF.");
      setState("pick");
    }
  }

  const matched = draft && Object.values(clients || {}).find((c) => c.name && draft.cliente && c.name.trim().toLowerCase() === draft.cliente.trim().toLowerCase());
  const shots = draft?.shots || [];
  const withTime = shots.filter((s) => s.horario).length;

  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 60, display: "grid", placeItems: "center", padding: 20, fontFamily: FONT_BODY }}>
      <div className="modal-card" style={{ width: "100%", maxWidth: 520, maxHeight: "86vh", display: "flex", flexDirection: "column", borderRadius: 22 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 18px" }}>
          <div style={{ flex: 1, fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: C.paper }}>{target ? "Importar PDF nesta produção" : "Importar PDF"}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", minWidth: 40, minHeight: 40 }}><X size={18} /></button>
        </div>

        <div style={{ padding: "0 18px 18px", overflowY: "auto" }}>
          {state !== "preview" && (
            <>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.5, marginTop: 0 }}>
                Envie um briefing, shotlist ou roteiro em PDF. O app lê o documento e monta a produção com cliente, datas, horários, shots e equipe. Você confere antes de criar.{target ? " Aqui ele completa a produção que você abriu." : ""}
              </p>
              <button
                onClick={() => input.current?.click()}
                disabled={state === "reading"}
                style={{ width: "100%", minHeight: 96, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: `1px dashed ${C.line}`, color: C.paper, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 14 }}
              >
                {state === "reading" ? <><Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /> Lendo o PDF, isso leva alguns segundos...</> : <><FileUp size={22} /> Escolher PDF</>}
              </button>
              <input ref={input} type="file" accept="application/pdf" onChange={pick} style={{ display: "none" }} />
              {error && <div style={{ display: "flex", gap: 8, color: C.brick, fontSize: 13.5, marginTop: 12 }}><AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}</div>}
            </>
          )}

          {state === "preview" && draft && (
            <>
              <label style={{ display: "block", fontSize: 12, color: C.faint, marginBottom: 4 }}>Cliente</label>
              <input value={draft.cliente || ""} onChange={(e) => setDraft({ ...draft, cliente: e.target.value })} style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 13px", color: C.paper, fontSize: 16, outline: "none", marginBottom: 6, fontFamily: FONT_BODY }} />
              <div style={{ fontSize: 12.5, color: matched ? C.sage : C.faint, marginBottom: 14 }}>
                {matched ? "Cliente já cadastrado, será vinculado." : "Cliente ainda não cadastrado. A produção é criada sem vínculo."}
              </div>

              <div className="glass" style={{ borderRadius: 14, padding: "12px 14px", fontSize: 14, color: C.paper, lineHeight: 1.7, marginBottom: 12 }}>
                <div><span style={{ color: C.faint }}>Data: </span>{draft.data ? `${draft.data}${draft.dataFim ? " até " + draft.dataFim : ""}` : "a definir"}</div>
                <div><span style={{ color: C.faint }}>Horário: </span>{draft.horaInicio || draft.horaFim ? `${draft.horaInicio || "?"} às ${draft.horaFim || "?"}` : "não informado"}</div>
                {draft.responsavel && <div><span style={{ color: C.faint }}>Responsável: </span>{draft.responsavel}</div>}
                {draft.objetivoDia && <div><span style={{ color: C.faint }}>Demanda: </span>{draft.objetivoDia}</div>}
                <div><span style={{ color: C.faint }}>Shots: </span>{shots.length}{withTime ? ` · ${withTime} com horário` : ""}</div>
                {(draft.equipe || []).length > 0 && <div><span style={{ color: C.faint }}>Equipe: </span>{draft.equipe.map((m) => [m.funcao, m.responsavel].filter(Boolean).join(" ")).join(", ")}</div>}
                {draft.orcamento ? <div><span style={{ color: C.faint }}>Orçamento: </span>R$ {Number(draft.orcamento).toLocaleString("pt-BR")}</div> : null}
              </div>

              {shots.length > 0 && (
                <div style={{ maxHeight: 150, overflowY: "auto", fontSize: 13, color: C.muted, lineHeight: 1.55, marginBottom: 12 }}>
                  {shots.slice(0, 60).map((s, i) => (
                    <div key={i}>{String(i + 1).padStart(2, "0")} {s.nome}{s.horario ? <span style={{ color: C.faint }}> · {s.horario}</span> : null}</div>
                  ))}
                </div>
              )}

              {(draft.avisos || []).length > 0 && (
                <div style={{ background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 12, padding: "10px 12px", fontSize: 13, color: C.paper, lineHeight: 1.5, marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, color: C.amber, marginBottom: 4 }}>O documento aponta pendências</div>
                  {draft.avisos.slice(0, 8).map((a, i) => <div key={i}>• {a}</div>)}
                </div>
              )}

              {target && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {[
                    ["merge", "Mesclar com o que já tem", `Preenche só os campos vazios, soma equipe e adiciona os shots que ainda não existem (pelo nome). Nada do que você já escreveu é apagado.`],
                    ["replace", "Substituir tudo", `Troca dados, equipe, shots e cronograma desta produção pelo conteúdo do PDF. Os ${(target.shots || []).length} shots atuais (com fotos, status e takes feitos) são removidos.`],
                  ].map(([k, t, d]) => (
                    <label key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 12px", borderRadius: 12, cursor: "pointer", border: `1px solid ${mode === k ? (k === "replace" ? C.brick : C.amber) : C.line}`, background: mode === k ? (k === "replace" ? C.brickDim : C.amberDim) : "transparent" }}>
                      <input type="radio" name="import-mode" checked={mode === k} onChange={() => setMode(k)} style={{ marginTop: 3 }} />
                      <span><span style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.paper }}>{t}</span><span style={{ display: "block", fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>{d}</span></span>
                    </label>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    if (!target) return onCreate(draft, matched || null);
                    if (mode === "replace" && !window.confirm("Substituir tudo? Os shots atuais, com fotos e status, serão apagados desta produção.")) return;
                    onApply(draft, matched || null, mode);
                  }}
                  className="btn-glass-primary" style={{ flex: 1, minHeight: 48, border: "none", borderRadius: 24, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT_BODY }}
                >{target ? (mode === "replace" ? "Substituir produção" : "Mesclar na produção") : "Criar produção"}</button>
                <button onClick={() => { setDraft(null); setState("pick"); }} style={{ minHeight: 48, padding: "0 18px", borderRadius: 24, background: "transparent", border: `1px solid ${C.line}`, color: C.muted, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 14 }}>Outro PDF</button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

import React, { useEffect, useState, useCallback, useRef } from "react";
import { PenLine, Loader2, CheckCircle2, AlertCircle, X, FileUp, RefreshCw, Download, Copy, Plus, Trash2, FileSignature } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_BODY, FONT_MONO, FONT_DISPLAY } from "./theme";
import { GenerateContractDialog } from "./contractTemplates";

export function useZapsignStatus(workspaceId) {
  const [st, setSt] = useState(null);
  const reload = useCallback(async () => {
    if (!workspaceId) { setSt({ connected: false }); return; }
    const { data, error } = await supabase.rpc("get_zapsign_status", { ws_id: workspaceId });
    setSt(error || !data ? { connected: false } : data);
  }, [workspaceId]);
  useEffect(() => { reload(); }, [reload]);
  return [st, reload];
}

async function callZap(body) {
  const { data, error } = await supabase.functions.invoke("zapsign", { body });
  if (error) {
    let detail = "";
    try { detail = (await error.context?.json?.())?.error || ""; } catch { /* ignore */ }
    throw new Error(detail || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const btn = { minHeight: 40, padding: "0 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const inputSt = { background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13.5, outline: "none", minWidth: 0 };

// Conexão da conta ZapSign do gestor (o token nunca volta ao navegador).
export function ZapsignConnect({ workspaceId }) {
  const [st, reload] = useZapsignStatus(workspaceId);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const on = st?.connected;

  async function connect() {
    setBusy("connect"); setMsg(null);
    try {
      const { data, error } = await supabase.rpc("save_zapsign_key", { ws_id: workspaceId, key_in: key });
      if (error || !data?.ok) throw new Error(data?.error || "Não consegui salvar o token.");
      await callZap({ action: "setup_webhook", workspace_id: workspaceId });
      setKey("");
      setMsg({ ok: true, text: "Conectado. Quando o cliente assinar, o contrato assinado é guardado aqui sozinho." });
      await reload();
    } catch (e) { setMsg({ ok: false, text: e.message || "Falha ao conectar." }); await reload(); }
    setBusy("");
  }
  async function reactivate() {
    setBusy("hook"); setMsg(null);
    try { await callZap({ action: "setup_webhook", workspace_id: workspaceId }); setMsg({ ok: true, text: "Aviso automático de assinatura reativado." }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy("");
  }
  async function disconnect() {
    if (!window.confirm("Desconectar o ZapSign? Você não poderá mais enviar contratos por aqui. Os contratos já guardados continuam.")) return;
    setBusy("off");
    await supabase.rpc("disconnect_zapsign", { ws_id: workspaceId });
    await reload();
    setBusy("");
  }
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <PenLine size={15} color={C.amber} />
        <span style={{ fontSize: 14, fontWeight: 600, color: C.paper }}>Assinatura de contratos com ZapSign</span>
        {on && <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.sage, border: `1px solid ${C.sage}`, borderRadius: 10, padding: "1px 7px" }}>CONECTADO</span>}
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
        {on
          ? "Os contratos saem pela sua conta do ZapSign (com os seus créditos e o seu plano). Ao serem assinados, o PDF assinado fica guardado no cliente, aqui no Shotlist."
          : "Conecte a sua conta do ZapSign. Copie o token da API em ZapSign > Configurações > Integrações > ZapSign API e cole abaixo."}
      </div>
      {st === null ? <Loader2 size={16} color={C.faint} style={{ animation: "spin 1s linear infinite" }} />
        : on ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={!!busy} onClick={reactivate} style={btn}>{busy === "hook" ? "Ativando…" : "Reativar aviso de assinatura"}</button>
            <button disabled={!!busy} onClick={disconnect} style={{ ...btn, color: C.brick, borderColor: C.brick }}>Desconectar</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Token da API do ZapSign" autoComplete="off" spellCheck={false} style={{ ...inputSt, fontFamily: FONT_MONO, fontSize: 12.5 }} />
            <button disabled={!!busy || key.trim().length < 20} onClick={connect} style={{ ...btn, background: C.amberDim, borderColor: C.amber, color: C.amber, opacity: key.trim().length < 20 ? 0.5 : 1 }}>
              {busy === "connect" ? "Conectando…" : "Conectar ZapSign"}
            </button>
          </div>
        )}
      {msg && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: msg.ok ? C.sage : C.brick }}>
          {msg.ok ? <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />} {msg.text}
        </div>
      )}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("Não consegui ler o arquivo."));
    r.readAsDataURL(file);
  });
}

// Gera um PDF simples (A4) a partir do texto do contrato.
export async function textToPdfBase64(titulo, texto) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 20, maxW = W - M * 2;
  let y = M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  for (const l of doc.splitTextToSize(titulo || "Contrato", maxW)) { doc.text(l, M, y); y += 7; }
  y += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  for (const para of String(texto || "").split("\n")) {
    const lines = para.trim() ? doc.splitTextToSize(para, maxW) : [""];
    for (const l of lines) {
      if (y > 297 - M) { doc.addPage(); y = M; }
      doc.text(l, M, y); y += 5.4;
    }
  }
  return doc.output("datauristring").split(",")[1];
}

const waDigits = (p) => (p || "").replace(/\D/g, "");

// Diálogo: confere os signatários e envia o PDF ao ZapSign.
export function SendContractDialog({ workspaceId, client, productionId, titulo: tituloIn, pdfBase64, fileName, issuerName, onClose, onSent }) {
  const [titulo, setTitulo] = useState(tituloIn || "");
  const [signers, setSigners] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      let myEmail = "";
      try { myEmail = (await supabase.auth.getUser())?.data?.user?.email || ""; } catch { /* ignore */ }
      setSigners([
        { id: "c", name: client?.name || "", email: client?.email || "", phone: client?.phone || "", whatsapp: false },
        { id: "g", name: issuerName || "", email: myEmail, phone: "", whatsapp: false, on: true },
      ]);
    })();
  }, [client, issuerName]);
  const upd = (id, f) => setSigners((p) => p.map((s) => (s.id === id ? { ...s, ...f } : s)));
  const active = signers.filter((s) => s.id === "c" || s.on !== false);

  async function send() {
    setError("");
    const list = active.filter((s) => s.name.trim() && (s.email.trim() || waDigits(s.phone)));
    if (!list.length) { setError("Preencha nome e e-mail ou celular de quem vai assinar."); return; }
    setBusy(true);
    try {
      await callZap({ action: "send_contract", workspace_id: workspaceId, client_id: client?.id || null, production_id: productionId || null, titulo: titulo.trim() || "Contrato", pdfBase64, signers: list });
      onSent?.();
      onClose();
    } catch (e) { setError(e.message || "Não consegui enviar."); }
    setBusy(false);
  }
  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 70, display: "grid", placeItems: "center", padding: 20, fontFamily: FONT_BODY }}>
      <div className="modal-card" style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", display: "flex", flexDirection: "column", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 18px" }}>
          <FileSignature size={17} color={C.amber} />
          <div style={{ flex: 1, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: C.paper }}>ENVIAR PARA ASSINATURA</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "0 18px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {fileName && <div style={{ fontSize: 12, color: C.faint, fontFamily: FONT_MONO }}>{fileName}</div>}
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nome do documento" style={inputSt} />
          <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO }}>QUEM ASSINA</div>
          {signers.map((s) => {
            const off = s.id !== "c" && s.on === false;
            return (
              <div key={s.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6, opacity: off ? 0.55 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 12, color: C.muted, fontWeight: 600 }}>{s.id === "c" ? "Cliente" : "Você (contratado)"}</span>
                  {s.id === "g" && <label style={{ fontSize: 12, color: C.muted, display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={!off} onChange={(e) => upd(s.id, { on: e.target.checked })} /> também assina</label>}
                </div>
                <input disabled={off} value={s.name} onChange={(e) => upd(s.id, { name: e.target.value })} placeholder="Nome completo" style={inputSt} />
                <input disabled={off} value={s.email} onChange={(e) => upd(s.id, { email: e.target.value })} placeholder="E-mail" inputMode="email" style={inputSt} />
                <input disabled={off} value={s.phone} onChange={(e) => upd(s.id, { phone: e.target.value })} placeholder="Celular com DDD (opcional)" inputMode="tel" style={inputSt} />
                {!off && waDigits(s.phone) && (
                  <label style={{ fontSize: 12, color: C.muted, display: "flex", gap: 6, alignItems: "flex-start", cursor: "pointer", lineHeight: 1.4 }}>
                    <input type="checkbox" checked={!!s.whatsapp} onChange={(e) => upd(s.id, { whatsapp: e.target.checked })} style={{ marginTop: 2 }} /> Enviar também por WhatsApp (pode consumir créditos do seu plano no ZapSign)
                  </label>
                )}
              </div>
            );
          })}
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>O ZapSign envia o link de assinatura por e-mail. Quem assina confirma na tela do ZapSign.</div>
          {error && <div style={{ display: "flex", gap: 8, color: C.brick, fontSize: 13 }}><AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{error}</div>}
          <button disabled={busy || !pdfBase64} onClick={send} style={{ ...btn, minHeight: 46, background: C.amberDim, borderColor: C.amber, color: C.amber }}>{busy ? "Enviando…" : "Enviar para assinatura"}</button>
        </div>
      </div>
    </div>
  );
}

// Botão pronto para usar na proposta: gera o PDF do contrato preenchido e abre o diálogo.
export function SendProposalContract({ workspaceId, client, titulo, texto, issuerName, onSent }) {
  const [st] = useZapsignStatus(workspaceId);
  const [dlg, setDlg] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!st?.connected) return null;
  async function open() {
    setBusy(true);
    try { setDlg({ pdf: await textToPdfBase64(titulo || "Contrato", texto) }); } finally { setBusy(false); }
  }
  return (
    <>
      <button onClick={open} disabled={busy} style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
        <PenLine size={14} /> {busy ? "Gerando PDF…" : "Enviar contrato para assinatura (ZapSign)"}
      </button>
      {dlg && <SendContractDialog workspaceId={workspaceId} client={client} titulo={`Contrato - ${titulo || client?.name || ""}`} pdfBase64={dlg.pdf} issuerName={issuerName} onClose={() => setDlg(null)} onSent={onSent} />}
    </>
  );
}

const STATUS = { pending: ["Aguardando assinatura", C.amber], signed: ["Assinado", C.sage], refused: ["Recusado", C.brick] };

// Lista de contratos do cliente + envio de um PDF próprio.
export function ContractsSection({ client, workspaceId, issuerName, productions, plans, financeMap }) {
  const [st] = useZapsignStatus(workspaceId);
  const [list, setList] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [dlg, setDlg] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [gen, setGen] = useState(false);
  const input = useRef(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("contracts").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
    setList(data || []);
  }, [client.id]);
  useEffect(() => { load(); }, [load]);

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") { setErr("Escolha um arquivo PDF."); return; }
    if (file.size > 9 * 1024 * 1024) { setErr("PDF acima de 9 MB."); return; }
    setErr("");
    setDlg({ pdf: await fileToBase64(file), name: file.name, titulo: file.name.replace(/\.pdf$/i, "") });
  }
  async function refresh(c) {
    setBusyId(c.id); setErr("");
    try { await callZap({ action: "refresh", contract_id: c.id }); await load(); }
    catch (e) { setErr(e.message); }
    setBusyId("");
  }
  async function download(path) {
    const { data } = await supabase.storage.from("contratos").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else setErr("Não consegui abrir o arquivo.");
  }
  async function copy(url, key) {
    try { await navigator.clipboard.writeText(url); setCopied(key); setTimeout(() => setCopied(""), 2000); } catch { /* ignore */ }
  }
  async function remove(c) {
    if (!window.confirm("Remover este contrato do Shotlist? Ele continua no ZapSign.")) return;
    await supabase.from("contracts").delete().eq("id", c.id);
    setList((p) => p.filter((x) => x.id !== c.id));
  }

  if (!st?.connected && list.length === 0 && !(st && (productions || plans))) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <PenLine size={16} color={C.faint} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.5, flex: 1 }}>CONTRATOS PARA ASSINATURA ({list.length})</span>
        {st?.connected && (
          <button onClick={() => setGen(true)} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 40, background: "transparent", border: `1px solid ${C.amber}`, borderRadius: 20, padding: "0 14px", color: C.amber, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_BODY }}>
            <FileSignature size={14} /> Usar modelo
          </button>
        )}
        {st?.connected && (
          <button onClick={() => input.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 40, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 20, padding: "0 14px", color: C.amber, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_BODY }}>
            <FileUp size={14} /> Enviar PDF
          </button>
        )}
        <input ref={input} type="file" accept="application/pdf" onChange={pickFile} style={{ display: "none" }} />
      </div>
      {err && <div style={{ color: C.brick, fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
      {list.length === 0 && <div style={{ color: C.faint, fontSize: 13, padding: "6px 4px" }}>Nenhum contrato enviado ainda. Envie um PDF ou use o botão dentro de uma proposta.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((c) => {
          const [label, color] = STATUS[c.status] || STATUS.pending;
          return (
            <div key={c.id} className="glass" style={{ borderRadius: 16, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.titulo}</div>
                  <div style={{ fontSize: 12, color, fontWeight: 600 }}>{label}{c.signed_at ? ` · ${new Date(c.signed_at).toLocaleDateString("pt-BR")}` : ""}</div>
                </div>
                {c.status !== "signed" && <button disabled={busyId === c.id} onClick={() => refresh(c)} title="Atualizar status" style={{ ...btn, minHeight: 34, padding: "0 10px" }}>{busyId === c.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}</button>}
                <button onClick={() => remove(c)} title="Remover" style={{ ...btn, minHeight: 34, padding: "0 10px", color: C.brick }}><Trash2 size={14} /></button>
              </div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {(c.signers || []).map((s, i) => (
                  <div key={s.token || i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.muted }}>
                    {s.status === "signed" ? <CheckCircle2 size={13} color={C.sage} /> : <span style={{ width: 13, height: 13, borderRadius: 7, border: `1px solid ${C.line}`, display: "inline-block" }} />}
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}{s.email ? ` · ${s.email}` : ""}</span>
                    {s.status !== "signed" && s.signUrl && c.status !== "refused" && (
                      <button onClick={() => copy(s.signUrl, c.id + i)} style={{ background: "transparent", border: "none", color: C.amber, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FONT_BODY }}><Copy size={12} /> {copied === c.id + i ? "Copiado" : "Copiar link"}</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {c.signed_path && <button onClick={() => download(c.signed_path)} style={{ ...btn, minHeight: 36, color: C.sage, borderColor: C.sage, display: "inline-flex", alignItems: "center", gap: 6 }}><Download size={14} /> Baixar assinado</button>}
                {c.original_path && <button onClick={() => download(c.original_path)} style={{ ...btn, minHeight: 36, display: "inline-flex", alignItems: "center", gap: 6 }}><Download size={14} /> Original</button>}
              </div>
            </div>
          );
        })}
      </div>
      {gen && <GenerateContractDialog workspaceId={workspaceId} client={client} productions={productions || []} financeMap={financeMap} plans={plans || []} issuerName={issuerName} onClose={() => setGen(false)} onSent={load} />}
      {dlg && <SendContractDialog workspaceId={workspaceId} client={client} titulo={dlg.titulo} pdfBase64={dlg.pdf} fileName={dlg.name} issuerName={issuerName} onClose={() => setDlg(null)} onSent={load} />}
    </div>
  );
}

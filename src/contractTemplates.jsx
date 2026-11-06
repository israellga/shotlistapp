import { uid as secureUid } from "./uid";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { FileText, Plus, Trash2, FileUp, X, Loader2, AlertCircle, Download, PenLine } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_BODY, FONT_MONO, FONT_DISPLAY } from "./theme";
import { formatBRL } from "./finance";
import { formatIntervaloDatas } from "./datetime";
import { SendContractDialog, textToPdfBase64, useZapsignStatus } from "./zapsign";

const uid = () => secureUid();

// Campos que o modelo pode usar. Escreva {{campo}} no texto.
export const CAMPOS = [
  ["cliente", "Nome do cliente"], ["documento", "CPF/CNPJ do cliente"], ["email_cliente", "E-mail do cliente"], ["telefone_cliente", "Telefone do cliente"],
  ["endereco_cliente", "Endereço do cliente"],
  ["responsavel", "Nome do responsável"], ["email_responsavel", "E-mail do responsável"], ["telefone_responsavel", "Telefone do responsável"], ["emissor", "Seu nome / empresa"],
  ["producao", "Nome da produção"], ["data", "Data da produção"], ["horario", "Horário"], ["local", "Local"], ["demanda", "Demanda do dia"], ["equipe", "Equipe"], ["qtd_shots", "Qtd. de shots"],
  ["total", "Valor total"], ["total_extenso", "Valor por extenso"], ["parcelas", "Parcelas (lista)"], ["qtd_parcelas", "Qtd. de parcelas"],
  ["hoje", "Data de hoje"],
];

const UN = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CT = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
function ate999(n) {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100, parts = [];
  if (c) parts.push(CT[c]);
  if (r) parts.push(r < 20 ? UN[r] : DZ[Math.floor(r / 10)] + (r % 10 ? " e " + UN[r % 10] : ""));
  return parts.join(" e ");
}
function inteiroExtenso(n) {
  if (n === 0) return "zero";
  const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), r = n % 1000, out = [];
  if (mi) out.push(mi === 1 ? "um milhão" : ate999(mi) + " milhões");
  if (mil) out.push(mil === 1 ? "mil" : ate999(mil) + " mil");
  if (r) out.push(ate999(r));
  return out.join(r && (mi || mil) && (r < 100 || r % 100 === 0) ? " e " : " ");
}
export function reaisExtenso(v) {
  const n = Math.round((Number(v) || 0) * 100), reais = Math.floor(n / 100), cent = n % 100;
  const a = reais ? `${inteiroExtenso(reais)} ${reais === 1 ? "real" : "reais"}` : "";
  const b = cent ? `${inteiroExtenso(cent)} ${cent === 1 ? "centavo" : "centavos"}` : "";
  return [a, b].filter(Boolean).join(" e ") || "zero reais";
}

const dataBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : "");

export function buildContext({ client, production, plan, issuer, finance }) {
  const c = client || {}, p = production || {};
  const end = [c.logradouro && `${c.logradouro}${c.numero ? ", " + c.numero : ""}${c.complemento ? " " + c.complemento : ""}`, c.bairro, [c.cidade, c.estado].filter(Boolean).join("/"), c.cep && `CEP ${c.cep}`].filter(Boolean).join(", ");
  // valor total: orçamento da produção > plano de pagamento > valor da proposta no cadastro do cliente
  const planTotal = plan ? Number(plan.valor_total) || (plan.parcelas || []).reduce((a, x) => a + (Number(x.valor) || 0), 0) : 0;
  const total = Number(finance?.orcamento) || planTotal || Number(c.valor_proposta) || 0;
  const parcelas = (plan?.parcelas || []).map((x) => `${x.numero}ª parcela: ${formatBRL(Number(x.valor) || 0)}${x.vencimento ? ` com vencimento em ${dataBR(x.vencimento)}` : ""}`).join("\n");
  return {
    cliente: c.name || "", documento: c.cnpj || "", email_cliente: c.email || "", telefone_cliente: c.phone || "", endereco_cliente: end,
    responsavel: c.responsavel || p.responsavel || "", email_responsavel: c.email || "", telefone_responsavel: c.phone || "", emissor: issuer || "",
    producao: p.cliente || plan?.titulo || "", data: formatIntervaloDatas(p.data, p.dataFim) || "", horario: p.horaInicio || p.horaFim ? `${p.horaInicio || "?"} às ${p.horaFim || "?"}` : "",
    local: p.endereco || "", demanda: p.objetivoDia || "",
    equipe: (p.equipe || []).map((m) => [m.funcao, m.responsavel].filter(Boolean).join(": ")).filter(Boolean).join("; "),
    qtd_shots: p.shots ? String(p.shots.length) : "",
    total: total ? formatBRL(total) : "", total_extenso: total ? reaisExtenso(total) : "", parcelas, qtd_parcelas: plan?.parcelas?.length ? String(plan.parcelas.length) : "",
    hoje: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
  };
}

// Troca {{campo}} pelos dados; o que estiver vazio vira uma linha para preencher à mão. Devolve também os campos faltantes.
export function mergeTemplate(texto, ctx) {
  const faltando = new Set(), desconhecidos = new Set();
  const out = String(texto || "").replace(/\{\{\s*([\w]+)\s*\}\}/g, (m, k) => {
    if (!(k in ctx)) { desconhecidos.add(k); return m; }
    if (!ctx[k]) { faltando.add(k); return "__________"; }
    return ctx[k];
  });
  return { texto: out, faltando: [...faltando], desconhecidos: [...desconhecidos] };
}

export async function extractText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type === "text/plain") return await file.text();
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value || "";
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      let line = "", lastY = null;
      const lines = [];
      for (const it of content.items) {
        const y = it.transform?.[5];
        if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ""; }
        line += it.str + (it.hasEOL ? "\n" : "");
        lastY = y;
      }
      lines.push(line);
      pages.push(lines.join("\n"));
    }
    return pages.join("\n\n");
  }
  throw new Error("Use um arquivo PDF, DOCX ou TXT.");
}

const btn = { minHeight: 40, padding: "0 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const inputSt = { background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", color: C.paper, fontFamily: FONT_BODY, fontSize: 13.5, outline: "none", minWidth: 0, width: "100%", boxSizing: "border-box" };

export function useContractTemplates(workspaceId) {
  const [list, setList] = useState([]);
  const load = useCallback(async () => {
    if (!workspaceId) return;
    const { data } = await supabase.from("contract_templates").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
    setList(data || []);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]);
  return [list, load];
}

// Gerência dos modelos (Configurações > Assinaturas).
export function TemplatesManager({ workspaceId }) {
  const [list, reload] = useContractTemplates(workspaceId);
  const [edit, setEdit] = useState(null); // {id?, nome, texto}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef(null);
  const area = useRef(null);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(""); setBusy(true);
    try {
      const texto = (await extractText(file)).trim();
      if (texto.length < 20) throw new Error("Não consegui ler texto desse arquivo (se for PDF escaneado, copie o texto ou use DOCX).");
      setEdit({ nome: file.name.replace(/\.(pdf|docx|txt)$/i, ""), texto });
    } catch (e2) { setErr(e2.message || "Não consegui ler o arquivo."); }
    setBusy(false);
  }
  function insert(k) {
    const el = area.current;
    const tag = `{{${k}}}`;
    if (!el) return setEdit({ ...edit, texto: edit.texto + tag });
    const a = el.selectionStart ?? edit.texto.length, b = el.selectionEnd ?? a;
    const texto = edit.texto.slice(0, a) + tag + edit.texto.slice(b);
    setEdit({ ...edit, texto });
    setTimeout(() => { el.focus(); el.setSelectionRange(a + tag.length, a + tag.length); }, 0);
  }
  async function save() {
    if (!edit.nome.trim() || !edit.texto.trim()) { setErr("Dê um nome e um texto ao modelo."); return; }
    setBusy(true); setErr("");
    const row = { id: edit.id || uid(), workspace_id: workspaceId, nome: edit.nome.trim(), texto: edit.texto, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("contract_templates").upsert(row);
    setBusy(false);
    if (error) { setErr("Não consegui salvar."); return; }
    setEdit(null); reload();
  }
  async function remove(t) {
    if (!window.confirm(`Apagar o modelo "${t.nome}"?`)) return;
    await supabase.from("contract_templates").delete().eq("id", t.id);
    reload();
  }

  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.lineSoft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <FileText size={15} color={C.amber} />
        <span style={{ fontSize: 14, fontWeight: 600, color: C.paper, flex: 1 }}>Modelos de contrato</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
        Importe o seu contrato (PDF, DOCX ou TXT) e marque onde entram os dados do cliente e da produção, como <span style={{ fontFamily: FONT_MONO }}>{"{{cliente}}"}</span> e <span style={{ fontFamily: FONT_MONO }}>{"{{data}}"}</span>. Na ficha do cliente, o app preenche tudo e envia para assinatura.
      </div>
      {!edit && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button disabled={busy} onClick={() => input.current?.click()} style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 6, background: C.amberDim, borderColor: C.amber, color: C.amber }}>
              {busy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <FileUp size={14} />} Importar arquivo
            </button>
            <button onClick={() => setEdit({ nome: "", texto: "" })} style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Colar texto</button>
            <input ref={input} type="file" accept=".pdf,.docx,.txt,application/pdf" onChange={pick} style={{ display: "none" }} />
          </div>
          {list.length === 0 && <div style={{ fontSize: 12.5, color: C.faint }}>Nenhum modelo ainda.</div>}
          {list.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nome}</span>
              <button onClick={() => setEdit({ id: t.id, nome: t.nome, texto: t.texto })} style={{ ...btn, minHeight: 34 }}>Editar</button>
              <button onClick={() => remove(t)} style={{ ...btn, minHeight: 34, padding: "0 10px", color: C.brick }}><Trash2 size={14} /></button>
            </div>
          ))}
        </>
      )}
      {edit && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Nome do modelo (ex: Casamento, Gastronomia)" style={inputSt} />
          <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO }}>TOQUE PARA INSERIR UM CAMPO NO CURSOR</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CAMPOS.map(([k, l]) => (
              <button key={k} title={l} onClick={() => insert(k)} style={{ border: `1px solid ${C.line}`, background: "transparent", color: C.muted, borderRadius: 14, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: FONT_BODY }}>{l}</button>
            ))}
          </div>
          <textarea ref={area} value={edit.texto} onChange={(e) => setEdit({ ...edit, texto: e.target.value })} rows={14} placeholder="Texto do contrato. Use {{cliente}}, {{data}}, {{total}}..." style={{ ...inputSt, fontFamily: FONT_BODY, lineHeight: 1.5, resize: "vertical" }} />
          <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.45 }}>Dica: troque no texto os nomes, datas e valores do contrato antigo pelos campos acima. Revise o texto importado: tabelas e formatação do arquivo original não são mantidas.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={busy} onClick={save} style={{ ...btn, flex: 1, background: C.amberDim, borderColor: C.amber, color: C.amber }}>{busy ? "Salvando…" : "Salvar modelo"}</button>
            <button onClick={() => { setEdit(null); setErr(""); }} style={btn}>Cancelar</button>
          </div>
        </div>
      )}
      {err && <div style={{ display: "flex", gap: 8, color: C.brick, fontSize: 12.5, marginTop: 8 }}><AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{err}</div>}
    </div>
  );
}

// Gera o contrato do cliente a partir de um modelo, confere/edita o texto e envia para assinatura.
export function GenerateContractDialog({ workspaceId, client: clientFixed, clientOptions, productions, financeMap, plans: plansIn, issuerName, onClose, onSent }) {
  const [cid, setCid] = useState(clientFixed?.id || "");
  const client = clientFixed || (clientOptions || []).find((c) => c.id === cid) || null;
  const plans = (plansIn || []).filter((p) => !clientOptions || !client || p.client_id === client.id);
  const [templates] = useContractTemplates(workspaceId);
  const [zs] = useZapsignStatus(workspaceId);
  const [tid, setTid] = useState("");
  const [pid, setPid] = useState(productions?.[0]?.id || "");
  const [planId, setPlanId] = useState(plans?.[0]?.id || "");
  // o plano ligado à produção escolhida entra por padrão
  useEffect(() => {
    const linked = plans.find((p) => pid && p.production_id === pid);
    setPlanId(linked?.id || (plans.some((p) => p.id === planId) ? planId : plans[0]?.id || ""));
  }, [client?.id, pid, plansIn?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [texto, setTexto] = useState("");
  const [info, setInfo] = useState({ faltando: [], desconhecidos: [] });
  const [sending, setSending] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!tid && templates.length) setTid(templates[0].id); }, [templates, tid]);
  useEffect(() => {
    const t = templates.find((x) => x.id === tid);
    if (!t) return;
    const ctx = buildContext({ client, production: (productions || []).find((x) => x.id === pid), plan: (plans || []).find((x) => x.id === planId), issuer: issuerName, finance: financeMap?.[pid] });
    const m = mergeTemplate(t.texto, ctx);
    setTexto(m.texto); setInfo({ faltando: m.faltando, desconhecidos: m.desconhecidos });
  }, [tid, pid, planId, templates, client, productions, plans, issuerName, financeMap]);

  const tpl = templates.find((x) => x.id === tid);
  const prod = (productions || []).find((x) => x.id === pid);
  const titulo = `Contrato - ${client?.name || ""}${prod?.cliente && prod.cliente !== client?.name ? " - " + prod.cliente : ""}`;
  const semCliente = !client;
  const nome = (id) => CAMPOS.find(([k]) => k === id)?.[1] || id;

  const taRef = useRef(null);
  function wrapSel(before, after = "") {
    const el = taRef.current; if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd;
    const sel = texto.slice(a, b);
    setTexto(texto.slice(0, a) + before + sel + after + texto.slice(b));
    setTimeout(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + sel.length); }, 0);
  }
  function lineStart(prefix) {
    const el = taRef.current; if (!el) return;
    const a = el.selectionStart;
    const ls = texto.lastIndexOf("\n", a - 1) + 1;
    setTexto(texto.slice(0, ls) + prefix + texto.slice(ls));
    setTimeout(() => el.focus(), 0);
  }
  async function preview() {
    setBusy(true);
    try {
      const { buildContractPdf } = await import("./contractPdf");
      const doc = await buildContractPdf({ titulo, texto, rodape: titulo });
      window.open(URL.createObjectURL(doc.output("blob")), "_blank");
    } finally { setBusy(false); }
  }
  async function toPdf(download) {
    setBusy(true);
    try {
      const b64 = await textToPdfBase64(titulo, texto);
      if (download) {
        const a = document.createElement("a");
        a.href = "data:application/pdf;base64," + b64; a.download = titulo + ".pdf"; a.click();
      } else setSending(b64);
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 65, display: "grid", placeItems: "center", padding: 20, fontFamily: FONT_BODY }}>
      <div className="modal-card" style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", display: "flex", flexDirection: "column", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 18px" }}>
          <FileText size={17} color={C.amber} />
          <div style={{ flex: 1, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: C.paper }}>CONTRATO A PARTIR DE MODELO</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "0 18px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {templates.length === 0 ? (
            <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>Você ainda não tem modelos. Importe um em Configurações &gt; Assinaturas &gt; Modelos de contrato.</div>
          ) : (
            <>
              <label style={{ fontSize: 12, color: C.faint }}>Modelo
                <select value={tid} onChange={(e) => setTid(e.target.value)} style={{ ...inputSt, marginTop: 4, colorScheme: "dark" }}>{templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
              </label>
              {!clientFixed && (
                <label style={{ fontSize: 12, color: C.faint }}>Cliente (quem assina o contrato)
                  <select value={cid} onChange={(e) => setCid(e.target.value)} style={{ ...inputSt, marginTop: 4, colorScheme: "dark" }}>
                    <option value="">Escolha o cliente…</option>
                    {(clientOptions || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              {(productions || []).length > 0 && (
                <label style={{ fontSize: 12, color: C.faint }}>Produção (data, local, equipe)
                  <select value={pid} onChange={(e) => setPid(e.target.value)} style={{ ...inputSt, marginTop: 4, colorScheme: "dark" }}>
                    <option value="">Nenhuma</option>
                    {productions.map((p) => <option key={p.id} value={p.id}>{p.cliente || "Produção"}{p.data ? ` · ${dataBR(p.data)}` : ""}</option>)}
                  </select>
                </label>
              )}
              {(plans || []).length > 0 && (
                <label style={{ fontSize: 12, color: C.faint }}>Plano de pagamento (valor e parcelas)
                  <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={{ ...inputSt, marginTop: 4, colorScheme: "dark" }}>
                    <option value="">Nenhum</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.titulo || "Plano"}{p.production_id && p.production_id === pid ? " (desta produção)" : ""}</option>)}
                  </select>
                </label>
              )}
              {semCliente && <div style={{ fontSize: 12.5, color: C.brick }}>Escolha o cliente para preencher os dados dele no contrato.</div>}
              {(info.faltando.length > 0 || info.desconhecidos.length > 0) && (
                <div style={{ background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: C.paper, lineHeight: 1.5 }}>
                  {info.faltando.length > 0 && <div><b style={{ color: C.amber }}>Sem dados:</b> {info.faltando.map(nome).join(", ")}. Aparecem como ________ no texto; preencha abaixo ou complete o cadastro.</div>}
                  {info.desconhecidos.length > 0 && <div><b style={{ color: C.amber }}>Campo desconhecido no modelo:</b> {info.desconhecidos.map((k) => `{{${k}}}`).join(", ")}</div>}
                </div>
              )}
              <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO }}>CONFIRA E EDITE O TEXTO ANTES DE ENVIAR</div>
              <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.45 }}>O PDF é formatado sozinho: título, cláusulas numeradas em negrito, texto justificado e rodapé com páginas. Use os botões abaixo para ajustar (# título, ## cláusula, **negrito**, - lista).</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[["Título", () => lineStart("# ")], ["Cláusula", () => lineStart("## ")], ["Negrito", () => wrapSel("**", "**")], ["Lista", () => lineStart("- ")], ["Linha", () => lineStart("---\n")]].map(([l, fn]) => (
                  <button key={l} onClick={fn} style={{ border: `1px solid ${C.line}`, background: "transparent", color: C.muted, borderRadius: 14, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: FONT_BODY, fontWeight: l === "Negrito" ? 700 : 500 }}>{l}</button>
                ))}
                <button disabled={busy} onClick={preview} style={{ marginLeft: "auto", border: `1px solid ${C.amber}`, background: "transparent", color: C.amber, borderRadius: 14, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 600 }}>Pré-visualizar PDF</button>
              </div>
              <textarea ref={taRef} value={texto} onChange={(e) => setTexto(e.target.value)} rows={16} style={{ ...inputSt, fontFamily: FONT_BODY, lineHeight: 1.5, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {zs?.connected && <button disabled={busy || !tpl || semCliente} onClick={() => toPdf(false)} style={{ ...btn, flex: 1, minHeight: 44, background: C.amberDim, borderColor: C.amber, color: C.amber, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><PenLine size={14} /> {busy ? "Gerando…" : "Enviar para assinatura"}</button>}
                <button disabled={busy || !tpl || semCliente} onClick={() => toPdf(true)} style={{ ...btn, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6 }}><Download size={14} /> Baixar PDF</button>
              </div>
              {zs && !zs.connected && <div style={{ fontSize: 12, color: C.faint }}>Conecte o ZapSign em Configurações &gt; Assinaturas para enviar direto.</div>}
            </>
          )}
        </div>
      </div>
      {sending && client && <SendContractDialog workspaceId={workspaceId} client={client} productionId={pid || null} titulo={titulo} pdfBase64={sending} issuerName={issuerName} onClose={() => setSending(null)} onSent={() => { onSent?.(); onClose(); }} />}
    </div>
  );
}

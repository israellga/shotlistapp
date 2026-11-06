import React, { useEffect, useState } from "react";
import { Plus, Trash2, Copy, Check, MessageCircle, FileSignature, ChevronDown, ExternalLink } from "lucide-react";
import { supabase } from "./supabaseClient";
import { C, FONT_MONO, FONT_BODY } from "./theme";
import { Field, DateField, IconButton } from "./ui";
import { formatBRL } from "./finance";
import { SendProposalContract } from "./zapsign";

const uid = () => Math.random().toString(36).slice(2, 9);

export const CONTRATO_PADRAO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS E AUDIOVISUAIS

CONTRATADO(A): {{emissor}}
CONTRATANTE: {{cliente}}

1. OBJETO. O(A) CONTRATADO(A) prestará ao(à) CONTRATANTE os serviços descritos nesta proposta ("{{titulo}}"), no valor total de {{total}}.

2. DATA E LOCAL. A prestação do serviço ocorrerá na data e no local combinados entre as partes. Alterações de data devem ser comunicadas com antecedência mínima de 7 dias e dependem da disponibilidade do(a) CONTRATADO(A).

3. PAGAMENTO. O pagamento seguirá as condições descritas nesta proposta. A reserva da data é confirmada com o aceite e o pagamento da primeira parcela. Atrasos podem gerar multa de 2% e juros de 1% ao mês.

4. PRAZO DE ENTREGA. O material será entregue no prazo informado nesta proposta, por link digital, contado a partir da data da captação e da quitação das parcelas devidas.

5. DIREITOS AUTORAIS E USO DE IMAGEM. Os direitos autorais sobre as obras pertencem ao(à) CONTRATADO(A). O(À) CONTRATANTE recebe licença de uso do material para os fins descritos nesta proposta. O(A) CONTRATADO(A) poderá usar o material em portfólio e divulgação profissional, salvo pedido expresso em contrário.

6. CANCELAMENTO. Em caso de cancelamento pelo(a) CONTRATANTE, o valor já pago a título de reserva não é reembolsável. Cancelamentos com menos de 7 dias de antecedência podem ser cobrados proporcionalmente.

7. FORÇA MAIOR. Nenhuma das partes responde por atrasos ou impossibilidade de execução causados por caso fortuito ou força maior, devendo as partes reagendar de comum acordo.

8. FORO. As partes elegem o foro da comarca do(a) CONTRATADO(A) para dirimir quaisquer dúvidas deste contrato.

O aceite eletrônico desta proposta, com nome e documento do(a) CONTRATANTE, tem valor de assinatura e confirma a concordância com todas as condições acima.`;

export const TERMO_IMAGEM = `TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM

AUTORIZANTE: {{cliente}}
AUTORIZADO(A): {{emissor}}

1. O(A) AUTORIZANTE autoriza, de forma gratuita, o uso de sua imagem, voz, nome e/ou marca, captados nas fotografias e vídeos produzidos em "{{titulo}}".

2. A autorização abrange o uso em portfólio, site, redes sociais, materiais impressos e digitais de divulgação profissional do(a) AUTORIZADO(A), sem limite de tempo e em território nacional e internacional.

3. As imagens não serão usadas de forma que desabone o(a) AUTORIZANTE. Não há cessão de direitos autorais, que permanecem com o(a) AUTORIZADO(A), salvo o que constar no contrato de prestação de serviços.

4. A autorização pode ser revogada por escrito, com efeito para novas publicações, sem obrigação de retirar materiais já distribuídos.

O aceite eletrônico, com nome e documento, tem valor de assinatura.`;

export function emptyProposal(workspaceId, client, issuer) {
  return {
    id: uid() + uid(),
    workspace_id: workspaceId,
    client_id: client.id,
    titulo: "",
    status: "rascunho",
    payload: {
      itens: [{ id: uid(), desc: "", valor: "" }],
      escopo: "", condicoes: "Pagamento em 2 parcelas: 50% na reserva da data e 50% na entrega.", prazoEntrega: "15 dias após a captação",
      validade: "", contrato: CONTRATO_PADRAO, cliente_nome: client.name || "", emissor: issuer || "",
    },
  };
}

export const totalProposta = (p) => (p?.itens || []).reduce((a, i) => a + (Number(i.valor) || 0), 0);

export function fillContrato(text, { cliente, emissor, titulo, total }) {
  return (text || "").replace(/\{\{cliente\}\}/g, cliente || "").replace(/\{\{emissor\}\}/g, emissor || "")
    .replace(/\{\{titulo\}\}/g, titulo || "").replace(/\{\{total\}\}/g, total || "");
}

const STATUS = {
  rascunho: { label: "Rascunho", color: C.muted },
  enviada: { label: "Enviada", color: C.amber },
  aceita: { label: "Aceita", color: C.sage },
  recusada: { label: "Recusada", color: C.brick },
};

function waDigits(phone) {
  const d = (phone || "").replace(/\D/g, "");
  return d.length >= 10 ? (d.length <= 11 ? "55" + d : d) : "";
}

export function ProposalsSection({ client, workspaceId, issuer, onConvert }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState("");
  const [saving, setSaving] = useState("");

  async function load() {
    const { data } = await supabase.from("proposals").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
    if (Array.isArray(data)) setList(data);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel(`proposals:${client.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposals", filter: `client_id=eq.${client.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [client.id]);

  const patchLocal = (id, fields) => setList((prev) => prev.map((x) => (x.id === id ? { ...x, ...fields } : x)));
  const patchPayload = (pr, fields) => patchLocal(pr.id, { payload: { ...pr.payload, ...fields } });

  async function create() {
    const p = emptyProposal(workspaceId, client, issuer);
    const { error } = await supabase.from("proposals").insert({ id: p.id, workspace_id: workspaceId, client_id: client.id, titulo: p.titulo, payload: p.payload, status: p.status });
    if (!error) { setList((prev) => [{ ...p, created_at: new Date().toISOString() }, ...prev]); setOpen(p.id); }
  }
  async function save(pr, extra = {}) {
    setSaving(pr.id);
    const fields = { titulo: pr.titulo, payload: pr.payload, updated_at: new Date().toISOString(), ...extra };
    const { error } = await supabase.from("proposals").update(fields).eq("id", pr.id);
    setSaving("");
    if (!error && extra.status) patchLocal(pr.id, extra);
    return !error;
  }
  async function remove(id) {
    await supabase.from("proposals").delete().eq("id", id);
    setList((prev) => prev.filter((x) => x.id !== id));
  }
  const linkOf = (pr) => `${window.location.origin}/?proposta=${pr.id}`;
  async function copyLink(pr) {
    if (pr.status === "rascunho") await save(pr, { status: "enviada" }); else await save(pr);
    try { await navigator.clipboard.writeText(linkOf(pr)); setCopied(pr.id); setTimeout(() => setCopied(""), 2500); } catch { /* ignore */ }
  }
  async function whatsapp(pr) {
    if (pr.status === "rascunho") await save(pr, { status: "enviada" }); else await save(pr);
    const first = (client.name || "").trim().split(" ")[0];
    const msg = `Olá${first ? ", " + first : ""}! Segue a proposta "${pr.titulo || "de serviços"}" para você conferir e aceitar online: ${linkOf(pr)}`;
    window.open(`https://wa.me/${waDigits(client.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <FileSignature size={16} color={C.faint} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.5, flex: 1 }}>PROPOSTAS E CONTRATOS ({list.length})</span>
        <button onClick={create} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 40, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 20, padding: "0 14px", color: C.amber, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_BODY }}>
          <Plus size={14} /> Nova proposta
        </button>
      </div>
      {list.length === 0 && <div style={{ color: C.faint, fontSize: 13, padding: "6px 4px" }}>Nenhuma proposta ainda. Crie uma, envie o link e o cliente aceita online.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((pr) => {
          const st = STATUS[pr.status] || STATUS.rascunho;
          const isOpen = open === pr.id;
          const total = totalProposta(pr.payload);
          const editable = pr.status === "rascunho" || pr.status === "enviada";
          return (
            <div key={pr.id} className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
              <button onClick={() => setOpen(isOpen ? null : pr.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 52, padding: "8px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: FONT_BODY, textAlign: "left" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.titulo || "Proposta sem título"}</span>
                  <span style={{ fontSize: 12, color: st.color, fontWeight: 600 }}>
                    {st.label}{pr.status === "enviada" && pr.viewed_at ? " · visualizada" : ""}{pr.status === "aceita" && pr.accepted_name ? ` por ${pr.accepted_name}` : ""}
                  </span>
                </span>
                <span style={{ fontSize: 13.5, color: C.paper, fontWeight: 600 }}>{formatBRL(total)}</span>
                <ChevronDown size={16} color={C.faint} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)" }} />
              </button>
              {isOpen && (
                <div className="fade-in-up" style={{ padding: "4px 14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {!editable && <div style={{ fontSize: 12.5, color: C.faint }}>Esta proposta já foi respondida e não pode mais ser editada.</div>}
                  <fieldset disabled={!editable} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, opacity: editable ? 1 : 0.7 }}>
                    <Field label="Título" value={pr.titulo} onChange={(v) => patchLocal(pr.id, { titulo: v })} placeholder="Ex: Cobertura de casamento 12/11" />
                    <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO }}>ITENS</div>
                    {(pr.payload.itens || []).map((it) => (
                      <div key={it.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input value={it.desc} onChange={(e) => patchPayload(pr, { itens: pr.payload.itens.map((x) => (x.id === it.id ? { ...x, desc: e.target.value } : x)) })} placeholder="Descrição" style={inp(2)} />
                        <input type="number" value={it.valor} onChange={(e) => patchPayload(pr, { itens: pr.payload.itens.map((x) => (x.id === it.id ? { ...x, valor: e.target.value } : x)) })} placeholder="R$" style={inp(1)} />
                        <IconButton onClick={() => patchPayload(pr, { itens: pr.payload.itens.filter((x) => x.id !== it.id) })} tone="brick" size={30}><Trash2 size={14} /></IconButton>
                      </div>
                    ))}
                    <button onClick={() => patchPayload(pr, { itens: [...(pr.payload.itens || []), { id: uid(), desc: "", valor: "" }] })} style={{ minHeight: 40, background: "transparent", border: `1px dashed ${C.line}`, borderRadius: 10, color: C.muted, fontFamily: FONT_BODY, fontSize: 13, cursor: "pointer" }}>
                      <Plus size={13} /> Adicionar item
                    </button>
                    <div style={{ textAlign: "right", fontSize: 15, fontWeight: 700, color: C.paper }}>Total: {formatBRL(total)}</div>
                    <Field label="Escopo (o que está incluso)" value={pr.payload.escopo || ""} onChange={(v) => patchPayload(pr, { escopo: v })} multiline autoGrow placeholder="Ex: 6 horas de cobertura, 300 fotos tratadas, vídeo de 3 min" />
                    <Field label="Condições de pagamento" value={pr.payload.condicoes || ""} onChange={(v) => patchPayload(pr, { condicoes: v })} multiline autoGrow />
                    <Field label="Prazo de entrega" value={pr.payload.prazoEntrega || ""} onChange={(v) => patchPayload(pr, { prazoEntrega: v })} />
                    <DateField label="Proposta válida até" value={pr.payload.validade || ""} onChange={(v) => patchPayload(pr, { validade: v })} />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <button onClick={() => patchPayload(pr, { contrato: CONTRATO_PADRAO })} style={{ minHeight: 40, padding: "0 12px", borderRadius: 18, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontSize: 12.5, cursor: "pointer" }}>Modelo: prestação de serviços</button>
                      <button onClick={() => patchPayload(pr, { contrato: TERMO_IMAGEM })} style={{ minHeight: 40, padding: "0 12px", borderRadius: 18, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontSize: 12.5, cursor: "pointer" }}>Modelo: termo de uso de imagem</button>
                    </div>
                    <Field label="Contrato (use {{cliente}}, {{emissor}}, {{titulo}}, {{total}})" value={pr.payload.contrato || ""} onChange={(v) => patchPayload(pr, { contrato: v })} multiline autoGrow />
                  </fieldset>
                  <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.5 }}>O contrato acima é um modelo geral. Revise com seu advogado antes de usar.</div>
                  {pr.status !== "recusada" && (
                    <SendProposalContract
                      workspaceId={workspaceId}
                      client={client}
                      titulo={pr.titulo || "Proposta"}
                      issuerName={issuer}
                      texto={(() => {
                        const pl = pr.payload || {};
                        const emissor = pl.emissor || issuer;
                        const itens = (pl.itens || []).filter((i) => i.desc || i.valor).map((i) => `- ${i.desc || "Item"}: ${formatBRL(Number(i.valor) || 0)}`).join("\n");
                        return fillContrato(pl.contrato, { cliente: pl.cliente_nome, emissor, titulo: pr.titulo, total: formatBRL(totalProposta(pl)) })
                          + `\n\nANEXO - PROPOSTA "${pr.titulo || ""}"\n\n${itens}\nTotal: ${formatBRL(totalProposta(pl))}`
                          + (pl.escopo ? `\n\nEscopo: ${pl.escopo}` : "") + (pl.condicoes ? `\n\nPagamento: ${pl.condicoes}` : "") + (pl.prazoEntrega ? `\n\nPrazo de entrega: ${pl.prazoEntrega}` : "");
                      })()}
                    />
                  )}
                  {pr.status === "recusada" && pr.decline_note && <div style={{ fontSize: 13, color: C.brick }}>Motivo informado: {pr.decline_note}</div>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {editable && <button onClick={() => save(pr)} style={actBtn}>{saving === pr.id ? "Salvando…" : "Salvar"}</button>}
                    {editable && <button onClick={() => copyLink(pr)} style={actBtn}>{copied === pr.id ? <Check size={14} /> : <Copy size={14} />} {copied === pr.id ? "Link copiado" : "Copiar link"}</button>}
                    {editable && <button onClick={() => whatsapp(pr)} style={actBtn}><MessageCircle size={14} color={C.sage} /> WhatsApp</button>}
                    {pr.status !== "rascunho" && <a href={linkOf(pr)} target="_blank" rel="noreferrer" style={{ ...actBtn, textDecoration: "none" }}><ExternalLink size={14} /> Ver como cliente</a>}
                    {pr.status === "aceita" && !pr.payload.convertida && (
                      <button onClick={async () => { await onConvert(pr); await save({ ...pr, payload: { ...pr.payload, convertida: true } }); patchPayload(pr, { convertida: true }); }} className="btn-glass-primary" style={{ ...actBtn, border: "none" }}>Converter em produção</button>
                    )}
                    {pr.status === "aceita" && pr.payload.convertida && <span style={{ fontSize: 12.5, color: C.sage, alignSelf: "center" }}>Já convertida em produção</span>}
                    <IconButton onClick={() => remove(pr.id)} tone="brick" size={36}><Trash2 size={15} /></IconButton>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inp = (flex) => ({ flex, minWidth: 0, minHeight: 40, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, padding: "0 10px", color: C.paper, fontFamily: FONT_BODY, fontSize: 14, outline: "none" });
const actBtn = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px", borderRadius: 20, border: `1px solid ${C.line}`, background: "transparent", color: C.paper, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer" };

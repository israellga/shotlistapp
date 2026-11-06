import React, { useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";
import { formatBRL, totalCustos, valorImposto } from "./finance";

const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function csvCell(v) { return `"${String(v ?? "").replace(/"/g, '""')}"`; }
function num(n) { return (Number(n) || 0).toFixed(2).replace(".", ","); }
function downloadCsv(name, rows) {
  const text = "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function YearReport({ productions, financeMap, clients, paymentPlans }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const rows = productions
    .filter((p) => (p.data || "").startsWith(String(year)))
    .map((p) => {
      const f = financeMap[p.id];
      const receita = Number(f?.orcamento) || 0;
      const custos = totalCustos(f || { custos: [] });
      const imposto = valorImposto(f);
      return { p, mes: Number(p.data.slice(5, 7)) - 1, receita, custos, imposto, lucro: receita - custos - imposto };
    });
  const receita = rows.reduce((a, r) => a + r.receita, 0);
  const custos = rows.reduce((a, r) => a + r.custos + r.imposto, 0);
  const lucro = receita - custos;
  const comValor = rows.filter((r) => r.receita > 0);
  const ticket = comValor.length ? receita / comValor.length : 0;
  const margem = receita > 0 ? Math.round((lucro / receita) * 100) : null;
  const porMes = MES.map((_, i) => rows.filter((r) => r.mes === i).reduce((a, r) => a + r.receita, 0));
  const maxMes = Math.max(1, ...porMes);
  const porCliente = {};
  for (const r of rows) {
    const k = r.p.clienteId || r.p.cliente || "—";
    porCliente[k] = (porCliente[k] || 0) + r.receita;
  }
  const ranking = Object.entries(porCliente)
    .map(([k, total]) => ({ k, total, nome: clients[k]?.name || k }))
    .filter((x) => x.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

  const parcelas = [];
  for (const plan of paymentPlans) for (const pa of plan.parcelas || []) {
    if ((pa.vencimento || "").startsWith(String(year))) parcelas.push({ plan, pa });
  }
  const recebido = parcelas.filter((x) => x.pa.pago).reduce((a, x) => a + (Number(x.pa.valor) || 0), 0);
  const aReceber = parcelas.filter((x) => !x.pa.pago).reduce((a, x) => a + (Number(x.pa.valor) || 0), 0);

  function exportProducoes() {
    downloadCsv(`producoes-${year}.csv`, [
      ["Data", "Cliente", "Orçamento", "Custos", "Imposto", "Lucro"],
      ...rows.sort((a, b) => a.p.data.localeCompare(b.p.data)).map((r) => [r.p.data.split("-").reverse().join("/"), r.p.cliente || "", num(r.receita), num(r.custos), num(r.imposto), num(r.lucro)]),
    ]);
  }
  function exportParcelas() {
    downloadCsv(`parcelas-${year}.csv`, [
      ["Vencimento", "Cliente", "Plano", "Parcela", "Valor", "Situação"],
      ...parcelas.sort((a, b) => a.pa.vencimento.localeCompare(b.pa.vencimento)).map((x) => [x.pa.vencimento.split("-").reverse().join("/"), clients[x.plan.client_id]?.name || "", x.plan.titulo || "", x.pa.numero ?? "", num(x.pa.valor), x.pa.pago ? "Pago" : "Em aberto"]),
    ]);
  }

  const chip = (label, value, tone) => (
    <div className="glass" style={{ flex: "1 1 140px", borderRadius: 14, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: tone || C.paper, marginTop: 2 }}>{value}</div>
    </div>
  );
  const btn = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px", borderRadius: 20, border: `1px solid ${C.line}`, background: "transparent", color: C.paper, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer" };

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <BarChart3 size={16} color={C.faint} />
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 700, color: C.paper, flex: 1 }}>Relatório do ano</span>
        <button onClick={() => setYear(year - 1)} style={{ ...btn, minWidth: 40, padding: 0, justifyContent: "center" }} aria-label="Ano anterior">‹</button>
        <span style={{ fontFamily: FONT_MONO, color: C.paper, minWidth: 44, textAlign: "center" }}>{year}</span>
        <button onClick={() => setYear(year + 1)} style={{ ...btn, minWidth: 40, padding: 0, justifyContent: "center" }} aria-label="Próximo ano">›</button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {chip("RECEITA", formatBRL(receita), C.sage)}
        {chip("CUSTOS E IMPOSTO", formatBRL(custos))}
        {chip(margem === null ? "LUCRO" : `LUCRO · ${margem}%`, formatBRL(lucro), lucro >= 0 ? C.sage : C.brick)}
        {chip("TICKET MÉDIO", formatBRL(ticket))}
        {chip("PRODUÇÕES", String(rows.length))}
        {chip("RECEBIDO / A RECEBER", `${formatBRL(recebido)} / ${formatBRL(aReceber)}`)}
      </div>

      <div className="glass" style={{ borderRadius: 16, padding: "14px 14px 10px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: C.faint, fontFamily: FONT_MONO, marginBottom: 10 }}>RECEITA POR MÊS</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
          {porMes.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <div title={formatBRL(v)} style={{ width: "100%", maxWidth: 28, height: `${Math.max(v ? 4 : 0, (v / maxMes) * 100)}%`, borderRadius: 6, background: v ? "linear-gradient(180deg, #FDDF4B, rgba(253,223,75,0.45))" : "transparent" }} />
              <div style={{ fontSize: 10.5, color: C.faint, marginTop: 6 }}>{MES[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {ranking.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {ranking.map((c, i) => (
            <div key={c.k} className="glass" style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 12, padding: "10px 14px" }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.faint, width: 18 }}>{i + 1}º</span>
              <span style={{ flex: 1, fontSize: 13.5, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</span>
              <span style={{ fontSize: 12.5, color: C.sage, fontFamily: FONT_MONO }}>{formatBRL(c.total)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={btn} onClick={exportProducoes}><Download size={14} /> Produções (CSV)</button>
        <button style={btn} onClick={exportParcelas}><Download size={14} /> Parcelas (CSV)</button>
      </div>
      <div style={{ fontSize: 12, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>Planilhas em formato brasileiro, prontas pra enviar ao contador.</div>
    </div>
  );
}

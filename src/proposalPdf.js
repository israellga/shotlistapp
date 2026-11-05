import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatIntervaloDatas } from "./datetime";
import { formatBRL } from "./finance";

// Commercial proposal built from the client record, the production and its budget.
export function exportProposalPDF({ production, client, finance, plan, issuer }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const mx = 50;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 60;
  const ensure = (n) => { if (y + n > H - 60) { doc.addPage(); y = 60; } };
  const h2 = (t) => { ensure(40); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20); doc.text(t, mx, y); y += 6; doc.setDrawColor(220); doc.line(mx, y, W - mx, y); y += 16; };
  const para = (t, size = 10.5, color = 60) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(color); const lines = doc.splitTextToSize(t, W - mx * 2); ensure(lines.length * 14); doc.text(lines, mx, y); y += lines.length * 14 + 4; };

  doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(15);
  doc.text("Proposta comercial", mx, y); y += 26;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(110);
  const today = new Date().toLocaleDateString("pt-BR");
  doc.text(`${issuer || ""}${issuer ? "  ·  " : ""}${today}`, mx, y); y += 30;

  h2("Cliente");
  const addr = [client?.logradouro && `${client.logradouro}${client.numero ? ", " + client.numero : ""}`, client?.complemento, client?.bairro, [client?.cidade, client?.estado].filter(Boolean).join("/"), client?.cep].filter(Boolean).join(" · ");
  para([client?.name || production.cliente || "", client?.cnpj && `CNPJ/CPF: ${client.cnpj}`, client?.responsavel && `A/C: ${client.responsavel}`, addr].filter(Boolean).join("\n"));
  y += 6;

  h2("Projeto");
  para([production.objetivoDia && `Demanda: ${production.objetivoDia}`, production.data && `Data prevista: ${formatIntervaloDatas(production.data, production.dataFim)}`].filter(Boolean).join("\n") || production.cliente || "");

  const shots = production.shots || [];
  if (shots.length) {
    y += 4;
    h2("Escopo");
    autoTable(doc, {
      startY: y, margin: { left: mx, right: mx },
      head: [["#", "Entrega", "Tipo"]],
      body: shots.map((s) => [String(s.numero).padStart(2, "0"), s.nome || "Sem nome", s.tipo || ""]),
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6, textColor: 40 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      alternateRowStyles: { fillColor: [247, 247, 247] },
    });
    y = doc.lastAutoTable.finalY + 22;
  }

  const total = Number(finance?.orcamento) || 0;
  h2("Investimento");
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(15);
  ensure(30); doc.text(total ? formatBRL(total) : "A definir", mx, y); y += 26;

  const parcelas = plan?.parcelas || [];
  if (parcelas.length) {
    autoTable(doc, {
      startY: y, margin: { left: mx, right: mx },
      head: [["Parcela", "Vencimento", "Valor"]],
      body: parcelas.map((p) => [String(p.numero), p.vencimento ? p.vencimento.split("-").reverse().join("/") : "a combinar", formatBRL(Number(p.valor) || 0)]),
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6, textColor: 40 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      alternateRowStyles: { fillColor: [247, 247, 247] },
    });
    y = doc.lastAutoTable.finalY + 22;
  } else {
    para("Condições de pagamento a combinar.");
  }

  h2("Condições");
  para("Proposta válida por 15 dias a partir da data de emissão. A reserva da data é confirmada com o aceite desta proposta.");
  y += 30;
  ensure(60);
  doc.setDrawColor(120); doc.line(mx, y, mx + 220, y); doc.line(W - mx - 220, y, W - mx, y);
  doc.setFontSize(9.5); doc.setTextColor(110);
  doc.text(issuer || "Responsável", mx, y + 14);
  doc.text(client?.name || "Cliente", W - mx - 220, y + 14);

  doc.save(`proposta-${(client?.name || production.cliente || "cliente").replace(/[^\w\-]+/g, "_")}.pdf`);
}

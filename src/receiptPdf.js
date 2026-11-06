import jsPDF from "jspdf";
import { formatBRL } from "./finance";

const EXT = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];

// Recibo simples de pagamento de uma parcela.
export function exportReceiptPDF({ issuer, clientName, clientDoc, plan, parcela }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const mx = 60;
  let y = 80;
  doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(15);
  doc.text("RECIBO", mx, y);
  doc.setFontSize(14); doc.text(formatBRL(parcela.valor), W - mx, y, { align: "right" });
  y += 14; doc.setDrawColor(210); doc.line(mx, y, W - mx, y); y += 34;
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(40);
  const quando = parcela.pagoEm ? new Date(parcela.pagoEm) : new Date();
  const data = quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const ref = `${plan?.titulo ? plan.titulo + " — " : ""}parcela ${parcela.numero || ""}`.trim();
  const texto = `Recebi de ${clientName || "(cliente)"}${clientDoc ? ", CPF/CNPJ " + clientDoc : ""}, a quantia de ${formatBRL(parcela.valor)}, referente a ${ref}, dando plena quitação deste valor.`;
  const lines = doc.splitTextToSize(texto, W - mx * 2);
  doc.text(lines, mx, y, { lineHeightFactor: 1.6 }); y += lines.length * 22 + 30;
  doc.text(data, mx, y); y += 90;
  doc.setDrawColor(120); doc.line(mx, y, mx + 240, y); y += 16;
  doc.setFont("helvetica", "bold"); doc.text(issuer || "", mx, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(130);
  doc.text("Recibo gerado pelo Shotlist.", mx, doc.internal.pageSize.getHeight() - 40);
  doc.save(`recibo-${(clientName || "cliente").replace(/[^\w]+/g, "-").toLowerCase()}-${parcela.numero || ""}.pdf`);
}

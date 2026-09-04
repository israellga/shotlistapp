import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatIntervaloDatas } from "./datetime";

const STATUS_LABEL = { afazer: "A fazer", andamento: "Em andamento", concluido: "Concluído" };

export function exportProductionPDF(production) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 50;

  function ensureSpace(needed) {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
  }

  function heading(text) {
    ensureSpace(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(20);
    doc.text(text, marginX, y);
    y += 16;
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(15);
  doc.text(production.cliente || "Produção sem nome", marginX, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  const metaLine = [
    formatIntervaloDatas(production.data, production.dataFim) || "sem data",
    (production.horaInicio || production.horaFim) && `Horário: ${production.horaInicio || "?"}–${production.horaFim || "?"}`,
    production.responsavel && `Responsável: ${production.responsavel}`,
    production.objetivoDia && `Demanda: ${production.objetivoDia}`,
  ].filter(Boolean).join("   ·   ");
  const metaWrapped = doc.splitTextToSize(metaLine, pageWidth - marginX * 2);
  doc.text(metaWrapped, marginX, y);
  y += metaWrapped.length * 13 + 16;
  doc.setTextColor(0);

  // Equipe
  if (production.equipe?.length) {
    heading("Equipe");
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [["Função", "Responsável"]],
      body: production.equipe.map((m) => [m.funcao || "", m.responsavel || ""]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [30, 30, 30] },
    });
    y = doc.lastAutoTable.finalY + 22;
  }

  // Ordem do dia
  if (production.cronograma?.length) {
    heading("Ordem do dia");
    const sorted = [...production.cronograma].sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [["Horário", "Nome", "Local", "Elenco", "Observação"]],
      body: sorted.map((c) => {
        const linkedShot = c.shotId ? (production.shots || []).find((s) => s.id === c.shotId) : null;
        return [c.horario || "", (linkedShot ? linkedShot.nome : c.nome) || "", c.local || "", c.elenco || "", c.observacao || ""];
      }),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [30, 30, 30] },
    });
    y = doc.lastAutoTable.finalY + 24;
  }

  // Shots
  if (production.shots?.length) {
    heading(`Shotlist (${production.shots.length})`);

    for (const shot of production.shots) {
      ensureSpace(46);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15);
      const title = `${String(shot.numero).padStart(2, "0")} — ${shot.nome || "Sem nome"}${shot.tipo ? ` (${shot.tipo})` : ""}`;
      doc.text(title, marginX, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`[${STATUS_LABEL[shot.status] || shot.status}]`, pageWidth - marginX, y, { align: "right" });
      y += 15;

      doc.setFontSize(9);
      doc.setTextColor(70);
      const equipList = [...(shot.equipamentos || []), shot.equipamentoOutro].filter(Boolean).join(", ");
      const details = [
        shot.contexto && `Contexto: ${shot.contexto}`,
        (shot.plano || shot.lente) && `Plano/Lente: ${[shot.plano, shot.lente].filter(Boolean).join(" · ")}`,
        equipList && `Equipamento: ${equipList}`,
        shot.objetivo && `Roteiro: ${shot.objetivo}`,
        shot.referencia && `Referência: ${shot.referencia}`,
      ].filter(Boolean);
      for (const line of details) {
        const wrapped = doc.splitTextToSize(line, pageWidth - marginX * 2);
        ensureSpace(wrapped.length * 11 + 4);
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 11 + 4;
      }
      doc.setTextColor(0);
      y += 4;

      if (shot.takes?.length) {
        ensureSpace(24);
        autoTable(doc, {
          startY: y,
          margin: { left: marginX, right: marginX },
          head: [["#", "Ação", "Transição / Efeito", "Tempo"]],
          body: shot.takes.map((t) => [String(t.numero).padStart(2, "0"), t.acao || "", t.transicao || "", t.tempo || ""]),
          styles: { fontSize: 8.5, cellPadding: 4 },
          headStyles: { fillColor: [60, 60, 60] },
          columnStyles: { 0: { cellWidth: 22 }, 3: { cellWidth: 55 } },
        });
        y = doc.lastAutoTable.finalY + 20;
      } else {
        y += 14;
      }
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150);
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Shotlist.app · página ${i} de ${pageCount}`, marginX, pageHeight - 22);
  }

  const safeName = (production.cliente || "producao").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\-]+/g, "_");
  doc.save(`${safeName}_shotlist.pdf`);
}

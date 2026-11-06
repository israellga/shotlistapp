// Formatador de contratos: transforma o texto em um PDF com cara de documento (título, cláusulas em negrito,
// texto justificado, listas e numeração de páginas). Marcações opcionais no texto:
//   # Título   ## Cláusula   **negrito**   --- (linha)   - item de lista
const CAPS = "A-ZÀ-ÖØ-Ý";
const reAllCaps = new RegExp(`^[^a-zà-öø-ÿ]*[${CAPS}][^a-zà-öø-ÿ]*$`);
const reClause = new RegExp(`^(\\d+(?:\\.\\d+)*[.)]?\\s+[${CAPS}][${CAPS}0-9 ,;/()ª'’-]{2,}?\\.)\\s`);
const reLabel = new RegExp(`^([${CAPS}][${CAPS}0-9 ()/ª-]{2,}:)`);
const reItem = /^(?:[-•*]\s+|\d+\s?ª\s+parcela)/i;

// Junta linhas que o PDF original quebrou no meio da frase; preserva quebras de verdade.
function toParagraphs(texto) {
  const out = [];
  let cur = "";
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  for (const raw of String(texto || "").replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/\s+$/g, "");
    if (!line.trim()) { flush(); continue; }
    const t = line.trim();
    const structural = /^(#{1,2}\s|---+$)/.test(t) || reItem.test(t) || reClause.test(t + " ") || reLabel.test(t);
    if (!cur) { cur = t; continue; }
    const prevEnds = /[.:;!?)]$/.test(cur);
    if (structural || (prevEnds && /^[A-ZÀ-Ý0-9"“(]/.test(t) && cur.length < 90) || reItem.test(cur) && !/^\s/.test(raw)) { flush(); cur = t; }
    else cur += " " + t;
  }
  flush();
  return out;
}

function inlineRuns(text) {
  const runs = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ t: text.slice(last, m.index), b: false });
    runs.push({ t: m[1], b: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ t: text.slice(last), b: false });
  return runs;
}

export async function buildContractPdf({ titulo, texto, rodape }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PW = 210, PH = 297, ML = 24, MR = 24, MT = 24, MB = 22;
  const maxW = PW - ML - MR;
  const SIZE = 11, LH = 5.7;
  let y = MT;

  const font = (bold, size = SIZE) => { doc.setFont("times", bold ? "bold" : "normal"); doc.setFontSize(size); };
  const need = (h) => { if (y + h > PH - MB) { doc.addPage(); y = MT; } };

  // Quebra uma lista de palavras (com estilo) em linhas e desenha justificado.
  function drawRuns(runs, { indent = 0, justify = true, size = SIZE, align = "left", bullet = null } = {}) {
    const words = [];
    let pendingSpace = true;
    for (const r of runs) {
      for (const tok of r.t.match(/\S+|\s+/g) || []) {
        if (/^\s/.test(tok)) { pendingSpace = true; continue; }
        font(r.b, size);
        words.push({ w: tok, b: r.b, wd: doc.getTextWidth(tok), glue: !pendingSpace && words.length > 0 });
        pendingSpace = false;
      }
    }
    font(false, size);
    const space = doc.getTextWidth(" ") * 1.3;
    const width = maxW - indent;
    const lines = [];
    let line = [], lw = 0;
    for (const wd of words) {
      const add = (line.length && !wd.glue ? space : 0) + wd.wd;
      if (line.length && lw + add > width) { lines.push(line); line = [wd]; lw = wd.wd; } else { line.push(wd); lw += add; }
    }
    if (line.length) lines.push(line);
    lines.forEach((ln, i) => {
      need(LH);
      const nGaps = ln.filter((q, k) => k > 0 && !q.glue).length;
      const natural = ln.reduce((a, x) => a + x.wd, 0) + space * nGaps;
      const isLast = i === lines.length - 1;
      let x = ML + indent;
      let gap = space;
      if (align === "center") x = ML + (maxW - natural) / 2;
      else if (justify && !isLast && nGaps > 0) gap = (width - ln.reduce((a, q) => a + q.wd, 0)) / nGaps;
      if (bullet && i === 0) { font(false, size); doc.text(bullet, ML + indent - 4.5, y); }
      ln.forEach((q, k) => { if (k > 0 && !q.glue) x += gap; font(q.b, size); doc.text(q.w, x, y); x += q.wd; });
      y += LH * (size / SIZE);
    });
  }

  const paras = toParagraphs(texto);
  let first = true;
  for (const p of paras) {
    if (/^---+$/.test(p)) { need(6); y += 1.5; doc.setDrawColor(170); doc.setLineWidth(0.2); doc.line(ML, y, PW - MR, y); y += 4.5; continue; }
    const h1 = p.match(/^#\s+(.*)$/), h2 = p.match(/^##\s+(.*)$/);
    const autoTitle = first && !h1 && !h2 && p.length < 140 && reAllCaps.test(p);
    if (h1 || autoTitle) {
      need(14); drawRuns([{ t: (h1 ? h1[1] : p), b: true }], { size: 14, align: "center", justify: false }); y += 5; first = false; continue;
    }
    first = false;
    if (h2) { need(14); y += 2; drawRuns([{ t: h2[1], b: true }], { size: 11.5, justify: false }); y += 1.2; continue; }
    if (reItem.test(p)) {
      const t = p.replace(/^[-•*]\s+/, "");
      drawRuns(inlineRuns(t), { indent: 6, justify: false, bullet: /^\d/.test(t) ? null : "•" }); y += 1.2; continue;
    }
    const cm = p.match(reClause);
    if (cm) {
      y += 1.8; need(LH * 2);
      const head = cm[1], rest = p.slice(cm[0].length);
      drawRuns([{ t: head + " ", b: true }, ...inlineRuns(rest)]); y += 2; continue;
    }
    const lm = p.match(reLabel);
    if (lm) { drawRuns([{ t: lm[1] + " ", b: true }, ...inlineRuns(p.slice(lm[1].length))], { justify: false }); y += 1.6; continue; }
    drawRuns(inlineRuns(p)); y += 2;
  }

  // rodapé com numeração
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(200); doc.setLineWidth(0.2); doc.line(ML, PH - 15, PW - MR, PH - 15);
    doc.setFont("times", "normal"); doc.setFontSize(8.5); doc.setTextColor(120);
    doc.text(rodape || titulo || "", ML, PH - 10.5, { maxWidth: maxW - 30 });
    doc.text(`Página ${i} de ${n}`, PW - MR, PH - 10.5, { align: "right" });
    doc.setTextColor(0);
  }
  doc.setProperties({ title: titulo || "Contrato" });
  return doc;
}

export async function contractPdfBase64(opts) {
  return (await buildContractPdf(opts)).output("datauristring").split(",")[1];
}

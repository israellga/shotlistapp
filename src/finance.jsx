import React from "react";
import { Plus, Trash2, DollarSign } from "lucide-react";
import { C, FONT_MONO } from "./theme";
import { IconButton, inputInlineStyle, selectInlineStyle, dashedAddStyle } from "./ui";

export const CATEGORIAS_CUSTO = [
  "Equipe", "Equipamento", "Locação", "Transporte", "Alimentação/Catering", "Pós-produção", "Outro",
];

export function formatBRL(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function totalCustos(finance) {
  return (finance?.custos || []).reduce((a, c) => a + (Number(c.valor) || 0), 0);
}

export function FinanceSection({ finance, onChange }) {
  const f = finance || { orcamento: "", custos: [] };
  const custos = f.custos || [];
  const total = totalCustos(f);
  const orcamento = Number(f.orcamento) || 0;
  const saldo = orcamento - total;

  function patch(fields) { onChange({ ...f, ...fields }); }
  function updateCusto(id, patchFields) {
    patch({ custos: custos.map((c) => (c.id === id ? { ...c, ...patchFields } : c)) });
  }
  function addCusto() {
    patch({ custos: [...custos, { id: Math.random().toString(36).slice(2, 9), categoria: CATEGORIAS_CUSTO[0], valor: "" }] });
  }
  function removeCusto(id) {
    patch({ custos: custos.filter((c) => c.id !== id) });
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3, marginBottom: 6 }}>Orçamento (R$)</div>
          <input
            type="number"
            value={f.orcamento}
            onChange={(e) => patch({ orcamento: e.target.value })}
            placeholder="0,00"
            style={{ ...inputInlineStyle(1), width: "100%" }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3, marginBottom: 6 }}>Saldo (orçamento − custos)</div>
          <div style={{
            padding: "8px 10px", borderRadius: 7, fontSize: 14, fontFamily: FONT_MONO,
            color: saldo >= 0 ? C.sage : C.brick, background: saldo >= 0 ? C.sageDim : C.brickDim,
            border: `1px solid ${saldo >= 0 ? C.sage : C.brick}`,
          }}>
            {formatBRL(saldo)}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3, marginBottom: 8 }}>
        CUSTOS ({custos.length}) · total {formatBRL(total)}
      </div>
      {custos.map((c) => (
        <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <select value={c.categoria} onChange={(e) => updateCusto(c.id, { categoria: e.target.value })} style={selectInlineStyle(1.4)}>
            {CATEGORIAS_CUSTO.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <input
            type="number"
            value={c.valor}
            onChange={(e) => updateCusto(c.id, { valor: e.target.value })}
            placeholder="0,00"
            style={inputInlineStyle(1)}
          />
          <IconButton onClick={() => removeCusto(c.id)} tone="brick" size={30}><Trash2 size={14} /></IconButton>
        </div>
      ))}
      <button onClick={addCusto} style={dashedAddStyle}><Plus size={14} /> Adicionar custo</button>
    </div>
  );
}

export function ClientBalanceSummary({ productions, financeMap }) {
  const rows = productions.map((p) => {
    const f = financeMap[p.id];
    const orc = Number(f?.orcamento) || 0;
    const custo = totalCustos(f);
    return { id: p.id, nome: p.cliente || "Sem nome", data: p.data, orcamento: orc, custo, saldo: orc - custo };
  }).filter((r) => r.orcamento > 0 || r.custo > 0);

  const totalOrc = rows.reduce((a, r) => a + r.orcamento, 0);
  const totalCusto = rows.reduce((a, r) => a + r.custo, 0);

  if (rows.length === 0) {
    return <div style={{ color: C.faint, fontSize: 13, padding: "10px 0" }}>Nenhum registro financeiro ainda pra este cliente.</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: C.faint, fontFamily: FONT_MONO }}>ORÇADO</div>
          <div style={{ fontSize: 16, color: C.paper, fontWeight: 700 }}>{formatBRL(totalOrc)}</div>
        </div>
        <div style={{ flex: 1, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: C.faint, fontFamily: FONT_MONO }}>CUSTO</div>
          <div style={{ fontSize: 16, color: C.paper, fontWeight: 700 }}>{formatBRL(totalCusto)}</div>
        </div>
        <div style={{ flex: 1, background: totalOrc - totalCusto >= 0 ? C.sageDim : C.brickDim, border: `1px solid ${totalOrc - totalCusto >= 0 ? C.sage : C.brick}`, borderRadius: 9, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: C.faint, fontFamily: FONT_MONO }}>SALDO</div>
          <div style={{ fontSize: 16, color: totalOrc - totalCusto >= 0 ? C.sage : C.brick, fontWeight: 700 }}>{formatBRL(totalOrc - totalCusto)}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, padding: "8px 10px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8 }}>
            <span style={{ flex: 1, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome}</span>
            <span style={{ color: C.faint, fontFamily: FONT_MONO }}>{r.data || "sem data"}</span>
            <span style={{ color: C.muted, fontFamily: FONT_MONO }}>{formatBRL(r.orcamento)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

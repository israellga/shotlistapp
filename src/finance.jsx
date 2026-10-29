import React from "react";
import { Plus, Trash2, DollarSign, Users, Link2Off } from "lucide-react";
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

export function valorImposto(finance) {
  const pct = Number(finance?.imposto_pct) || 0;
  return ((Number(finance?.orcamento) || 0) * pct) / 100;
}

// Total de saídas = custos + imposto
export function totalSaidas(finance) {
  return totalCustos(finance) + valorImposto(finance);
}

export function FinanceSection({ finance, onChange, equipe = null }) {
  const f = finance || { orcamento: "", custos: [], imposto_pct: "" };
  const custos = f.custos || [];
  const total = totalCustos(f);
  const orcamento = Number(f.orcamento) || 0;
  const imposto = valorImposto(f);
  const saldo = orcamento - total - imposto;
  const membros = (equipe || []).filter((m) => (m.responsavel || "").trim());
  const linkedIds = new Set(custos.map((c) => c.equipeId).filter(Boolean));
  const pendentes = membros.filter((m) => !linkedIds.has(m.id));

  function memberLabel(m) {
    return `${m.responsavel.trim()} — ${m.funcao || "Equipe"}`;
  }
  function importEquipe() {
    const novos = pendentes.map((m) => ({
      id: Math.random().toString(36).slice(2, 9), categoria: "Equipe", valor: "", equipeId: m.id,
    }));
    patch({ custos: [...custos, ...novos] });
  }

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
          <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3, marginBottom: 6 }}>Saldo (orçamento − custos − imposto)</div>
          <div style={{
            padding: "8px 10px", borderRadius: 7, fontSize: 14, fontFamily: FONT_MONO,
            color: saldo >= 0 ? C.sage : C.brick, background: saldo >= 0 ? C.sageDim : C.brickDim,
            border: `1px solid ${saldo >= 0 ? C.sage : C.brick}`,
          }}>
            {formatBRL(saldo)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3, marginBottom: 6 }}>Imposto (%)</div>
          <input
            type="number"
            value={f.imposto_pct ?? ""}
            onChange={(e) => patch({ imposto_pct: e.target.value })}
            placeholder="0"
            style={{ ...inputInlineStyle(1), width: "100%" }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3, marginBottom: 6 }}>Valor do imposto</div>
          <div style={{ padding: "8px 10px", borderRadius: 7, fontSize: 14, fontFamily: FONT_MONO, color: C.muted, background: C.panel2, border: `1px solid ${C.line}` }}>
            {formatBRL(imposto)}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.3, marginBottom: 8 }}>
        CUSTOS ({custos.length}) · total {formatBRL(total)}
      </div>
      {custos.map((c) => {
        const m = c.equipeId ? (equipe || []).find((x) => x.id === c.equipeId) : null;
        return (
          <div key={c.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
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
            {m && (m.responsavel || "").trim() ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, padding: "7px 10px", borderRadius: 7, fontSize: 13, color: C.paper, background: C.panel2, border: `1px solid ${C.line}` }}>
                  {memberLabel(m)}
                </div>
                <IconButton onClick={() => updateCusto(c.id, { equipeId: null, responsavel: memberLabel(m) })} size={30} title="Desvincular da equipe"><Link2Off size={14} /></IconButton>
              </div>
            ) : (
              <input
                value={c.responsavel || ""}
                onChange={(e) => updateCusto(c.id, { responsavel: e.target.value, equipeId: null })}
                placeholder="Responsável (nome — função)"
                list={equipe ? "finance-equipe-list" : undefined}
                style={{ ...inputInlineStyle(1), width: "100%" }}
              />
            )}
          </div>
        );
      })}
      {equipe && (
        <datalist id="finance-equipe-list">
          {membros.map((m) => <option key={m.id} value={memberLabel(m)} />)}
        </datalist>
      )}
      <button onClick={addCusto} style={dashedAddStyle}><Plus size={14} /> Adicionar custo</button>
      {equipe && pendentes.length > 0 && (
        <button onClick={importEquipe} style={{ ...dashedAddStyle, marginTop: 8 }}>
          <Users size={14} /> Importar da equipe ({pendentes.length})
        </button>
      )}
    </div>
  );
}

export function ClientBalanceSummary({ productions, financeMap, financeRecords = [], paymentPlans = [] }) {
  const fromProductions = productions.map((p) => {
    const f = financeMap[p.id];
    const orc = Number(f?.orcamento) || 0;
    const custo = totalSaidas(f);
    return { id: p.id, nome: p.cliente || "Sem nome", data: p.data, orcamento: orc, custo, saldo: orc - custo };
  });
  const fromRecords = financeRecords.map((r) => {
    const orc = Number(r.orcamento) || 0;
    const custo = totalSaidas(r);
    return { id: r.id, nome: r.label || "Registro financeiro", data: r.data, orcamento: orc, custo, saldo: orc - custo };
  });
  const fromPayments = paymentPlans.map((plan) => {
    const orc = Number(plan.valor_total) || (plan.parcelas || []).reduce((a, p) => a + (Number(p.valor) || 0), 0);
    return { id: plan.id, nome: plan.titulo || "Plano de pagamento", data: "", orcamento: orc, custo: 0, saldo: orc };
  });
  const rows = [...fromProductions, ...fromRecords, ...fromPayments].filter((r) => r.orcamento > 0 || r.custo > 0);

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

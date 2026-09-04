import React from "react";
import { CalendarClock, AlertTriangle, Award, PieChart } from "lucide-react";
import { C, FONT_DISPLAY, FONT_MONO } from "./theme";
import { formatDataComDiaSemana } from "./datetime";
import { formatBRL, totalCustos } from "./finance";

function getProductionIssues(p) {
  const issues = [];
  if (!p.clienteId) issues.push("Sem cliente vinculado");
  if (!p.data) issues.push("Sem data");
  if (!p.equipe || p.equipe.length === 0) issues.push("Sem equipe");
  if (!p.shots || p.shots.length === 0) issues.push("Sem shots");
  else if (p.shots.some((s) => !s.takes || s.takes.length === 0)) issues.push("Shots sem takes");
  return issues;
}

function StatCard({ label, value, tone }) {
  return (
    <div style={{ flex: 1, minWidth: 140, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.faint, letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, color: tone || C.paper }}>{value}</div>
    </div>
  );
}

export function ProductionsDashboard({ order, productions, userName }) {
  const today = new Date().toISOString().slice(0, 10);
  const all = order.map((id) => productions[id]).filter(Boolean);
  const upcoming = all.filter((p) => p.data && p.data >= today).sort((a, b) => a.data.localeCompare(b.data));
  const incomplete = all
    .map((p) => ({ p, issues: getProductionIssues(p) }))
    .filter((x) => x.issues.length > 0);
  const firstName = (userName || "").trim().split(" ")[0];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: C.paper, marginBottom: 4 }}>
        {firstName ? `Olá, ${firstName}!` : "Visão geral"}
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 22 }}>
        Selecione uma produção à esquerda, ou crie uma nova.
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="PRÓXIMAS SESSÕES" value={upcoming.length} tone={C.sage} />
        <StatCard label="PRODUÇÕES INCOMPLETAS" value={incomplete.length} tone={incomplete.length ? C.amber : C.sage} />
        <StatCard label="TOTAL DE PRODUÇÕES" value={all.length} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <CalendarClock size={15} color={C.faint} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.4 }}>PRÓXIMAS SESSÕES</span>
      </div>
      {upcoming.length === 0 ? (
        <div style={{ color: C.faint, fontSize: 13.5, padding: "10px 4px", marginBottom: 26 }}>Nenhuma sessão com data futura cadastrada.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
          {upcoming.slice(0, 6).map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 14px" }}>
              <span style={{ flex: 1, fontSize: 13.5, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.cliente || "Sem nome"}</span>
              <span style={{ fontSize: 12, color: C.amber, fontFamily: FONT_MONO }}>{formatDataComDiaSemana(p.data)}</span>
            </div>
          ))}
          {upcoming.length > 6 && (
            <div style={{ fontSize: 12, color: C.faint, textAlign: "center" }}>+{upcoming.length - 6} outras</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <AlertTriangle size={15} color={C.faint} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.4 }}>O QUE FALTA PREENCHER</span>
      </div>
      {incomplete.length === 0 ? (
        <div style={{ color: C.faint, fontSize: 13.5, padding: "10px 4px" }}>Tudo certo — nenhuma produção com pendências.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {incomplete.slice(0, 8).map(({ p, issues }) => (
            <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 14px" }}>
              <div style={{ fontSize: 13.5, color: C.paper, marginBottom: 6 }}>{p.cliente || "Sem nome"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {issues.map((issue) => (
                  <span key={issue} style={{ fontSize: 11, fontFamily: FONT_MONO, color: C.amber, background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 12, padding: "3px 9px" }}>
                    {issue}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClientsDashboard({ clients, productions, financeMap, financeRecords, paymentPlans = [] }) {
  const productionRows = productions.map((p) => ({
    clientId: p.clienteId,
    orcamento: Number(financeMap[p.id]?.orcamento) || 0,
    custos: financeMap[p.id]?.custos || [],
  }));
  const recordRows = financeRecords.map((r) => ({
    clientId: r.client_id,
    orcamento: Number(r.orcamento) || 0,
    custos: r.custos || [],
  }));
  const paymentRows = paymentPlans.map((plan) => ({
    clientId: plan.client_id,
    orcamento: Number(plan.valor_total) || (plan.parcelas || []).reduce((a, p) => a + (Number(p.valor) || 0), 0),
    custos: [],
  }));
  const rows = [...productionRows, ...recordRows, ...paymentRows];

  const totalFaturamento = rows.reduce((a, r) => a + r.orcamento, 0);
  const totalCusto = rows.reduce((a, r) => a + totalCustos({ custos: r.custos }), 0);

  const byCategory = {};
  for (const r of rows) {
    for (const c of r.custos || []) {
      const cat = c.categoria || "Outro";
      byCategory[cat] = (byCategory[cat] || 0) + (Number(c.valor) || 0);
    }
  }
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const byClient = {};
  for (const r of rows) {
    if (!r.clientId) continue;
    byClient[r.clientId] = (byClient[r.clientId] || 0) + r.orcamento;
  }
  const topClients = Object.entries(byClient)
    .map(([id, total]) => ({ id, total, name: clients[id]?.name || "Cliente" }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: C.paper, marginBottom: 4 }}>
        Visão financeira
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 22 }}>
        Selecione um cliente à esquerda, ou cadastre um novo.
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 26, flexWrap: "wrap" }}>
        <StatCard label="FATURAMENTO TOTAL" value={formatBRL(totalFaturamento)} tone={C.sage} />
        <StatCard label="CUSTO TOTAL" value={formatBRL(totalCusto)} />
        <StatCard label="SALDO" value={formatBRL(totalFaturamento - totalCusto)} tone={totalFaturamento - totalCusto >= 0 ? C.sage : C.brick} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <PieChart size={15} color={C.faint} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.4 }}>O QUE MAIS CUSTA</span>
      </div>
      {topCategories.length === 0 ? (
        <div style={{ color: C.faint, fontSize: 13.5, padding: "10px 4px", marginBottom: 26 }}>Nenhum custo lançado ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 26 }}>
          {topCategories.map(([cat, total]) => {
            const pct = topCategories[0][1] ? (total / topCategories[0][1]) * 100 : 0;
            return (
              <div key={cat} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                  <span style={{ color: C.paper }}>{cat}</span>
                  <span style={{ color: C.muted, fontFamily: FONT_MONO }}>{formatBRL(total)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: C.lineSoft, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: C.amber }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Award size={15} color={C.faint} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.muted, letterSpacing: 0.4 }}>CLIENTES QUE MAIS CONTRATAM</span>
      </div>
      {topClients.length === 0 ? (
        <div style={{ color: C.faint, fontSize: 13.5, padding: "10px 4px" }}>Nenhum faturamento vinculado a cliente ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {topClients.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 14px" }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.faint, width: 18 }}>{i + 1}º</span>
              <span style={{ flex: 1, fontSize: 13.5, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              <span style={{ fontSize: 12.5, color: C.sage, fontFamily: FONT_MONO }}>{formatBRL(c.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

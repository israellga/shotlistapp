import React from "react";
import { CalendarClock, AlertTriangle, Award, PieChart, Wallet, ChevronRight } from "lucide-react";
import { C, FONT_DISPLAY, FONT_MONO } from "./theme";
import { formatDataComDiaSemana, formatIntervaloDatas } from "./datetime";
import { productionStatus } from "./productionStatus";
import { formatBRL, totalCustos, valorImposto } from "./finance";

function getProductionIssues(p) {
  const issues = [];
  if (!p.clienteId) issues.push("Sem cliente vinculado");
  if (!p.data) issues.push("Sem data");
  if (!p.equipe || p.equipe.length === 0) issues.push("Sem equipe");
  if (!p.shots || p.shots.length === 0) issues.push("Sem shots");
  else if (p.shots.some((s) => !s.takes || s.takes.length === 0)) issues.push("Shots sem takes");
  return issues;
}

function StatCard({ label, value, dot, onClick, small }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={onClick ? "glass hover-row" : "glass"}
      onClick={onClick}
      style={{ flex: 1, minWidth: small ? 120 : 140, minHeight: 44, textAlign: "left", fontFamily: "inherit", color: "inherit", borderRadius: 14, padding: "14px 16px", cursor: onClick ? "pointer" : "default" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 500, color: C.faint, letterSpacing: 0.4, marginBottom: 6 }}>
        {dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />}
        {label}
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: small ? 18 : 26, fontWeight: 600, color: C.paper }}>{value}</div>
    </Tag>
  );
}

function localISO(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysFrom(todayISO, iso) {
  const a = new Date(todayISO + "T00:00:00");
  const b = new Date(iso + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

function whenLabel(diff) {
  if (diff < 0) return `há ${-diff} dia${diff === -1 ? "" : "s"}`;
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `em ${diff} dias`;
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Icon size={15} color={C.faint} />
      <span style={{ fontSize: 13, fontWeight: 600, color: C.muted, letterSpacing: 0.2 }}>{children}</span>
    </div>
  );
}

const rowBtn = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 48, textAlign: "left",
  borderRadius: 12, padding: "10px 14px", cursor: "pointer", color: "inherit", fontFamily: "inherit",
};

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function MonthNav({ ym, onChange }) {
  const [y, m] = ym.split("-").map(Number);
  const go = (delta) => { const d = new Date(y, m - 1 + delta, 1); onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const b = { width: 44, height: 44, display: "grid", placeItems: "center", background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
      <button onClick={() => go(-1)} style={b} aria-label="Mês anterior">‹</button>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.paper }}>{MONTHS[m - 1]} {y}</div>
      <button onClick={() => go(1)} style={b} aria-label="Próximo mês">›</button>
    </div>
  );
}

function MonthCalendar({ productions, today, onOpenProduction, onCopyCalendar }) {
  const [copied, setCopied] = React.useState(false);
  const [ym, setYm] = React.useState(today.slice(0, 7));
  const [sel, setSel] = React.useState(null);
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const iso = (d) => `${ym}-${String(d).padStart(2, "0")}`;
  const on = (p, d) => p.data && p.data <= iso(d) && iso(d) <= (p.dataFim || p.data);
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const list = sel ? productions.filter((p) => on(p, sel)) : [];
  return (
    <div className="glass" style={{ borderRadius: 18, padding: "10px 12px 14px", marginBottom: 24 }}>
      <MonthNav ym={ym} onChange={(v) => { setYm(v); setSel(null); }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((w, i) => <div key={i} style={{ fontSize: 11.5, color: C.faint, padding: "4px 0" }}>{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const has = productions.some((p) => on(p, d));
          const isToday = iso(d) === today;
          const isSel = sel === iso(d);
          return (
            <button
              key={i}
              onClick={() => setSel(isSel ? null : iso(d))}
              style={{
                minHeight: 40, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14,
                background: isSel ? "rgba(253,223,75,0.22)" : "transparent",
                color: isToday ? C.amber : C.paper, fontWeight: isToday ? 700 : 400,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
              }}
            >
              {d}
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: has ? C.amber : "transparent" }} />
            </button>
          );
        })}
      </div>
      {onCopyCalendar && (
        <button
          onClick={async () => { const ok = await onCopyCalendar(); setCopied(ok); setTimeout(() => setCopied(false), 3000); }}
          style={{ display: "block", width: "100%", minHeight: 44, marginTop: 8, background: "transparent", border: "none", color: copied ? C.sage : C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
        >
          {copied ? "Link copiado. No Google Agenda: Outras agendas, Por URL, colar" : "Sincronizar com Google/Apple Agenda (copiar link)"}
        </button>
      )}
      {sel && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {list.length === 0 ? (
            <div style={{ fontSize: 13, color: C.faint, padding: "6px 4px" }}>Nada marcado neste dia.</div>
          ) : list.map((p) => (
            <button key={p.id} onClick={() => onOpenProduction && onOpenProduction(p.id)} style={{ ...rowBtn, background: "rgba(255,255,255,0.05)", border: "none", minHeight: 44 }}>
              <span style={{ flex: 1, fontSize: 14, color: C.paper }}>{p.cliente || "Sem nome"}</span>
              <ChevronRight size={15} color={C.faint} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MonthResult({ productions, financeMap, today }) {
  const [ym, setYm] = React.useState(today.slice(0, 7));
  const rows = productions.filter((p) => (p.data || "").slice(0, 7) === ym);
  let receita = 0, custo = 0;
  for (const p of rows) {
    const f = financeMap[p.id];
    receita += Number(f?.orcamento) || 0;
    custo += totalCustos(f || { custos: [] }) + valorImposto(f);
  }
  const lucro = receita - custo;
  const margem = receita > 0 ? Math.round((lucro / receita) * 100) : null;
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionTitle icon={PieChart}>Resultado do mês</SectionTitle>
      <div className="glass" style={{ borderRadius: 18, padding: "6px 14px 14px" }}>
        <MonthNav ym={ym} onChange={setYm} />
        {rows.length === 0 ? (
          <div style={{ fontSize: 13.5, color: C.faint, padding: "8px 4px" }}>Nenhuma produção com data neste mês.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <StatCard label="RECEITA" value={formatBRL(receita)} small />
              <StatCard label="CUSTOS E IMPOSTO" value={formatBRL(custo)} small />
              <StatCard label={margem === null ? "LUCRO" : `LUCRO · ${margem}%`} value={formatBRL(lucro)} dot={lucro >= 0 ? C.sage : C.brick} small />
            </div>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>{rows.length} produç{rows.length === 1 ? "ão" : "ões"} com data neste mês, pelo orçamento e custos de cada uma.</div>
          </>
        )}
      </div>
    </div>
  );
}

function gcalLink(p) {
  const d = (s) => (s || "").replace(/-/g, "");
  const end = new Date((p.dataFim || p.data) + "T00:00:00"); end.setDate(end.getDate() + 1);
  const e = `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, "0")}${String(end.getDate()).padStart(2, "0")}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Produção: " + (p.cliente || ""))}&dates=${d(p.data)}/${e}`;
}

export function ProductionsDashboard({ order, productions, userName, financeMap = {}, paymentPlans = [], clients = {}, isGestor, onOpenProduction, onOpenClient, onFilterStatus, onCreate, onCopyCalendar }) {
  const today = localISO();
  const all = order.map((id) => productions[id]).filter(Boolean).filter((p) => !p.arquivada);
  const counts = { afazer: 0, andamento: 0, concluido: 0 };
  for (const p of all) counts[productionStatus(p)]++;
  const upcoming = all
    .filter((p) => { const endRef = p.dataFim || p.data; return endRef && endRef >= today; })
    .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  const incomplete = all
    .map((p) => ({ p, issues: getProductionIssues(p) }))
    .filter((x) => x.issues.length > 0);
  const firstName = (userName || "").trim().split(" ")[0];

  const next = upcoming[0];
  const nextDiff = next ? daysFrom(today, next.data || today) : 0;
  const nextHappening = next && next.data && next.data <= today;

  // Parcelas em aberto (somente gestor)
  const open = [];
  if (isGestor) {
    for (const plan of paymentPlans) {
      for (const parc of plan.parcelas || []) {
        if (parc.pago || !parc.vencimento) continue;
        open.push({ plan, parc, diff: daysFrom(today, parc.vencimento), valor: Number(parc.valor) || 0 });
      }
    }
    open.sort((a, b) => a.parc.vencimento.localeCompare(b.parc.vencimento));
  }
  const overdue = open.filter((x) => x.diff < 0);
  const week = open.filter((x) => x.diff >= 0 && x.diff <= 7);
  const monthKey = today.slice(0, 7);
  const monthTotal = open.filter((x) => x.parc.vencimento.slice(0, 7) === monthKey).reduce((a, x) => a + x.valor, 0);
  const sum = (arr) => arr.reduce((a, x) => a + x.valor, 0);
  const moneyList = [...overdue, ...week].slice(0, 4);

  return (
    <div className="fade-in-up" style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, letterSpacing: 0.3, color: C.paper, marginBottom: 18 }}>
        {firstName ? `Olá, ${firstName}!` : "Visão geral"}
      </div>

      {all.length === 0 ? (
        <div className="glass" style={{ borderRadius: 16, padding: "20px 18px", marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.paper, marginBottom: 12 }}>Comece em três passos</div>
          {["Cadastre o cliente (aba Clientes, no topo)", "Crie a produção e ligue ao cliente", "Monte o shotlist e compartilhe o link com o cliente"].map((t, i) => (
            <div key={t} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0", color: C.muted, fontSize: 14 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: C.amberDim, color: C.amber, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
              {t}
            </div>
          ))}
          {onCreate && (
            <button className="btn-glass-primary" onClick={onCreate} style={{ marginTop: 14, border: "none", borderRadius: 22, padding: "12px 20px", minHeight: 44, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Nova produção
            </button>
          )}
        </div>
      ) : next ? (
        <button
          className="glass hover-row"
          onClick={() => onOpenProduction && onOpenProduction(next.id)}
          style={{ ...rowBtn, flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "16px 18px", borderRadius: 16, marginBottom: 20, borderColor: nextHappening ? C.amber : undefined }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: nextHappening ? C.amber : C.muted }}>
            {nextHappening ? "Acontecendo agora" : `Próxima sessão · ${whenLabel(nextDiff)}`}
          </span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.paper }}>{next.cliente || "Sem nome"}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: C.muted, width: "100%" }}>
            <span style={{ flex: 1 }}>{formatIntervaloDatas(next.data, next.dataFim)}</span>
            <span style={{ color: C.amber, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 2 }}>Abrir <ChevronRight size={15} /></span>
          </span>
        </button>
      ) : null}

      {next && next.data && (
        <a href={gcalLink(next)} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, marginTop: -8, marginBottom: 14, color: C.muted, fontSize: 13, textDecoration: "none" }}>
          + Adicionar ao Google Agenda
        </a>
      )}

      {all.length > 0 && <MonthCalendar productions={all} today={today} onOpenProduction={onOpenProduction} onCopyCalendar={onCopyCalendar} />}

      {isGestor && all.length > 0 && <MonthResult productions={all} financeMap={financeMap} today={today} />}

      {isGestor && (overdue.length > 0 || week.length > 0 || monthTotal > 0) && (
        <div style={{ marginBottom: 24 }}>
          <SectionTitle icon={Wallet}>Dinheiro</SectionTitle>
          <div style={{ display: "flex", gap: 10, marginBottom: moneyList.length ? 10 : 0, flexWrap: "wrap" }}>
            <StatCard label="ATRASADO" value={formatBRL(sum(overdue))} dot={overdue.length ? C.brick : C.faint} small />
            <StatCard label="PRÓXIMOS 7 DIAS" value={formatBRL(sum(week))} dot={C.amber} small />
            <StatCard label="A RECEBER NO MÊS" value={formatBRL(monthTotal)} dot={C.sage} small />
          </div>
          {moneyList.map(({ plan, parc, diff, valor }) => (
            <button key={parc.id} className="glass hover-row" onClick={() => onOpenClient && onOpenClient(plan.client_id)} style={{ ...rowBtn, marginBottom: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {clients[plan.client_id]?.name || "Cliente"}
              </span>
              <span style={{ fontSize: 12.5, color: diff < 0 ? C.brick : C.muted }}>{diff < 0 ? `atrasada ${whenLabel(diff)}` : whenLabel(diff)}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.paper }}>{formatBRL(valor)}</span>
              <ChevronRight size={15} color={C.faint} />
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 26, flexWrap: "wrap" }}>
        <StatCard label="A FAZER" value={counts.afazer} dot={C.faint} onClick={onFilterStatus ? () => onFilterStatus("afazer") : undefined} />
        <StatCard label="EM ANDAMENTO" value={counts.andamento} dot={C.amber} onClick={onFilterStatus ? () => onFilterStatus("andamento") : undefined} />
        <StatCard label="CONCLUÍDO" value={counts.concluido} dot={C.sage} onClick={onFilterStatus ? () => onFilterStatus("concluido") : undefined} />
      </div>

      {upcoming.length > 1 && (
        <>
          <SectionTitle icon={CalendarClock}>Depois disso</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
            {upcoming.slice(1, 6).map((p) => (
              <button key={p.id} className="glass hover-row" onClick={() => onOpenProduction && onOpenProduction(p.id)} style={rowBtn}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.cliente || "Sem nome"}</span>
                <span style={{ fontSize: 12.5, color: C.muted }}>{formatIntervaloDatas(p.data, p.dataFim)}</span>
                <ChevronRight size={15} color={C.faint} />
              </button>
            ))}
            {upcoming.length > 6 && (
              <div style={{ fontSize: 12, color: C.faint, textAlign: "center" }}>+{upcoming.length - 6} outras</div>
            )}
          </div>
        </>
      )}

      {all.length > 0 && (
        <>
          <SectionTitle icon={AlertTriangle}>O que falta preencher</SectionTitle>
          {incomplete.length === 0 ? (
            <div style={{ color: C.faint, fontSize: 13.5, padding: "10px 4px" }}>Tudo certo, nenhuma produção com pendências.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {incomplete.slice(0, 8).map(({ p, issues }) => (
                <button key={p.id} className="glass hover-row" onClick={() => onOpenProduction && onOpenProduction(p.id)} style={{ ...rowBtn, flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ width: "100%", display: "flex", alignItems: "center" }}>
                    <span style={{ flex: 1, fontSize: 14, color: C.paper }}>{p.cliente || "Sem nome"}</span>
                    <ChevronRight size={15} color={C.faint} />
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {issues.map((issue) => (
                      <span key={issue} style={{ fontSize: 12, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 12, padding: "3px 10px" }}>{issue}</span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ClientsDashboard({ clients, productions, financeMap, financeRecords, paymentPlans = [] }) {
  const productionRows = productions.map((p) => ({
    clientId: p.clienteId,
    orcamento: Number(financeMap[p.id]?.orcamento) || 0,
    custos: financeMap[p.id]?.custos || [],
    imposto: valorImposto(financeMap[p.id]),
  }));
  const recordRows = financeRecords.map((r) => ({
    clientId: r.client_id,
    orcamento: Number(r.orcamento) || 0,
    custos: r.custos || [],
    imposto: valorImposto(r),
  }));
  const paymentRows = paymentPlans.map((plan) => ({
    clientId: plan.client_id,
    orcamento: Number(plan.valor_total) || (plan.parcelas || []).reduce((a, p) => a + (Number(p.valor) || 0), 0),
    custos: [],
  }));
  const rows = [...productionRows, ...recordRows, ...paymentRows];

  const totalFaturamento = rows.reduce((a, r) => a + r.orcamento, 0);
  const totalCusto = rows.reduce((a, r) => a + totalCustos({ custos: r.custos }) + (r.imposto || 0), 0);

  const byCategory = {};
  for (const r of rows) {
    for (const c of r.custos || []) {
      const cat = c.categoria || "Outro";
      byCategory[cat] = (byCategory[cat] || 0) + (Number(c.valor) || 0);
    }
  }
  const totalImposto = rows.reduce((a, r) => a + (r.imposto || 0), 0);
  if (totalImposto > 0) byCategory["Imposto"] = totalImposto;
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
    <div className="fade-in-up" style={{ maxWidth: 720, margin: "0 auto" }}>
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
              <div key={cat} className="glass" style={{ borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                  <span style={{ color: C.paper }}>{cat}</span>
                  <span style={{ color: C.muted, fontFamily: FONT_MONO }}>{formatBRL(total)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: C.lineSoft, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: C.amber, transition: "width 0.4s ease" }} />
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
            <div key={c.id} className="glass" style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 12, padding: "10px 14px" }}>
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

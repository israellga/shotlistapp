import React from "react";
import { TrendingUp, HandCoins, Heart, Gauge, MessageCircle, Check } from "lucide-react";
import { C, FONT_DISPLAY, FONT_MONO } from "./theme";
import { formatBRL, totalCustos, valorImposto } from "./finance";

const card = { borderRadius: 18, padding: "14px 16px" };
const wa = (phone) => { const d = (phone || "").replace(/\D/g, ""); return d.length >= 10 ? (d.length <= 11 ? "55" + d : d) : ""; };
const waUrl = (phone, text) => `https://wa.me/${wa(phone)}?text=${encodeURIComponent(text)}`;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const brDate = (iso) => (iso || "").split("-").reverse().join("/");

function Title({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Icon size={15} color={C.faint} />
      <span style={{ fontSize: 13, fontWeight: 600, color: C.muted, letterSpacing: 0.2 }}>{children}</span>
    </div>
  );
}

// Previsão de caixa: parcelas a receber por mês (próximos 6) menos custos ainda não pagos das produções do mês.
export function CashForecast({ paymentPlans, productions, financeMap, today }) {
  const base = new Date(today.slice(0, 7) + "-01T00:00:00");
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MESES[d.getMonth()], entra: 0, sai: 0 };
  });
  const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
  for (const pl of paymentPlans || []) {
    for (const pc of pl.parcelas || []) {
      if (pc.pago || !(Number(pc.valor) > 0)) continue;
      const k = (pc.vencimento || today).slice(0, 7);
      const i = k < months[0].key ? 0 : idx[k];
      if (i != null) months[i].entra += Number(pc.valor);
    }
  }
  for (const p of productions) {
    const f = financeMap[p.id];
    if (!f || !p.data) continue;
    const k = p.data.slice(0, 7);
    const i = k < months[0].key ? 0 : idx[k];
    if (i == null) continue;
    months[i].sai += (f.custos || []).filter((c) => !c.pago).reduce((a, c) => a + (Number(c.valor) || 0), 0) + valorImposto(f);
  }
  const total = months.reduce((a, m) => a + m.entra + m.sai, 0);
  if (!total) return null;
  const max = Math.max(...months.map((m) => Math.max(m.entra, m.sai)), 1);
  return (
    <div style={{ marginBottom: 24 }}>
      <Title icon={TrendingUp}>Previsão de caixa (6 meses)</Title>
      <div className="glass glass-edge" style={card}>
        {months.map((m) => {
          const saldo = m.entra - m.sai;
          return (
            <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40 }}>
              <span style={{ width: 34, fontFamily: FONT_MONO, fontSize: 12, color: C.faint, textTransform: "uppercase" }}>{m.label}</span>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ height: 6, borderRadius: 3, width: `${(m.entra / max) * 100}%`, minWidth: m.entra ? 4 : 0, background: C.sage }} />
                <div style={{ height: 6, borderRadius: 3, width: `${(m.sai / max) * 100}%`, minWidth: m.sai ? 4 : 0, background: C.brick }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: saldo >= 0 ? C.sage : C.brick, minWidth: 92, textAlign: "right" }}>{formatBRL(saldo)}</span>
            </div>
          );
        })}
        <div style={{ fontSize: 12, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          Verde: parcelas a receber · vermelho: custos e imposto ainda não pagos, no mês da produção. Parcelas vencidas entram no mês atual.
        </div>
      </div>
    </div>
  );
}

// Cobranças atrasadas com mensagem pronta de WhatsApp.
export function Cobrancas({ paymentPlans, clients, today, issuer }) {
  const rows = [];
  for (const pl of paymentPlans || []) {
    const cl = clients[pl.client_id];
    for (const pc of pl.parcelas || []) {
      if (pc.pago || !pc.vencimento || pc.vencimento >= today || !(Number(pc.valor) > 0)) continue;
      const dias = Math.round((new Date(today + "T00:00:00") - new Date(pc.vencimento + "T00:00:00")) / 86400000);
      rows.push({ id: pl.id + pc.id, cl, pl, pc, dias });
    }
  }
  if (!rows.length) return null;
  rows.sort((a, b) => b.dias - a.dias);
  return (
    <div style={{ marginBottom: 24 }}>
      <Title icon={HandCoins}>Cobranças atrasadas</Title>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.slice(0, 6).map(({ id, cl, pl, pc, dias }) => {
          const first = (cl?.responsavel || cl?.name || "").trim().split(" ")[0];
          const msg = `Olá${first ? ", " + first : ""}! Tudo bem? Passando para lembrar da parcela ${pc.numero || ""} de ${formatBRL(pc.valor)}${pl.titulo ? " (" + pl.titulo + ")" : ""}, que venceu em ${brDate(pc.vencimento)}. Se já pagou, desconsidere e me avise para eu dar baixa. Qualquer dúvida estou à disposição!${issuer ? "\n" + issuer : ""}`;
          const link = wa(cl?.phone) ? waUrl(cl.phone, msg) : "";
          return (
            <div key={id} className="glass" style={{ ...card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, color: C.paper, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cl?.name || "Cliente"}</div>
                <div style={{ fontSize: 12.5, color: C.brick }}>{formatBRL(pc.valor)} · {dias} dia{dias === 1 ? "" : "s"} de atraso</div>
              </div>
              {link ? (
                <a href={link} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px", borderRadius: 20, border: `1px solid ${C.amber}`, color: C.amber, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                  <MessageCircle size={14} /> Cobrar
                </a>
              ) : <span style={{ fontSize: 12, color: C.faint }}>sem WhatsApp</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Pós-venda: pedir depoimento após a entrega e lembrar de aniversário de 1 ano da captação.
export function PosVenda({ productions, clients, today, onMark }) {
  const days = (iso) => Math.round((new Date(today + "T00:00:00") - new Date(iso + "T00:00:00")) / 86400000);
  const items = [];
  for (const p of productions) {
    if (p.posVendaEm || !p.data) continue;
    const d = days(p.dataFim || p.data);
    const cl = clients[p.clienteId];
    const first = (cl?.responsavel || cl?.name || p.cliente || "").trim().split(" ")[0];
    if (p.entrega?.etapa === "entregue" && d >= 7 && d <= 60) {
      items.push({ p, cl, tipo: "Pedir depoimento", msg: `Olá${first ? ", " + first : ""}! Espero que tenha gostado do material. Pode me contar em poucas linhas como foi a experiência? Seu depoimento me ajuda muito. E se conhecer alguém que precise de fotos ou vídeo, fico feliz com a indicação!` });
    } else if (d >= 358 && d <= 372) {
      items.push({ p, cl, tipo: "1 ano da captação", msg: `Olá${first ? ", " + first : ""}! Hoje faz 1 ano da nossa produção e lembrei de você. Se quiser renovar o material ou fazer uma nova captação, vamos conversar!` });
    }
  }
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <Title icon={Heart}>Pós-venda</Title>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.slice(0, 5).map(({ p, cl, tipo, msg }) => (
          <div key={p.id + tipo} className="glass" style={{ ...card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, color: C.paper, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.cliente || cl?.name}</div>
              <div style={{ fontSize: 12.5, color: C.muted }}>{tipo}</div>
            </div>
            {wa(cl?.phone) && (
              <a href={waUrl(cl.phone, msg)} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px", borderRadius: 20, border: `1px solid ${C.amber}`, color: C.amber, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                <MessageCircle size={14} /> Enviar
              </a>
            )}
            <button onClick={() => onMark(p)} title="Marcar como feito" style={{ width: 40, height: 40, borderRadius: 20, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer", display: "grid", placeItems: "center" }}><Check size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Margem real por produção (receita - custos - imposto), pior para melhor.
export function MargemLista({ productions, financeMap, onOpen }) {
  const rows = productions
    .map((p) => {
      const f = financeMap[p.id];
      const r = Number(f?.orcamento) || 0;
      if (!r) return null;
      const custo = totalCustos(f) + valorImposto(f);
      return { p, r, lucro: r - custo, pct: Math.round(((r - custo) / r) * 100) };
    })
    .filter(Boolean)
    .sort((a, b) => b.p.data?.localeCompare?.(a.p.data || "") || 0)
    .slice(0, 6);
  if (!rows.length) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <Title icon={Gauge}>Margem por produção</Title>
      <div className="glass glass-edge" style={card}>
        {rows.map(({ p, lucro, pct }) => (
          <button key={p.id} onClick={() => onOpen && onOpen(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 44, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", padding: 0 }}>
            <span style={{ flex: 1, fontSize: 14, color: C.paper, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.cliente || "Sem nome"}</span>
            <span style={{ fontSize: 13, color: lucro >= 0 ? C.sage : C.brick, fontWeight: 600 }}>{formatBRL(lucro)}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: pct >= 40 ? C.sage : pct >= 20 ? C.amber : C.brick, minWidth: 40, textAlign: "right" }}>{pct}%</span>
          </button>
        ))}
        <div style={{ fontSize: 12, color: C.faint, marginTop: 6 }}>Pelo orçamento menos custos (equipe, locação…) e imposto. Verde acima de 40%.</div>
      </div>
    </div>
  );
}

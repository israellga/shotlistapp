// Envia lembretes de parcelas por e-mail (Resend). Chamada todo dia pelo pg_cron.
// Secrets necessárias: RESEND_API_KEY, REMINDER_FROM (ex: "Nome <financeiro@seudominio.com>"), CRON_SECRET
// Opcional: REMINDER_REPLY_TO, APP_URL (padrão https://shotlistapp.netlify.app)
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("REMINDER_FROM");
const REPLY_TO = Deno.env.get("REMINDER_REPLY_TO");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const APP_URL = (Deno.env.get("APP_URL") || "https://shotlistapp.netlify.app").replace(/\/$/, "");

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const fmtDate = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

function todayBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function daysBetween(fromIso: string, toIso: string) {
  const a = Date.parse(fromIso + "T00:00:00Z");
  const b = Date.parse(toIso + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

type Kind = "before" | "due" | "overdue";

function buildEmail(kind: Kind, p: { cliente: string; titulo: string; numero: number; total: number; valor: number | null; vencimento: string; dias: number; link: string | null }) {
  const valorTxt = p.valor ? brl(p.valor) : null;
  const quando =
    kind === "due" ? "vence hoje" :
    kind === "overdue" ? "venceu ontem e ainda não consta como paga" :
    p.dias === 1 ? "vence amanhã" : `vence em ${p.dias} dias`;
  const subject =
    kind === "due" ? `Lembrete: parcela ${p.numero} vence hoje` :
    kind === "overdue" ? `Parcela ${p.numero} em atraso` :
    `Lembrete: parcela ${p.numero} ${quando}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;">
<div style="max-width:520px;margin:0 auto;padding:28px 16px;">
  <div style="background:#fff;border-radius:14px;padding:28px;border:1px solid #e5e5e5;">
    <p style="margin:0 0 14px;font-size:15px;">Olá${p.cliente ? ", " + esc(p.cliente) : ""}!</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.5;">A parcela <strong>${p.numero}</strong>${p.titulo ? " do plano <strong>" + esc(p.titulo) + "</strong>" : ""} ${quando}.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      ${valorTxt ? `<tr><td style="padding:8px 0;color:#666;">Valor</td><td style="padding:8px 0;text-align:right;font-weight:600;">${esc(valorTxt)}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#666;border-top:1px solid #eee;">Vencimento</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #eee;">${esc(fmtDate(p.vencimento))}</td></tr>
      <tr><td style="padding:8px 0;color:#666;border-top:1px solid #eee;">Parcela</td><td style="padding:8px 0;text-align:right;border-top:1px solid #eee;">${p.numero} de ${p.total}</td></tr>
    </table>
    ${p.link ? `<a href="${esc(p.link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-size:14px;font-weight:600;">Ver acompanhamento do pagamento</a>` : ""}
    <p style="margin:22px 0 0;font-size:12.5px;color:#888;line-height:1.5;">Se você já pagou, pode desconsiderar este e-mail. Em caso de dúvida, é só responder esta mensagem.</p>
  </div>
</div></body></html>`;
  return { subject, html };
}

async function sendEmail(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(REPLY_TO ? { reply_to: REPLY_TO } : {}) }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!RESEND_API_KEY || !FROM) return json({ error: "Faltam as secrets RESEND_API_KEY e REMINDER_FROM." }, 500);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }

  // ---- Modo teste: usuário logado manda o e-mail de exemplo para si mesmo ----
  if (body?.test) {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u, error } = await admin.auth.getUser(token);
    if (error || !u?.user?.email) return json({ error: "Sessão inválida." }, 401);
    const hoje = todayBR();
    const { subject, html } = buildEmail(body.kind === "due" || body.kind === "overdue" ? body.kind : "before", {
      cliente: String(body.cliente || "Cliente exemplo"), titulo: String(body.titulo || "Plano de exemplo"),
      numero: 1, total: 3, valor: Number(body.valor) || 1500, vencimento: hoje, dias: Number(body.dias) || 3, link: null,
    });
    try { await sendEmail(u.user.email, "[TESTE] " + subject, html); } catch (e) { return json({ error: e.message }, 502); }
    return json({ ok: true, sentTo: u.user.email });
  }

  // ---- Modo automático (cron) ----
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "Não autorizado." }, 401);

  const hoje = todayBR();
  const { data: plans, error: pe } = await admin.from("payment_plans").select("*").eq("notify_enabled", true);
  if (pe) return json({ error: pe.message }, 500);
  const clientIds = [...new Set((plans || []).map((p) => p.client_id).filter(Boolean))];
  const { data: clients } = clientIds.length ? await admin.from("clients").select("id,name,responsavel,email").in("id", clientIds) : { data: [] as any[] };
  const byId = new Map((clients || []).map((c: any) => [c.id, c]));

  const summary = { sent: 0, skipped: 0, errors: [] as string[] };
  for (const plan of plans || []) {
    const client: any = byId.get(plan.client_id);
    const to = (client?.email || "").trim();
    if (!to || !/^\S+@\S+\.\S+$/.test(to)) { summary.skipped++; continue; }
    const parcelas: any[] = Array.isArray(plan.parcelas) ? plan.parcelas : [];
    const antecedencia = Number(plan.notify_days_before) >= 0 ? Number(plan.notify_days_before) : 3;
    for (const parc of parcelas) {
      if (parc.pago || !parc.vencimento) continue;
      const dias = daysBetween(hoje, parc.vencimento); // >0: faltam; 0: hoje; <0: atrasada
      const kind: Kind | null = dias === antecedencia && antecedencia > 0 ? "before" : dias === 0 ? "due" : dias === -1 ? "overdue" : null;
      if (!kind) continue;
      const { error: ie } = await admin.from("payment_notifications").insert({ plan_id: plan.id, parcela_id: String(parc.id), kind, sent_to: to });
      if (ie) { if (ie.code !== "23505") summary.errors.push(ie.message); continue; } // já enviado
      try {
        const { subject, html } = buildEmail(kind, {
          cliente: client?.responsavel || client?.name || "", titulo: plan.titulo || "", numero: parc.numero ?? 0, total: parcelas.length,
          valor: Number(parc.valor) || null, vencimento: parc.vencimento, dias,
          link: plan.share_enabled ? `${APP_URL}/?payment=${plan.id}` : null,
        });
        await sendEmail(to, subject, html);
        summary.sent++;
      } catch (e) {
        await admin.from("payment_notifications").delete().eq("plan_id", plan.id).eq("parcela_id", String(parc.id)).eq("kind", kind);
        summary.errors.push(`${plan.id}/${parc.id}: ${e.message}`);
      }
    }
  }
  return json({ date: hoje, ...summary });
});

// Aviso diário por push (PWA): sessões de hoje/amanhã e entregas com prazo hoje. Chamado pelo pg_cron.
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };

async function rest(path: string, init?: RequestInit) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H, ...init });
  if (!r.ok) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}

function isoBR(offsetDays: number) {
  // data de hoje em São Paulo (UTC-3)
  const d = new Date(Date.now() - 3 * 3600 * 1000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const secrets = Object.fromEntries(((await rest("app_secrets?select=name,value")) || []).map((r: any) => [r.name, r.value]));
  if (!secrets.push_cron_secret || req.headers.get("x-cron-secret") !== secrets.push_cron_secret) return new Response("forbidden", { status: 403 });
  webpush.setVapidDetails("mailto:israellga@gmail.com", secrets.vapid_public, secrets.vapid_private);

  const today = isoBR(0), tomorrow = isoBR(1);
  const subs = (await rest("push_subscriptions?select=endpoint,keys,workspace_id")) || [];
  const byWs: Record<string, any[]> = {};
  for (const s of subs) (byWs[s.workspace_id || ""] ||= []).push(s);

  let sent = 0, removed = 0;
  for (const [ws, list] of Object.entries(byWs)) {
    if (!ws) continue;
    const prods = (await rest(`productions?workspace_id=eq.${ws}&select=payload`)) || [];
    const lines: string[] = [];
    for (const { payload: p } of prods) {
      if (!p || p.arquivada) continue;
      const hora = p.horaInicio ? ` às ${p.horaInicio}` : "";
      const local = p.endereco ? ` · ${p.endereco}` : "";
      if (p.data === today) lines.push(`Hoje: ${p.cliente || "produção"}${hora}${local}`);
      else if (p.data === tomorrow) lines.push(`Amanhã: ${p.cliente || "produção"}${hora}`);
      if (p.entrega?.prazo === today && p.entrega?.etapa !== "entregue") lines.push(`Entrega hoje: ${p.cliente || "produção"}`);
    }
    if (!lines.length) continue;
    const payload = JSON.stringify({ title: "Shotlist", body: lines.slice(0, 4).join("\n"), url: "/" });
    for (const s of list) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE" });
          removed++;
        }
      }
    }
  }
  return new Response(JSON.stringify({ sent, removed }), { headers: { "content-type": "application/json" } });
});

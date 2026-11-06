// Recebe os avisos do Asaas e dá baixa automática na parcela.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SH = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };

async function rest(path: string, init?: RequestInit) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SH, ...init });
  if (!r.ok) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}

Deno.serve(async (req) => {
  let body: any;
  try { body = await req.json(); } catch { return new Response("bad", { status: 400 }); }
  const ev = body?.event as string;
  const pay = body?.payment;
  const ref = String(pay?.externalReference || "");
  const [planId, parcelaId] = ref.split(":");
  if (!pay || !planId || !parcelaId) return new Response("ignored", { status: 200 });

  const plan = (await rest(`payment_plans?id=eq.${encodeURIComponent(planId)}&select=parcelas,workspace_id`))?.[0];
  if (!plan) return new Response("ignored", { status: 200 });
  const cfg = (await rest(`workspace_asaas?workspace_id=eq.${encodeURIComponent(plan.workspace_id)}&select=webhook_token`))?.[0];
  const sent = req.headers.get("asaas-access-token");
  if (!cfg || !sent || sent !== cfg.webhook_token) return new Response("forbidden", { status: 403 });
  const paidEvent = ev === "PAYMENT_RECEIVED" || (ev === "PAYMENT_CONFIRMED" && pay.billingType === "CREDIT_CARD");
  const undo = ev === "PAYMENT_REFUNDED";
  if (!paidEvent && !undo) return new Response("ok", { status: 200 });

  const next = (plan.parcelas || []).map((p: any) => {
    if (p.id !== parcelaId) return p;
    if (paidEvent) return { ...p, pago: true, pagoEm: new Date().toISOString(), pagoVia: `asaas:${pay.billingType || ""}` };
    return { ...p, pago: false, pagoEm: null };
  });
  await rest(`payment_plans?id=eq.${encodeURIComponent(planId)}`, {
    method: "PATCH", headers: { ...SH, prefer: "return=minimal" }, body: JSON.stringify({ parcelas: next, updated_at: new Date().toISOString() }),
  });
  return new Response("ok", { status: 200 });
});

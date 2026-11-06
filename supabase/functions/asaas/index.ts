// Cobranças Asaas (Pix, boleto e cartão) para as parcelas do Shotlist. Só gestores do workspace.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SH = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

async function rest(path: string, init?: RequestInit) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SH, ...init });
  if (!r.ok) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}

async function wsConfig(ws: string) {
  return (await rest(`workspace_asaas?workspace_id=eq.${encodeURIComponent(ws)}&select=*`))?.[0] || null;
}

async function asaas(ctx: { key: string; base: string }, path: string, method = "GET", body?: unknown) {
  const r = await fetch(`${ctx.base}${path}`, {
    method,
    headers: { access_token: ctx.key, "content-type": "application/json", "user-agent": "Shotlist" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let data: any = {};
  try { data = t ? JSON.parse(t) : {}; } catch { data = { raw: t }; }
  return { ok: r.ok, status: r.status, data };
}
const errMsg = (d: any) => d?.errors?.[0]?.description || d?.error || "Erro no Asaas";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let input: any;
  try { input = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  const ctx = { key: "", base: "" };
  const useCfg = (cfg: any) => { ctx.key = cfg.api_key; ctx.base = cfg.env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3"; };
  const auth = req.headers.get("authorization") || "";

  async function gestorOf(ws: string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_workspace_gestor`, {
      method: "POST", headers: { apikey: ANON_KEY, authorization: auth, "content-type": "application/json" }, body: JSON.stringify({ ws_id: ws }),
    });
    return r.ok && (await r.json()) === true;
  }

  if (input.action === "setup_webhook") {
    const wsId = input.workspace_id;
    if (!wsId || !(await gestorOf(wsId))) return json({ error: "Sem permissão." }, 403);
    const cfg = await wsConfig(wsId);
    if (!cfg) return json({ error: "Conecte sua conta do Asaas em Minha conta." }, 400);
    useCfg(cfg);
    const token = cfg.webhook_token;
    const url = `${SUPABASE_URL}/functions/v1/asaas-webhook`;
    const r = await asaas(ctx, "/webhooks", "POST", {
      name: "Shotlist", url, email: input.email || undefined, enabled: true, interrupted: false, apiVersion: 3, authToken: token, sendType: "SEQUENTIALLY",
      events: ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED"],
    });
    if (!r.ok) return json({ error: errMsg(r.data) }, 400);
    return json({ ok: true, env: cfg.env });
  }

  if (input.action === "create_charge") {
    const { plan_id, parcela_id } = input;
    const plans = await rest(`payment_plans?id=eq.${encodeURIComponent(plan_id)}&select=*`);
    const plan = plans?.[0];
    if (!plan) return json({ error: "Plano não encontrado." }, 404);
    if (!(await gestorOf(plan.workspace_id))) return json({ error: "Sem permissão." }, 403);
    const cfg = await wsConfig(plan.workspace_id);
    if (!cfg) return json({ error: "Conecte sua conta do Asaas em Minha conta." }, 400);
    useCfg(cfg);
    const parcelas: any[] = plan.parcelas || [];
    const idx = parcelas.findIndex((p) => p.id === parcela_id);
    if (idx < 0) return json({ error: "Parcela não encontrada." }, 404);
    const pc = parcelas[idx];
    if (pc.pago) return json({ error: "Parcela já está paga." }, 400);
    if (!(Number(pc.valor) > 0)) return json({ error: "Informe o valor da parcela." }, 400);
    if (!pc.vencimento) return json({ error: "Informe o vencimento da parcela." }, 400);
    const today = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const due = pc.vencimento < today ? today : pc.vencimento;

    const cl = (await rest(`clients?id=eq.${encodeURIComponent(plan.client_id)}&select=*`))?.[0];
    if (!cl) return json({ error: "Cliente não encontrado." }, 404);
    const doc = (cl.cnpj || "").replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14) return json({ error: "Cadastre o CPF ou CNPJ do cliente para emitir a cobrança." }, 400);

    // cliente no Asaas (reaproveita o id guardado no plano)
    const pagamento = plan.pagamento || {};
    let customer = pagamento.asaasCustomer as string | undefined;
    if (!customer) {
      const found = await asaas(ctx, `/customers?cpfCnpj=${doc}&limit=1`);
      customer = found.data?.data?.[0]?.id;
    }
    if (!customer) {
      const c = await asaas(ctx, "/customers", "POST", {
        name: cl.name || "Cliente", cpfCnpj: doc, email: cl.email || undefined,
        mobilePhone: (cl.phone || "").replace(/\D/g, "") || undefined, postalCode: (cl.cep || "").replace(/\D/g, "") || undefined,
        address: cl.logradouro || undefined, addressNumber: cl.numero || undefined, complement: cl.complemento || undefined, province: cl.bairro || undefined,
        externalReference: cl.id, notificationDisabled: true,
      });
      if (!c.ok) return json({ error: errMsg(c.data) }, 400);
      customer = c.data.id;
    }

    // cobrança (UNDEFINED = cliente escolhe Pix, boleto ou cartão na fatura)
    let chargeId = pc.asaasId as string | undefined;
    let invoiceUrl = pc.asaasUrl as string | undefined;
    if (!chargeId) {
      const ch = await asaas(ctx, "/payments", "POST", {
        customer, billingType: "UNDEFINED", value: Number(pc.valor), dueDate: due,
        description: `${plan.titulo || "Pagamento"} - parcela ${pc.numero}`,
        externalReference: `${plan.id}:${pc.id}`, fine: { value: 2 }, interest: { value: 1 },
      });
      if (!ch.ok) return json({ error: errMsg(ch.data) }, 400);
      chargeId = ch.data.id; invoiceUrl = ch.data.invoiceUrl;
    }

    const pix = await asaas(ctx, `/payments/${chargeId}/pixQrCode`);
    const bol = await asaas(ctx, `/payments/${chargeId}/identificationField`);
    const next = parcelas.map((p, i) => i !== idx ? p : {
      ...p, asaasId: chargeId, asaasUrl: invoiceUrl,
      pixCopia: pix.ok ? pix.data.payload : p.pixCopia,
      boleto: bol.ok && bol.data.identificationField ? bol.data.identificationField : p.boleto,
    });
    await rest(`payment_plans?id=eq.${encodeURIComponent(plan.id)}`, {
      method: "PATCH", headers: { ...SH, prefer: "return=minimal" },
      body: JSON.stringify({ parcelas: next, pagamento: { ...pagamento, asaasCustomer: customer }, updated_at: new Date().toISOString() }),
    });
    return json({ ok: true, invoiceUrl, boleto: !!(bol.ok && bol.data.identificationField), pix: !!pix.ok, env: cfg.env });
  }

  return json({ error: "Ação desconhecida." }, 400);
});

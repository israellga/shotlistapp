// Contratos para assinatura com a conta ZapSign de cada gestor. Só gestores do workspace.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SH = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });
const ZAP = "https://api.zapsign.com.br/api/v1";

async function rest(path: string, init?: RequestInit) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SH, ...init });
  if (!r.ok) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}
const enc = encodeURIComponent;
async function zapCfg(ws: string) { return (await rest(`workspace_zapsign?workspace_id=eq.${enc(ws)}&select=*`))?.[0] || null; }
async function zap(key: string, path: string, method = "GET", body?: unknown) {
  const r = await fetch(`${ZAP}${path}`, { method, headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let data: any = {};
  try { data = t ? JSON.parse(t) : {}; } catch { data = { raw: t }; }
  return { ok: r.ok, status: r.status, data };
}
async function upload(path: string, bytes: Uint8Array) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/contratos/${path}`, {
    method: "POST", headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/pdf", "x-upsert": "true" }, body: bytes,
  });
  return r.ok;
}
const errMsg = (d: any) => d?.detail || d?.error || (typeof d?.raw === "string" ? d.raw.slice(0, 120) : "") || "Erro no ZapSign";
const mapSigners = (arr: any[]) => (arr || []).map((s) => ({ token: s.token, name: s.name, email: s.email || "", phone: [s.phone_country, s.phone_number].filter(Boolean).join(""), status: s.status, signUrl: s.sign_url || (s.token ? `https://app.zapsign.com.br/verificar/${s.token}` : ""), signedAt: s.signed_at || null }));

// Sincroniza um contrato com o estado atual do documento no ZapSign e guarda o PDF assinado.
async function syncContract(c: any, key: string) {
  const r = await zap(key, `/docs/${c.zap_token}/`);
  if (!r.ok) return { ok: false, error: errMsg(r.data) };
  const d = r.data;
  const patch: any = { status: d.status || c.status, signers: mapSigners(d.signers) };
  if (d.status === "signed" && !c.signed_path && d.signed_file) {
    const f = await fetch(d.signed_file);
    if (f.ok) {
      const path = `${c.workspace_id}/${c.id}/assinado.pdf`;
      if (await upload(path, new Uint8Array(await f.arrayBuffer()))) { patch.signed_path = path; patch.signed_at = new Date().toISOString(); }
    }
  }
  await rest(`contracts?id=eq.${enc(c.id)}`, { method: "PATCH", headers: { ...SH, prefer: "return=minimal" }, body: JSON.stringify(patch) });
  return { ok: true, status: patch.status, signed: !!(patch.signed_path || c.signed_path) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let input: any;
  try { input = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  const auth = req.headers.get("authorization") || "";
  async function gestorOf(ws: string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_workspace_gestor`, { method: "POST", headers: { apikey: ANON_KEY, authorization: auth, "content-type": "application/json" }, body: JSON.stringify({ ws_id: ws }) });
    return r.ok && (await r.json()) === true;
  }

  if (input.action === "setup_webhook") {
    const ws = input.workspace_id;
    if (!ws || !(await gestorOf(ws))) return json({ error: "Sem permissão." }, 403);
    const cfg = await zapCfg(ws);
    if (!cfg) return json({ error: "Conecte sua conta do ZapSign em Configurações." }, 400);
    const test = await zap(cfg.api_key, "/docs/?page=1");
    if (!test.ok) return json({ error: "O ZapSign recusou o token. Confira se copiou o token da API completo." }, 400);
    const r = await zap(cfg.api_key, "/user/company/webhook/", "POST", {
      url: `${SUPABASE_URL}/functions/v1/zapsign-webhook`, type: "",
      headers: [{ name: "Authorization", value: cfg.webhook_token }],
    });
    if (!r.ok) return json({ error: errMsg(r.data) }, 400);
    return json({ ok: true });
  }

  if (input.action === "send_contract") {
    const { workspace_id: ws, client_id, production_id, titulo, pdfBase64 } = input;
    if (!ws || !(await gestorOf(ws))) return json({ error: "Sem permissão." }, 403);
    const cfg = await zapCfg(ws);
    if (!cfg) return json({ error: "Conecte sua conta do ZapSign em Configurações." }, 400);
    if (!pdfBase64 || typeof pdfBase64 !== "string") return json({ error: "Envie o PDF do contrato." }, 400);
    const signers = (Array.isArray(input.signers) ? input.signers : []).filter((s: any) => s?.name && (s.email || s.phone));
    if (!signers.length) return json({ error: "Informe ao menos um signatário com e-mail ou celular." }, 400);
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const nome = String(titulo || "Contrato").slice(0, 200);
    const body = {
      name: nome, base64_pdf: pdfBase64, lang: "pt-br", external_id: id,
      signers: signers.map((s: any) => {
        const ph = String(s.phone || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
        return {
          name: String(s.name).slice(0, 100), email: s.email || undefined, auth_mode: "assinaturaTela",
          phone_country: ph ? "55" : undefined, phone_number: ph || undefined,
          send_automatic_email: !!s.email, send_automatic_whatsapp: !!(ph && s.whatsapp),
        };
      }),
    };
    const r = await zap(cfg.api_key, "/docs/", "POST", body);
    if (!r.ok) return json({ error: errMsg(r.data) }, 400);
    let original_path: string | null = `${ws}/${id}/original.pdf`;
    try {
      const bin = Uint8Array.from(atob(pdfBase64), (ch) => ch.charCodeAt(0));
      if (!(await upload(original_path, bin))) original_path = null;
    } catch { original_path = null; }
    await rest("contracts", {
      method: "POST", headers: { ...SH, prefer: "return=minimal" },
      body: JSON.stringify({ id, workspace_id: ws, client_id: client_id || null, production_id: production_id || null, titulo: nome, zap_token: r.data.token, status: r.data.status || "pending", signers: mapSigners(r.data.signers), original_path }),
    });
    return json({ ok: true, id });
  }

  if (input.action === "refresh") {
    const c = (await rest(`contracts?id=eq.${enc(input.contract_id)}&select=*`))?.[0];
    if (!c) return json({ error: "Contrato não encontrado." }, 404);
    if (!(await gestorOf(c.workspace_id))) return json({ error: "Sem permissão." }, 403);
    const cfg = await zapCfg(c.workspace_id);
    if (!cfg) return json({ error: "Conecte sua conta do ZapSign em Configurações." }, 400);
    const r = await syncContract(c, cfg.api_key);
    if (!r.ok) return json({ error: r.error }, 400);
    return json(r);
  }

  return json({ error: "Ação desconhecida." }, 400);
});

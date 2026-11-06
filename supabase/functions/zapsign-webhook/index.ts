// Recebe os avisos do ZapSign e atualiza o contrato (status, signatários e PDF assinado).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SH = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
const enc = encodeURIComponent;
async function rest(path: string, init?: RequestInit) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SH, ...init });
  if (!r.ok) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}
const mapSigners = (arr: any[]) => (arr || []).map((s) => ({ token: s.token, name: s.name, email: s.email || "", phone: [s.phone_country, s.phone_number].filter(Boolean).join(""), status: s.status, signUrl: s.sign_url || (s.token ? `https://app.zapsign.com.br/verificar/${s.token}` : ""), signedAt: s.signed_at || null }));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  let ev: any;
  try { ev = await req.json(); } catch { return new Response("bad", { status: 400 }); }
  const token = ev?.token || ev?.doc?.token;
  if (!token) return new Response("ok");
  const c = (await rest(`contracts?zap_token=eq.${enc(token)}&select=*`))?.[0];
  if (!c) return new Response("ok");
  const cfg = (await rest(`workspace_zapsign?workspace_id=eq.${enc(c.workspace_id)}&select=*`))?.[0];
  if (!cfg || (req.headers.get("authorization") || "") !== cfg.webhook_token) return new Response("unauthorized", { status: 401 });

  // consulta o estado real (o evento sozinho não diz se todos já assinaram)
  const r = await fetch(`https://api.zapsign.com.br/api/v1/docs/${token}/`, { headers: { Authorization: `Bearer ${cfg.api_key}` } });
  if (!r.ok) return new Response("ok");
  const d = await r.json();
  const patch: any = { status: d.status || c.status, signers: mapSigners(d.signers) };
  if (d.status === "signed" && !c.signed_path && d.signed_file) {
    const f = await fetch(d.signed_file);
    if (f.ok) {
      const path = `${c.workspace_id}/${c.id}/assinado.pdf`;
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/contratos/${path}`, {
        method: "POST", headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/pdf", "x-upsert": "true" }, body: new Uint8Array(await f.arrayBuffer()),
      });
      if (up.ok) { patch.signed_path = path; patch.signed_at = new Date().toISOString(); }
    }
  }
  await rest(`contracts?id=eq.${enc(c.id)}`, { method: "PATCH", headers: { ...SH, prefer: "return=minimal" }, body: JSON.stringify(patch) });
  return new Response("ok");
});

// Public ICS feed (subscribe from Google Calendar / Apple Calendar). Access by unguessable token.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function rest(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` } });
  if (!r.ok) return null;
  return await r.json();
}

const esc = (t: string) => String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const d8 = (iso: string) => iso.replace(/-/g, "");
function nextDay(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("t") || "";
  if (token.length < 32) return new Response("Not found", { status: 404 });
  const ws = await rest(`workspaces?calendar_token=eq.${encodeURIComponent(token)}&select=id,name`);
  if (!ws?.[0]) return new Response("Not found", { status: 404 });
  const prods = (await rest(`productions?workspace_id=eq.${ws[0].id}&select=id,payload`)) || [];

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Shotlist//PT-BR//", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc("Shotlist · " + ws[0].name)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
  for (const row of prods) {
    const p = row.payload || {};
    if (!p.data || p.arquivada) continue;
    const end = p.dataFim && p.dataFim >= p.data ? p.dataFim : p.data;
    const desc = [p.objetivoDia && `Demanda: ${p.objetivoDia}`, (p.horaInicio || p.horaFim) && `Horário: ${p.horaInicio || "?"}–${p.horaFim || "?"}`, p.responsavel && `Responsável: ${p.responsavel}`, `${(p.shots || []).length} shots`].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:${row.id}@shotlist`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${d8(p.data)}`, `DTEND;VALUE=DATE:${nextDay(end)}`, `SUMMARY:${esc("Produção: " + (p.cliente || "Sem nome"))}`,
      `DESCRIPTION:${esc(desc)}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "max-age=900" } });
});

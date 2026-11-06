// Lê um PDF de briefing/shotlist e devolve os campos de uma produção do Shotlist.
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODELS = ["claude-sonnet-5-5", "claude-sonnet-4-5", "claude-haiku-4-5-20251001"];

const EQUIPAMENTOS_PADRAO = ["Câmera", "Tripé de câmera", "LED", "Tripé de luz", "Microfone", "Softbox", "Panela", "Rebatedor", "Gimbal", "Slider", "Drone"];
const FUNCOES = ["Diretor(a)", "Produtor(a)", "Roteiro", "Ator/Atriz", "Fotógrafo(a)", "Assistente de câmera", "Assistente de set", "Videomaker", "Storymaker", "Editor(a)", "Gaffer", "Maquiagem", "Som/Áudio", "Motorista", "Catering"];

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const PROMPT = `Você lê um documento (PDF) de produção audiovisual ou fotográfica — briefing, shotlist, roteiro, decupagem ou pedido — e extrai os dados para preencher um app de produção.

Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON) neste formato exato:
{
  "cliente": "nome do cliente/marca/local do trabalho",
  "responsavel": "pessoa responsável pelo lado do cliente, se houver, senão vazio",
  "data": "YYYY-MM-DD ou vazio se não houver data definida",
  "dataFim": "YYYY-MM-DD ou vazio",
  "horaInicio": "HH:MM ou vazio",
  "horaFim": "HH:MM ou vazio",
  "objetivoDia": "demanda/objetivo do trabalho em 1 ou 2 frases",
  "equipe": [{ "funcao": "uma destas quando fizer sentido: ${FUNCOES.join(", ")} (senão, o nome da função como está no documento)", "responsavel": "nome da pessoa, ou vazio" }],
  "shots": [{
    "nome": "nome do item/prato/cena",
    "contexto": "grupo, bloco ou categoria do item, se houver",
    "tipo": "Foto" | "Reels" | "Curta" | "Stopmotion" | "",
    "objetivo": "observação ou descrição do item, se houver",
    "referencia": "link de referência, se houver, senão vazio",
    "horario": "HH:MM em que o item está programado, ou vazio",
    "equipamentos": [somente itens desta lista: ${EQUIPAMENTOS_PADRAO.join(", ")}],
    "takes": [{ "acao": "ação do take, SOMENTE se o documento descrever takes", "transicao": "" }]
  }],
  "orcamento": número em reais se o documento trouxer um valor total, senão null,
  "avisos": ["pendências, dúvidas ou alertas que o documento menciona e que a pessoa precisa resolver"]
}

Regras:
- Um item de "shots" por item fotografado/filmado, na ordem do documento. Se o documento agrupa itens num mesmo horário (ex.: "9 a 11 às 15h20"), cada item recebe esse horário.
- NÃO invente nada que o documento não diga. Campo ausente = string vazia, lista vazia ou null.
- Se o documento é do tipo "Foto" (pratos, drinks, produtos), use tipo "Foto". Se não der pra saber, deixe vazio.
- Datas: se o documento diz que a data ainda será definida, deixe vazio.
- Textos em português, como no documento.`;

async function callModel(model: string, pdfBase64: string) {
  return await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 12000,
      messages: [{ role: "user", content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
        { type: "text", text: PROMPT },
      ] }],
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY não configurada nas secrets da function." }, 500);
  try {
    const { pdfBase64 } = await req.json();
    if (!pdfBase64 || typeof pdfBase64 !== "string") return json({ error: "Nenhum PDF recebido." }, 400);
    if (pdfBase64.length > 9_000_000) return json({ error: "PDF grande demais (limite de uns 6 MB)." }, 400);

    let res: Response | null = null;
    let data: any = null;
    let lastErr = "";
    for (const model of MODELS) {
      res = await callModel(model, pdfBase64);
      data = await res.json();
      if (res.ok) break;
      lastErr = data?.error?.message || `Erro ${res.status}`;
      // modelo indisponível: tenta o próximo; outros erros: para
      if (!/model|not_found|not found/i.test(lastErr)) break;
    }
    if (!res || !res.ok) return json({ error: lastErr || "Erro na API da Anthropic." }, 502);

    const text = data?.content?.find((c: any) => c.type === "text")?.text || "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch { return json({ error: "Não consegui interpretar a resposta da análise." }, 502); }

    parsed.shots = Array.isArray(parsed.shots) ? parsed.shots.slice(0, 200) : [];
    for (const s of parsed.shots) {
      if (Array.isArray(s.equipamentos)) s.equipamentos = s.equipamentos.filter((e: string) => EQUIPAMENTOS_PADRAO.includes(e));
    }
    return json({ data: parsed });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});

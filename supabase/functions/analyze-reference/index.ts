// Deploy with: supabase functions deploy analyze-reference
// Requires the secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-haiku-4-5-20251001";

const EQUIPAMENTOS_PADRAO = [
  "Câmera", "Tripé de câmera", "LED", "Tripé de luz", "Microfone",
  "Softbox", "Panela", "Rebatedor", "Gimbal", "Slider", "Drone",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não consegui baixar a imagem da referência (${res.status}).`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), mediaType: contentType.split(";")[0] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY não configurada nas secrets da function." }, 500);
  }

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl || typeof imageUrl !== "string") {
      return jsonResponse({ error: "Nenhuma imagem de referência recebida." }, 400);
    }

    let image;
    try {
      image = await fetchImageAsBase64(imageUrl);
    } catch (e) {
      return jsonResponse({ error: e?.message || "Não consegui baixar a miniatura." }, 502);
    }

    const promptText = `Você é um assistente de produção audiovisual. Esta imagem é a capa/miniatura de um conteúdo de referência (post, reels ou vídeo). Com base só no que você vê nessa imagem, sugira uma estrutura de shot pra recriar algo no mesmo estilo.

Responda em português, APENAS com um JSON válido (sem markdown, sem texto fora do JSON), neste formato exato:
{
  "tipo": "Foto" | "Reels" | "Curta" | "Stopmotion",
  "equipamentos": [lista escolhida apenas dentre: ${EQUIPAMENTOS_PADRAO.join(", ")}],
  "roteiro": "descrição de como a cena parece se desenrolar, com base no que dá pra ver",
  "takes": [{ "acao": "descrição plausível de um take pra reproduzir esse estilo", "transicao": "efeito/transição, ou string vazia" }]
}

Se não der pra inferir algo com confiança a partir de uma única imagem estática, deixe o campo vazio ou a lista vazia — não invente detalhes que não dá pra ver.`;

    const content = [
      { type: "text", text: promptText },
      { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
    ];

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content }],
      }),
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      return jsonResponse({ error: data?.error?.message || "Erro na API da Anthropic." }, 500);
    }

    const text = data?.content?.[0]?.text || "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return jsonResponse({ error: "Não consegui interpretar a resposta da análise." }, 500);
    }

    if (Array.isArray(parsed.equipamentos)) {
      parsed.equipamentos = parsed.equipamentos.filter((e) => EQUIPAMENTOS_PADRAO.includes(e));
    }

    return jsonResponse({ data: parsed });
  } catch (e) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});

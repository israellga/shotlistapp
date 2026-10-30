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
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; ShotlistBot/1.0)", accept: "image/*,*/*" } });
  if (!res.ok) throw new Error(`Não consegui baixar a imagem da referência (${res.status}).`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), mediaType: contentType.split(";")[0] };
}

function youtubeId(url: string) {
  const m =
    url.match(/youtu\.be\/([\w-]{11})/i) ||
    url.match(/youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)([\w-]{11})/i);
  return m ? m[1] : null;
}

async function getJson(url: string) {
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Reúne metadados (título, autor, descrição) e quadros extras do vídeo, quando a plataforma permite.
async function gatherContext(referenceUrl: string, thumbUrl: string) {
  const imageUrls: string[] = [thumbUrl];
  const notes: string[] = [];
  const ref = (referenceUrl || "").trim();
  if (!ref) return { imageUrls, notes };

  const yt = youtubeId(ref);
  if (yt) {
    // O YouTube expõe 3 quadros do vídeo (aprox. 25%, 50% e 75%)
    imageUrls[0] = `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
    for (const n of [1, 2, 3]) imageUrls.push(`https://img.youtube.com/vi/${yt}/${n}.jpg`);
    const o = await getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(ref)}&format=json`);
    if (o?.title) notes.push(`Título: ${o.title}`);
    if (o?.author_name) notes.push(`Canal: ${o.author_name}`);
    return { imageUrls, notes };
  }
  if (/vimeo\.com/i.test(ref)) {
    const o = await getJson(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(ref)}`);
    if (o?.title) notes.push(`Título: ${o.title}`);
    if (o?.author_name) notes.push(`Autor: ${o.author_name}`);
    if (o?.description) notes.push(`Descrição: ${String(o.description).slice(0, 500)}`);
    if (o?.duration) notes.push(`Duração: ${o.duration}s`);
    return { imageUrls, notes };
  }
  if (/tiktok\.com/i.test(ref)) {
    const o = await getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(ref)}`);
    if (o?.title) notes.push(`Legenda: ${o.title}`);
    if (o?.author_name) notes.push(`Autor: ${o.author_name}`);
    return { imageUrls, notes };
  }
  // Outras plataformas: tenta título/descrição via microlink
  const m = await getJson(`https://api.microlink.io/?url=${encodeURIComponent(ref)}&meta=true`);
  if (m?.data?.title) notes.push(`Título: ${m.data.title}`);
  if (m?.data?.description) notes.push(`Descrição: ${String(m.data.description).slice(0, 500)}`);
  return { imageUrls, notes };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY não configurada nas secrets da function." }, 500);
  }

  try {
    const { imageUrl, referenceUrl } = await req.json();
    if (!imageUrl || typeof imageUrl !== "string") {
      return jsonResponse({ error: "Nenhuma imagem de referência recebida." }, 400);
    }

    const ctx = await gatherContext(referenceUrl || "", imageUrl);
    const images: { base64: string; mediaType: string }[] = [];
    let lastError = "";
    for (let i = 0; i < ctx.imageUrls.length; i++) {
      try {
        const img = await fetchImageAsBase64(ctx.imageUrls[i]);
        if (img.mediaType.startsWith("image/")) images.push(img);
      } catch (e) {
        lastError = e?.message || String(e);
        // se uma imagem falhar, segue com as outras
      }
    }
    if (images.length === 0) return jsonResponse({ error: lastError || "Não consegui baixar a miniatura." }, 200);

    const promptText = `Você é um assistente de produção audiovisual. ${images.length > 1 ? "Estas imagens são a capa e quadros ao longo de um vídeo de referência (YouTube, Vimeo ou outra plataforma)." : "Esta imagem é a capa/miniatura de um conteúdo de referência (post, reels ou vídeo)."} ${ctx.notes.length ? "Informações do conteúdo:\n" + ctx.notes.join("\n") + "\n" : ""}Com base no que você vê e nessas informações, sugira uma estrutura de shot pra recriar algo no mesmo estilo.

Responda em português, APENAS com um JSON válido (sem markdown, sem texto fora do JSON), neste formato exato:
{
  "tipo": "Foto" | "Reels" | "Curta" | "Stopmotion",
  "equipamentos": [lista escolhida apenas dentre: ${EQUIPAMENTOS_PADRAO.join(", ")}],
  "roteiro": "descrição de como a cena parece se desenrolar, com base no que dá pra ver",
  "takes": [{ "acao": "descrição plausível de um take pra reproduzir esse estilo", "transicao": "efeito/transição, ou string vazia" }]
}

Se não der pra inferir algo com confiança a partir do material disponível, deixe o campo vazio ou a lista vazia — não invente detalhes que não dá pra ver.`;

    const content = [
      { type: "text", text: promptText },
      ...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } })),
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

import { getYouTubeId, getVimeoId } from "./referenceLinks";
import { supabase } from "./supabaseClient";

let lastIssue = "";
export function getLastThumbnailIssue() { return lastIssue; }

// Instagram via servidor (Edge Function): várias tentativas, sem depender do limite do microlink
async function fetchViaServer(url) {
  try {
    const { data } = await supabase.functions.invoke("analyze-reference", { body: { thumbnailFor: url } });
    if (!data?.thumbnailUrl && Array.isArray(data?.debug)) lastIssue = `Instagram não entregou a imagem (${data.debug.join(" · ")})`;
    return data?.thumbnailUrl || null;
  } catch (e) {
    lastIssue = `Falha ao falar com o servidor: ${e?.message || e}`;
    return null;
  }
}

export async function fetchThumbnail(url) {
  lastIssue = "";
  if (!url || !/^https?:\/\//i.test(url.trim())) return null;
  const clean = url.trim();
  const isInstagram = /instagram\.com/i.test(clean);

  // YouTube: miniatura direta, sem depender de terceiros
  const ytId = getYouTubeId(clean);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

  // Vimeo: oEmbed oficial
  if (getVimeoId(clean)) {
    const t = await fetchOEmbedThumb(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(clean)}`);
    if (t) return t;
  }

  // TikTok: oEmbed oficial
  if (/tiktok\.com/i.test(clean)) {
    const t = await fetchOEmbedThumb(`https://www.tiktok.com/oembed?url=${encodeURIComponent(clean)}`);
    if (t) return t;
  }

  if (isInstagram) {
    const viaServer = await fetchViaServer(clean);
    if (viaServer) { lastIssue = ""; return viaServer; }
    // último recurso: microlink direto do navegador
    try {
      const params = new URLSearchParams({
        url: clean,
        meta: "false",
        "data.thumb.selector": 'meta[property="og:image"]',
        "data.thumb.attr": "content",
        "data.thumb.type": "image",
      });
      const res = await fetch(`https://api.microlink.io/?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const thumbUrl = json?.data?.thumb?.url || json?.data?.thumb;
        if (thumbUrl && typeof thumbUrl === "string") { lastIssue = ""; return thumbUrl; }
      }
    } catch { /* ignore */ }
    return null;
  }

  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(clean)}&meta=false`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.image?.url || json?.data?.screenshot?.url || null;
  } catch {
    return null;
  }
}

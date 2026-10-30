import { getYouTubeId, getVimeoId } from "./referenceLinks";
import { supabase } from "./supabaseClient";

let lastIssue = "";
export function getLastThumbnailIssue() { return lastIssue; }

// Fallback via servidor (Edge Function): lê a página de embed do Instagram
async function fetchViaServer(url) {
  try {
    const { data } = await supabase.functions.invoke("analyze-reference", { body: { thumbnailFor: url } });
    return data?.thumbnailUrl || null;
  } catch {
    return null;
  }
}

async function fetchOEmbedThumb(endpoint) {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.thumbnail_url || null;
  } catch {
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
    // Instagram's default metadata often isn't picked up by generic scraping;
    // microlink's own documented recipe targets the og:image tag directly.
    try {
      const params = new URLSearchParams({
        url: clean,
        meta: "false",
        "data.thumb.selector": 'meta[property="og:image"]',
        "data.thumb.attr": "content",
        "data.thumb.type": "image",
      });
      const res = await fetch(`https://api.microlink.io/?${params.toString()}`);
      if (res.status === 429) lastIssue = "Limite diário do serviço de miniaturas atingido. Tente de novo mais tarde.";
      if (res.ok) {
        const json = await res.json();
        const thumbUrl = json?.data?.thumb?.url || json?.data?.thumb;
        if (thumbUrl && typeof thumbUrl === "string") return thumbUrl;
      }
    } catch {
      /* fall through to generic attempt below */
    }
    const viaServer = await fetchViaServer(clean);
    if (viaServer) { lastIssue = ""; return viaServer; }
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

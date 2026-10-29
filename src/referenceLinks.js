// Detecção de plataformas de link de referência (YouTube, Vimeo, TikTok, Instagram...)

export function getYouTubeId(url) {
  const u = (url || "").trim();
  const m =
    u.match(/youtu\.be\/([\w-]{11})/i) ||
    u.match(/youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)([\w-]{11})/i);
  return m ? m[1] : null;
}

export function getVimeoId(url) {
  const m = (url || "").match(/vimeo\.com\/(?:.*\/)?(\d{6,})/i);
  return m ? m[1] : null;
}

export function detectPlatform(url) {
  const u = url || "";
  if (getYouTubeId(u)) return "youtube";
  if (getVimeoId(u)) return "vimeo";
  if (/instagram\.com/i.test(u)) return "instagram";
  if (/tiktok\.com/i.test(u)) return "tiktok";
  return "other";
}

// URL de player incorporável (iframe) quando a plataforma permite
export function getEmbedUrl(url) {
  const yt = getYouTubeId(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?rel=0&playsinline=1`;
  const vm = getVimeoId(url);
  if (vm) return `https://player.vimeo.com/video/${vm}?dnt=1`;
  return null;
}

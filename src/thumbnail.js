export async function fetchThumbnail(url) {
  if (!url || !/^https?:\/\//i.test(url.trim())) return null;
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url.trim())}&meta=false`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.image?.url || json?.data?.screenshot?.url || null;
  } catch {
    return null;
  }
}

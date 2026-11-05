function pad(n, w = 2) { return String(n).padStart(w, "0"); }
function ts(ms) {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), r = Math.floor(ms % 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(r, 3)}`;
}
export function cuesToSrt(cues) {
  return (cues || []).map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n");
}
export function shortTime(ms) {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${pad(m)}:${pad(s)}`;
}
export function downloadSrt(cues, name = "legenda") {
  const blob = new Blob([cuesToSrt(cues)], { type: "application/x-subrip;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(name || "legenda").replace(/[^\w\-]+/g, "_")}.srt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

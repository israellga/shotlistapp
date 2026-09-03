const PREFIX = "shotlist-draft:";
const INDEX_PREFIX = "shotlist-draft-index:";

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage full or unavailable */ }
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function getDraftIndex(kind) {
  const raw = safeGet(INDEX_PREFIX + kind);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function setDraftIndex(kind, ids) {
  safeSet(INDEX_PREFIX + kind, JSON.stringify(ids));
}

export function saveDraft(kind, id, data) {
  safeSet(PREFIX + kind + ":" + id, JSON.stringify(data));
  const idx = getDraftIndex(kind);
  if (!idx.includes(id)) setDraftIndex(kind, [...idx, id]);
}

export function loadDraft(kind, id) {
  const raw = safeGet(PREFIX + kind + ":" + id);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function clearDraft(kind, id) {
  safeRemove(PREFIX + kind + ":" + id);
  const idx = getDraftIndex(kind);
  const next = idx.filter((x) => x !== id);
  if (next.length !== idx.length) setDraftIndex(kind, next);
}

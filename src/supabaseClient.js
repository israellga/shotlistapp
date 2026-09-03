import { createClient } from "@supabase/supabase-js";

const KEY = "producao-app:supabase-config";

export function getSupabaseConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSupabaseConfig(url, anonKey) {
  localStorage.setItem(KEY, JSON.stringify({ url, anonKey }));
}

export function clearSupabaseConfig() {
  localStorage.removeItem(KEY);
}

export function makeClient() {
  const cfg = getSupabaseConfig();
  if (!cfg || !cfg.url || !cfg.anonKey) return null;
  try {
    return createClient(cfg.url, cfg.anonKey);
  } catch {
    return null;
  }
}

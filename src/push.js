import { supabase } from "./supabaseClient";

// Chave pública VAPID (a privada fica só no servidor).
const VAPID_PUBLIC = "BGOLwiN8_eiXbCnoc92dITb4DEECRb0nLfS3xP_fkOcGK5OQF-fs7fNEj0Xkvarf6aseDLO5KrF6hnjNAh-uMck";

function b64ToUint8(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function pushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch { return "off"; }
}

export async function enablePush(workspaceId) {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC) });
  const json = sub.toJSON();
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return false;
  const { error } = await supabase.from("push_subscriptions").upsert({ endpoint: json.endpoint, user_id: u.user.id, workspace_id: workspaceId || null, keys: json.keys });
  return !error;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

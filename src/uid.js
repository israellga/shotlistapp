// Ids imprevisíveis (links públicos dependem deles). Math.random é previsível; crypto não.
export function uid(len = 16) {
  const a = new Uint8Array(len);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  return Array.from(a, (b) => (b % 36).toString(36)).join("");
}

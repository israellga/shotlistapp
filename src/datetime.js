export function formatDataComDiaSemana(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return iso;
  const dia = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const semana = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${dia} · ${semana}`;
}

export function parseHorario(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (!digits) return null;
  let h, m;
  if (digits.length <= 2) {
    h = parseInt(digits, 10);
    m = 0;
  } else if (digits.length === 3) {
    h = parseInt(digits.slice(0, 1), 10);
    m = parseInt(digits.slice(1), 10);
  } else {
    h = parseInt(digits.slice(0, digits.length - 2), 10);
    m = parseInt(digits.slice(-2), 10);
  }
  if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return null;
  return { h, m };
}

export function formatHorario(raw) {
  const parsed = parseHorario(raw);
  if (!parsed) return raw;
  return parsed.m === 0 ? `${parsed.h}h` : `${parsed.h}h${String(parsed.m).padStart(2, "0")}`;
}

export function horarioMinutos(raw) {
  const parsed = parseHorario(raw);
  if (!parsed) return 9999;
  return parsed.h * 60 + parsed.m;
}

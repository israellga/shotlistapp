// Status de uma produção, derivado dos status dos shots.
// A FAZER: sem shots ou nenhum iniciado · EM ANDAMENTO: ao menos um iniciado/concluído, mas nem todos concluídos · CONCLUÍDO: todos concluídos
export const PRODUCTION_STATUS = [
  { key: "afazer", label: "A FAZER" },
  { key: "andamento", label: "EM ANDAMENTO" },
  { key: "concluido", label: "CONCLUÍDO" },
];

export function productionStatus(p) {
  const shots = p?.shots || [];
  if (shots.length === 0) return "afazer";
  const done = shots.filter((s) => s.status === "concluido").length;
  if (done === shots.length) return "concluido";
  const started = shots.some((s) => s.status === "andamento" || s.status === "concluido");
  return started ? "andamento" : "afazer";
}

import { supabase } from "./supabaseClient";

export async function analyzeReferenceFrames(imageUrl, referenceUrl) {
  const { data, error } = await supabase.functions.invoke("analyze-reference", {
    body: { imageUrl, referenceUrl },
  });
  if (error) {
    // supabase-js esconde o corpo da resposta em erros não-2xx; tenta ler a mensagem real
    let detail = "";
    try {
      const body = await error.context?.json?.();
      detail = body?.error || "";
    } catch { /* ignore */ }
    throw new Error(detail || error.message || "Falha ao chamar a análise.");
  }
  if (data?.error) throw new Error(data.error);
  return data?.data;
}

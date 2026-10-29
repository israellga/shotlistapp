import { supabase } from "./supabaseClient";

export async function analyzeReferenceFrames(imageUrl, referenceUrl) {
  const { data, error } = await supabase.functions.invoke("analyze-reference", {
    body: { imageUrl, referenceUrl },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.data;
}

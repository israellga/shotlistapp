export function maskPhone(raw) {
  let v = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (v.length > 10) {
    v = v.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
  } else if (v.length > 6) {
    v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
  } else if (v.length > 2) {
    v = v.replace(/^(\d{2})(\d{0,4}).*/, "($1) $2");
  } else if (v.length > 0) {
    v = v.replace(/^(\d*)/, "($1");
  }
  return v;
}

export function maskCEP(raw) {
  let v = (raw || "").replace(/\D/g, "").slice(0, 8);
  if (v.length > 5) v = v.replace(/^(\d{5})(\d{0,3}).*/, "$1-$2");
  return v;
}

export function maskCNPJ(raw) {
  let v = (raw || "").replace(/\D/g, "").slice(0, 14);
  v = v.replace(/^(\d{2})(\d)/, "$1.$2");
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
  v = v.replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4");
  v = v.replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
  return v;
}

export async function lookupCEP(cep) {
  const digits = (cep || "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro || "",
      bairro: data.bairro || "",
      cidade: data.localidade || "",
      estado: data.uf || "",
    };
  } catch {
    return null;
  }
}

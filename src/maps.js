// Links de mapa a partir de um endereço em texto (sem precisar de chave de API).
export const mapsUrl = (addr) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr || "")}`;
export const wazeUrl = (addr) => `https://waze.com/ul?q=${encodeURIComponent(addr || "")}&navigate=yes`;

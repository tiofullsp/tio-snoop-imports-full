export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

// "YYYY-MM-DD" strings from the DB/form must be parsed as LOCAL dates.
// new Date("YYYY-MM-DD") treats them as UTC midnight, which shifts the displayed
// day by the UTC offset (e.g. UTC-3 turns June 17 → June 16 21:00 local).
function parseLocalDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d); // local midnight
  }
  return new Date(s);
}

export const formatDate = (dateString: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseLocalDate(dateString));

export const formatDateShort = (dateString: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseLocalDate(dateString));

export const formatDateTime = (dateString: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));

export const formatTime = (dateString: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(dateString));

export const formatDateTimeSeconds = (dateString: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(dateString));

export const formatPhone = (phone: string): string => phone;

export const formatCep = (cep: string): string => {
  const clean = cep.replace(/\D/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return cep;
};

export const formatCpf = (cpf: string): string => {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
  }
  return cpf;
};

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("pt-BR").format(value);

export const formatPercent = (value: number): string =>
  `${value}%`;

export const formatWeight = (kg: number): string =>
  kg < 1 ? `${(kg * 1000).toFixed(0)}g` : `${kg.toFixed(2).replace(".", ",")}kg`;

export const relativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  if (hours < 24) return `há ${hours}h`;
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return formatDateShort(dateString);
};

export const BRAZIL_STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export const formatStateName = (uf: string): string => BRAZIL_STATE_NAMES[uf.toUpperCase()] ?? uf;

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Normaliza qualquer link de vídeo do YouTube (watch, youtu.be, shorts) para o
// formato embed exigido pelo iframe da galeria de produto e dos feedbacks.
export const toYoutubeEmbedUrl = (rawUrl: string): string => {
  const url = rawUrl.trim();
  if (!url) return url;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    let videoId: string | null = null;
    if (host === "youtu.be") {
      videoId = parsed.pathname.slice(1);
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v");
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/")[2];
      } else if (parsed.pathname.startsWith("/embed/")) {
        return url; // já está no formato correto
      }
    }

    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  } catch {
    return url;
  }
};

// Extrai o ID do vídeo de uma URL de embed do YouTube (para gerar thumbnail).
export const extractYoutubeId = (embedUrl: string): string | null => {
  const match = embedUrl.match(/\/embed\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

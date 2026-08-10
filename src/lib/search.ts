import type { Product } from "@/types";

// Normaliza pra comparação "tolerante": tira acento, deixa minúsculo e remove
// tudo que não for letra/número — assim "T.G", "T G" e "tg" viram a mesma
// coisa ("tg"), sem o cliente precisar acertar pontuação/maiúsculas.
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Mesma normalização de acento/caixa, mas preservando as palavras separadas
// (troca pontuação por espaço em vez de remover) — precisa disso pra quebrar
// em palavras individuais antes de comparar.
function normalizeSearchWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Cada PALAVRA do que foi digitado precisa aparecer em algum lugar do
// produto (nome, descrição curta ou SKU) — não precisa estar na ordem
// digitada nem ser contíguo. Por isso "GHK BIO" acha "GHK-CU (BIONEXIS)":
// "ghk" e "bio" aparecem separados no nome, mas os dois aparecem. Buscar a
// query inteira como um bloco só (como era antes) falhava exatamente nesse
// tipo de caso — só achava quando o texto digitado batia letra por letra
// numa sequência contínua do nome.
export function productMatchesQuery(product: Product, query: string): boolean {
  const words = normalizeSearchWords(query);
  if (words.length === 0) return false;

  const haystack = normalizeSearchText(
    `${product.name} ${product.short_description ?? ""} ${product.sku}`
  );

  return words.every((word) => haystack.includes(word));
}

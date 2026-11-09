// Keep short IT terms (VPN, IP, PC) while ignoring common request wording.
const STOP_WORDS = new Set(
  'bi cac can cho co cua da dang de den duoc gi giup ho khi khong la lam loi mot nay nhung the thi toi tro trong tu va ve voi xin yeu cau a an and are cannot can for how is it not of on the to with'.split(
    ' ',
  ),
);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function extractKnowledgeKeywords(text: string): string[] {
  return [...new Set(words(text))]
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word))
    .slice(0, 8);
}

export function scoreKnowledgeSuggestion(
  article: { title: string; tags: string | null; summary: string | null },
  keywords: string[],
): number {
  const title = new Set(words(article.title));
  const tags = new Set(words(article.tags ?? ''));
  const summary = new Set(words(article.summary ?? ''));
  return keywords.reduce(
    (score, keyword) =>
      score +
      (title.has(keyword) ? 3 : 0) +
      (tags.has(keyword) ? 4 : 0) +
      (summary.has(keyword) ? 1 : 0),
    0,
  );
}

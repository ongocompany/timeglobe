function summaryUrl(lang, title) {
  return `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
}

async function fetchSummary(lang, title) {
  const response = await fetch(summaryUrl(lang, title), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const data = await response.json();
  return {
    summary: data.extract || null,
    imageUrl: data.thumbnail?.source || null,
  };
}

export async function enrichWithWikipedia(sourceMeta) {
  const koTitle = sourceMeta.ko_wiki_title;
  const enTitle = sourceMeta.en_wiki_title;

  const ko = koTitle ? await fetchSummary("ko", koTitle) : null;
  const en = enTitle ? await fetchSummary("en", enTitle) : null;

  const summaryKo = ko?.summary ?? null;
  const summaryEn = en?.summary ?? null;
  const imageUrl = ko?.imageUrl ?? en?.imageUrl ?? null;

  if (!summaryKo && !summaryEn && !imageUrl) return null;

  return {
    summary: {
      ko: summaryKo ?? summaryEn ?? "",
      en: summaryEn ?? summaryKo ?? "",
    },
    image_url: imageUrl,
  };
}

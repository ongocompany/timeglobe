function validateSourceLang(sourceLang) {
  if (!["ko", "en", "both"].includes(sourceLang)) {
    throw new Error(`Invalid --source-lang: ${sourceLang}`);
  }
}

export function buildPersonCandidateSeedBlock(sourceLang) {
  validateSourceLang(sourceLang);

  if (sourceLang === "ko") {
    return `
      ?koWiki schema:isPartOf <https://ko.wikipedia.org/> ;
              schema:about ?item ;
              schema:name ?koWikiTitle .
      OPTIONAL {
        ?enWiki schema:isPartOf <https://en.wikipedia.org/> ;
                schema:about ?item ;
                schema:name ?enWikiTitle .
      }
    `;
  }

  if (sourceLang === "en") {
    return `
      ?enWiki schema:isPartOf <https://en.wikipedia.org/> ;
              schema:about ?item ;
              schema:name ?enWikiTitle .
      OPTIONAL {
        ?koWiki schema:isPartOf <https://ko.wikipedia.org/> ;
                schema:about ?item ;
                schema:name ?koWikiTitle .
      }
    `;
  }

  return `
    {
      ?koWiki schema:isPartOf <https://ko.wikipedia.org/> ;
              schema:about ?item ;
              schema:name ?koWikiTitle .
      OPTIONAL {
        ?enWiki schema:isPartOf <https://en.wikipedia.org/> ;
                schema:about ?item ;
                schema:name ?enWikiTitle .
      }
    }
    UNION
    {
      ?enWiki schema:isPartOf <https://en.wikipedia.org/> ;
              schema:about ?item ;
              schema:name ?enWikiTitle .
      OPTIONAL {
        ?koWiki schema:isPartOf <https://ko.wikipedia.org/> ;
                schema:about ?item ;
                schema:name ?koWikiTitle .
      }
    }
  `;
}

export function buildPersonCandidateQuery(options) {
  const {
    limit,
    offset,
    minSitelinks,
    maxSitelinks,
    sourceLang,
  } = options;
  validateSourceLang(sourceLang);

  const maxFilter = typeof maxSitelinks === "number" && !Number.isNaN(maxSitelinks)
    ? `FILTER(?sitelinks <= ${maxSitelinks})`
    : "";
  const seedBlock = buildPersonCandidateSeedBlock(sourceLang);

  return `
    SELECT
      ?qid
      ?sitelinks
      ?itemLabel_ko
      ?itemLabel_en
      ?koWikiTitle
      ?enWikiTitle
    WHERE {
      {
        SELECT DISTINCT ?item ?sitelinks ?koWikiTitle ?enWikiTitle
        WHERE {
          ${seedBlock}
          ?item wdt:P31 wd:Q5 ;
                wikibase:sitelinks ?sitelinks .
          FILTER(?sitelinks >= ${minSitelinks})
          ${maxFilter}
        }
        ORDER BY ?item
        LIMIT ${limit}
        OFFSET ${offset}
      }
      BIND(STRAFTER(STR(?item), "http://www.wikidata.org/entity/") AS ?qid)
      OPTIONAL { ?item rdfs:label ?itemLabel_ko FILTER(LANG(?itemLabel_ko) = "ko") }
      OPTIONAL { ?item rdfs:label ?itemLabel_en FILTER(LANG(?itemLabel_en) = "en") }
    }
  `;
}

export function assertPersonCandidateOptions(options) {
  validateSourceLang(options.sourceLang);
}

const EVENT_CLASSES = [
  "wd:Q13418847", // historical event
  "wd:Q198", // war
  "wd:Q178561", // battle
  "wd:Q178706", // treaty
  "wd:Q2380335", // disaster
];

const PLACE_CLASSES = [
  "wd:Q486972", // human settlement
  "wd:Q82794", // geographic region
  "wd:Q515", // city
  "wd:Q6256", // country
];

function buildSelect() {
  return `
    SELECT DISTINCT
      (STRAFTER(STR(?item), "http://www.wikidata.org/entity/") AS ?qid)
      (STRAFTER(STR(?class), "http://www.wikidata.org/entity/") AS ?classQid)
      ?coord
      (STR(?start) AS ?startRaw)
      (STR(?end) AS ?endRaw)
      (STR(?pointInTime) AS ?pointInTimeRaw)
      (STR(?birth) AS ?birthRaw)
      (STR(?death) AS ?deathRaw)
      (STR(?inception) AS ?inceptionRaw)
      ?itemLabel_ko
      ?itemLabel_en
      ?itemDesc_ko
      ?itemDesc_en
      ?koWikiTitle
      ?enWikiTitle
  `;
}

function buildSharedLabelOptionals() {
  return `
    OPTIONAL { ?item rdfs:label ?itemLabel_ko FILTER(LANG(?itemLabel_ko) = "ko") }
    OPTIONAL { ?item rdfs:label ?itemLabel_en FILTER(LANG(?itemLabel_en) = "en") }
    OPTIONAL { ?item schema:description ?itemDesc_ko FILTER(LANG(?itemDesc_ko) = "ko") }
    OPTIONAL { ?item schema:description ?itemDesc_en FILTER(LANG(?itemDesc_en) = "en") }
    OPTIONAL {
      ?koWiki schema:about ?item ;
              schema:isPartOf <https://ko.wikipedia.org/> ;
              schema:name ?koWikiTitle .
    }
    OPTIONAL {
      ?enWiki schema:about ?item ;
              schema:isPartOf <https://en.wikipedia.org/> ;
              schema:name ?enWikiTitle .
    }
  `;
}

export function buildQuery({ entityType, yearFrom, yearTo, limit, offset }) {
  const select = buildSelect();
  const sharedLabelOptionals = buildSharedLabelOptionals();

  if (entityType === "event") {
    return `
      ${select}
      WHERE {
        VALUES ?class { ${EVENT_CLASSES.join(" ")} }
        ?item wdt:P31 ?class .
        ?item wdt:P625 ?coord .
        {
          ?item wdt:P580 ?start .
          FILTER(YEAR(?start) >= ${yearFrom} && YEAR(?start) <= ${yearTo})
          BIND(?start AS ?timeRef)
        }
        UNION
        {
          ?item wdt:P585 ?pointInTime .
          FILTER(YEAR(?pointInTime) >= ${yearFrom} && YEAR(?pointInTime) <= ${yearTo})
          BIND(?pointInTime AS ?timeRef)
        }
        UNION
        {
          ?item wdt:P571 ?inception .
          FILTER(YEAR(?inception) >= ${yearFrom} && YEAR(?inception) <= ${yearTo})
          BIND(?inception AS ?timeRef)
        }
        OPTIONAL { ?item wdt:P582 ?end. }
        ${sharedLabelOptionals}
      }
      ORDER BY ?item
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  if (entityType === "person") {
    return `
      ${select}
      WHERE {
        ?item wdt:P31 wd:Q5 .
        ?item wdt:P625 ?coord .
        ?item wdt:P569 ?birth .
        OPTIONAL { ?item wdt:P570 ?death. }
        BIND(YEAR(?birth) AS ?yearRef)
        FILTER(?yearRef >= ${yearFrom} && ?yearRef <= ${yearTo})
        FILTER(
          EXISTS {
            ?koWiki schema:about ?item ;
                    schema:isPartOf <https://ko.wikipedia.org/> ;
                    schema:name ?koWikiTitle .
          }
          ||
          EXISTS {
            ?enWiki schema:about ?item ;
                    schema:isPartOf <https://en.wikipedia.org/> ;
                    schema:name ?enWikiTitle .
          }
        )
        ${sharedLabelOptionals}
      }
      ORDER BY ?item
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  if (entityType === "place") {
    return `
      ${select}
      WHERE {
        VALUES ?class { ${PLACE_CLASSES.join(" ")} }
        ?item wdt:P31 ?class .
        ?item wdt:P625 ?coord .
        ?item wdt:P571 ?inception .
        BIND(YEAR(?inception) AS ?yearRef)
        FILTER(?yearRef >= ${yearFrom} && ?yearRef <= ${yearTo})
        ${sharedLabelOptionals}
      }
      ORDER BY ?item
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  throw new Error(`Unsupported entity type: ${entityType}`);
}

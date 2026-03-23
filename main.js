const { HowLongToBeatService, SearchModifier } = require("howlongtobeat-ts");
const fs = require("node:fs/promises");
const path = require("node:path");

const XBOX_CATALOG_URL =
  "https://catalog.gamepass.com/sigls/v3?id=29a81209-df6f-41fd-a528-2ae6b91f719c&language=LANGUAGE&market=MARKET&platformContext=ConsoleGen8;ConsoleGen9;pc&subscriptionContext=cfq7ttc0khs0";
const DISPLAY_CATALOG_URL =
  "https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=IDS&market=MARKET&languages=LANGUAGE&MS-CV=DGU1mcuYo0WMMp+F.1";
const PLAYSTATION_LIST_URL =
  "https://www.playstation.com/bin/imagic/gameslist?locale=LOCALE&categoryList=CATEGORY";

const OUTPUT_DIR = path.join(__dirname, "data");
const OUTPUT_CSV = path.join(OUTPUT_DIR, "list.csv");
const OUTPUT_METADATA = path.join(OUTPUT_DIR, "metadata.json");
const TITLE_OVERRIDES_FILE = path.join(OUTPUT_DIR, "title-overrides.json");
const DEFAULT_MARKET = process.env.GP_MARKET || "US";
const DEFAULT_LANGUAGE = process.env.GP_LANGUAGE || "en-us";
const PLAYSTATION_LOCALE = process.env.PS_LOCALE || "en-us";
const HLTB_CONCURRENCY = Number(process.env.HLTB_CONCURRENCY || 4);
const HLTB_DELAY_MS = Number(process.env.HLTB_DELAY_MS || 250);
const PRODUCT_BATCH_SIZE = 20;
const FETCH_RETRIES = Number(process.env.FETCH_RETRIES || 3);
const FETCH_RETRY_DELAY_MS = Number(process.env.FETCH_RETRY_DELAY_MS || 1500);

const PLAYSTATION_CATEGORY_CONFIG = [
  {
    key: "plus-games-list",
    catalogType: "Game Catalog",
    tier: "Extra/Premium",
  },
  {
    key: "plus-classics-list",
    catalogType: "Classics Catalog",
    tier: "Premium",
  },
  {
    key: "plus-monthly-games-list",
    catalogType: "Monthly Games",
    tier: "Essential/Extra/Premium",
  },
  {
    key: "ubisoft-classics-list",
    catalogType: "Ubisoft+ Classics",
    tier: "Extra/Premium",
  },
];

const hltbService = new HowLongToBeatService();
let hltbLiveEnabled = true;

const PLATFORM_VARIANT_PATTERN =
  /\b(xbox series x\|s|xbox one|windows|pc|ps4|ps5|ps4 & ps5|ps4™ & ps5®|ps4® & ps5®|ps4™ \+ ps5™|ps4 \+ ps5|xbox one edition|xbox series x\|s edition|console edition)\b/gi;
const EDITION_VARIANT_PATTERN =
  /\b(standard edition|standard|definitive edition|game of the year edition|complete edition|anniversary edition|premium edition|deluxe edition|collector'?s edition|director'?s cut|remastered|hd remaster|ultimate edition|digital version|game preview|cross gen bundle|cross-gen bundle|free upgrade|landmark edition|enhanced edition|full time edition|game of the year|legends of the zone trilogy|legacy collection|year-one|year one|goty)\b/gi;
const TRAILING_NOISE_PATTERN = /\s*[-|:]\s*(standard|ultimate|complete|deluxe|premium|collector|director|cross-gen|cross gen|digital|xbox|ps4|ps5|windows).*/gi;

function normalizeTitle(value) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/_/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[™®©]/g, "")
    .replace(/\((19|20)\d{2}\)/g, " ")
    .replace(
      /\b(xbox series x\|s|xbox one|windows|pc|ps4|ps5|ps4 & ps5|ps4™ & ps5®|console edition|standard edition|standard|definitive edition|game of the year edition|complete edition|anniversary edition|premium edition|deluxe edition|collector'?s edition|director'?s cut|remastered|hd remaster|ultimate edition|digital version|game preview|cross gen bundle)\b/gi,
      " "
    )
    .replace(/[\(\)\[\]\-:,'".!&/®]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildNormalizedKeys(...values) {
  const keys = new Set();

  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw) {
      continue;
    }

    const variants = [
      raw,
      raw.replace(/\((19|20)\d{2}\)/g, " "),
      raw.replace(/\(.*?\)/g, " "),
      raw.replace(/\s+-\s+.*$/g, " "),
      raw.replace(/:.*$/g, " "),
    ];

    for (const variant of variants) {
      const normalized = normalizeTitle(variant);
      if (normalized) {
        keys.add(normalized);
      }
    }
  }

  return [...keys];
}

function stripTitleNoise(value) {
  return String(value || "")
    .replace(PLATFORM_VARIANT_PATTERN, " ")
    .replace(EDITION_VARIANT_PATTERN, " ")
    .replace(/\((playstation plus|ps4|ps5|xbox one|windows|xbox series x\|s|19\d{2}|20\d{2}|classic,?\s*20\d{2})\)/gi, " ")
    .replace(TRAILING_NOISE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveTitleVariants(value, override = {}) {
  const raw = String(value || "").trim();
  const variants = new Set();

  if (!raw) {
    return [];
  }

  const stripped = stripTitleNoise(raw);
  const withoutParens = raw.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  const withoutSubtitle = stripped.replace(/:.*$/g, " ").replace(/\s+/g, " ").trim();
  const withoutDash = stripped.replace(/\s+-\s+.*$/g, " ").replace(/\s+/g, " ").trim();
  const base = stripTitleNoise(withoutParens);

  for (const candidate of [
    raw,
    stripped,
    withoutParens,
    withoutSubtitle,
    withoutDash,
    base,
    ...(override.aliases || []),
    ...(override.search || []),
  ]) {
    const clean = String(candidate || "").trim();
    if (clean) {
      variants.add(clean);
    }
  }

  return [...variants];
}

async function loadTitleOverrides() {
  try {
    return JSON.parse(await fs.readFile(TITLE_OVERRIDES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function getTitleOverride(overrides, title) {
  return overrides[String(title || "")] || {};
}

function buildGameLookupKeys(game, overrides) {
  const override = getTitleOverride(overrides, game.title);
  const variants = deriveTitleVariants(game.title, override);
  return buildNormalizedKeys(...variants, game.normalizedTitle);
}

function escapeCsvCell(value) {
  const stringValue = String(value ?? "");
  if (/[,"\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);

  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

async function fetchJson(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "HowLongToBeatGamePass/3.0",
          accept: "application/json, text/plain, */*",
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;

      if (attempt < FETCH_RETRIES) {
        console.warn(`Fetch attempt ${attempt}/${FETCH_RETRIES} failed for ${url}: ${error.message}`);
        await delay(FETCH_RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
}

function buildXboxCatalogUrl(language, market) {
  return XBOX_CATALOG_URL.replace("LANGUAGE", language).replace("MARKET", market);
}

function buildXboxProductsUrl(ids, language, market) {
  return DISPLAY_CATALOG_URL.replace("IDS", ids.join(","))
    .replace("LANGUAGE", language)
    .replace("MARKET", market);
}

function buildPlayStationUrl(locale, categoryKey) {
  return PLAYSTATION_LIST_URL.replace("LOCALE", locale).replace("CATEGORY", categoryKey);
}

async function fetchXboxCatalogIds(language, market) {
  const payload = await fetchJson(buildXboxCatalogUrl(language, market));
  return payload.slice(1).map((entry) => entry.id);
}

function pickXboxImage(product) {
  const localized = product.LocalizedProperties?.[0];
  const images = localized?.Images || [];
  const preferredPurposes = ["BoxArt", "Poster", "FeaturePromotionalSquareArt", "SuperHeroArt"];

  for (const purpose of preferredPurposes) {
    const match = images.find((image) => image.ImagePurpose === purpose && image.Uri);
    if (match) {
      return `https:${match.Uri}`;
    }
  }

  return "";
}

function pickXboxProductUrl(product) {
  const localized = product.LocalizedProperties?.[0];
  const url = localized?.ProductUrl || localized?.ProductUri || localized?.StoreId || localized?.Url;
  if (typeof url !== "string" || !url) {
    return "";
  }
  return url.startsWith("http") ? url : `https://www.xbox.com${url}`;
}

function pickXboxPlatforms(product) {
  const platforms = new Set();

  for (const skuAvailability of product.DisplaySkuAvailabilities || []) {
    for (const availability of skuAvailability.Availabilities || []) {
      for (const platform of availability.Conditions?.ClientConditions?.AllowedPlatforms || []) {
        const platformName = String(platform.PlatformName || "");

        if (platformName === "Windows.Xbox") {
          platforms.add("Xbox");
        } else if (platformName.startsWith("Windows.")) {
          platforms.add("PC");
        }
      }
    }
  }

  return [...platforms].sort().join(" | ");
}

function mapXboxProduct(product) {
  const localized = product.LocalizedProperties?.[0];
  const title = localized?.ProductTitle?.trim();
  if (!title) {
    return null;
  }

  return {
    service: "Xbox Game Pass",
    serviceKey: "xbox-game-pass",
    catalogTypes: ["Game Catalog"],
    tier: "Ultimate/PC/Console",
    productId: product.ProductId,
    title,
    normalizedTitle: normalizeTitle(title),
    productUrl: pickXboxProductUrl(product),
    imageUrl: pickXboxImage(product),
    platforms: pickXboxPlatforms(product),
    releaseDate: "",
    streamingSupported: "",
  };
}

async function fetchXboxProducts(ids, language, market) {
  const products = [];

  for (let index = 0; index < ids.length; index += PRODUCT_BATCH_SIZE) {
    const batch = ids.slice(index, index + PRODUCT_BATCH_SIZE);
    const payload = await fetchJson(buildXboxProductsUrl(batch, language, market));
    const mapped = (payload.Products || []).map(mapXboxProduct).filter(Boolean);
    products.push(...mapped);
    console.log(`Fetched Xbox product metadata ${Math.min(index + PRODUCT_BATCH_SIZE, ids.length)}/${ids.length}`);
  }

  return products;
}

function flattenPlayStationCatalog(catalogGroups, catalogType, tier) {
  return catalogGroups.flatMap((group) =>
    (group.games || []).map((game) => ({
      service: "PlayStation Plus",
      serviceKey: "playstation-plus",
      catalogTypes: [catalogType],
      tier,
      productId: game.productId || String(game.conceptId || ""),
      title: game.name?.trim(),
      normalizedTitle: normalizeTitle(game.name || ""),
      productUrl: game.conceptUrl || "",
      imageUrl: game.imageUrl || "",
      platforms: (game.device || []).join(" | "),
      releaseDate: game.releaseDate || "",
      streamingSupported: typeof game.streamingSupported === "boolean" ? String(game.streamingSupported) : "",
    }))
  );
}

async function fetchPlayStationProducts(locale) {
  const allProducts = [];

  for (const category of PLAYSTATION_CATEGORY_CONFIG) {
    const payload = await fetchJson(buildPlayStationUrl(locale, category.key));
    const products = flattenPlayStationCatalog(payload, category.catalogType, category.tier).filter(
      (entry) => entry.title
    );
    console.log(`Fetched PlayStation ${category.catalogType}: ${products.length} titles`);
    allProducts.push(...products);
  }

  return allProducts;
}

function mergeProducts(products) {
  const merged = new Map();

  for (const product of products) {
    const key = `${product.serviceKey}:${product.productId || product.productUrl || product.normalizedTitle}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, { ...product });
      continue;
    }

    existing.catalogTypes = [...new Set([...existing.catalogTypes, ...product.catalogTypes])];
    existing.tier = [...new Set([existing.tier, product.tier].filter(Boolean))].join(" | ");
    existing.platforms = [...new Set([existing.platforms, product.platforms].filter(Boolean))].join(" | ");

    if (!existing.imageUrl && product.imageUrl) {
      existing.imageUrl = product.imageUrl;
    }
    if (!existing.productUrl && product.productUrl) {
      existing.productUrl = product.productUrl;
    }
    if (!existing.releaseDate && product.releaseDate) {
      existing.releaseDate = product.releaseDate;
    }
    if (!existing.streamingSupported && product.streamingSupported) {
      existing.streamingSupported = product.streamingSupported;
    }
  }

  return [...merged.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function scoreCandidate(game, result) {
  const normalizedResult = normalizeTitle(result.name || "");
  const exact = normalizedResult === game.normalizedTitle;
  const includes =
    normalizedResult.includes(game.normalizedTitle) || game.normalizedTitle.includes(normalizedResult);
  const distancePenalty = Math.abs(normalizedResult.length - game.normalizedTitle.length);
  const populatedFields = ["gameplayMain", "gameplayMainExtra", "gameplayCompletionist"].filter(
    (field) => Number(result[field] || 0) > 0
  ).length;

  return { exact, includes, populatedFields, distancePenalty };
}

function formatHltbHours(seconds) {
  const numeric = Number(seconds || 0);
  if (!numeric) {
    return "";
  }

  const hours = Math.round((numeric / 3600) * 10) / 10;
  return Number.isInteger(hours) ? String(hours) : String(hours);
}

function normalizeHltbResult(entry) {
  return {
    id: entry.id ?? "",
    name: entry.name ?? "",
    gameplayMain: formatHltbHours(entry.mainTime),
    gameplayMainExtra: formatHltbHours(entry.mainExtraTime),
    gameplayCompletionist: formatHltbHours(entry.completionistTime),
  };
}

function compareCandidates(left, right) {
  if (left.exact !== right.exact) {
    return left.exact ? -1 : 1;
  }
  if (left.includes !== right.includes) {
    return left.includes ? -1 : 1;
  }
  if (left.populatedFields !== right.populatedFields) {
    return right.populatedFields - left.populatedFields;
  }
  return left.distancePenalty - right.distancePenalty;
}

function curateSearchTerms(title) {
  const normalized = title.replace(/\s+/g, " ").trim();
  const variants = new Set([normalized]);

  const stripped = normalized
    .replace(/\(.*?\)/g, " ")
    .replace(/:.*$/g, " ")
    .replace(/-.*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && stripped !== normalized) {
    variants.add(stripped);
  }

  const ascii = normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[™®©]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (ascii && ascii !== normalized) {
    variants.add(ascii);
  }

  return [...variants];
}

function curateSearchTermsForGame(game, overrides) {
  const override = getTitleOverride(overrides, game.title);
  const terms = new Set([
    ...deriveTitleVariants(game.title, override),
    ...curateSearchTerms(game.title),
    ...(override.search || []),
  ]);

  return [...terms].filter(Boolean);
}

async function searchHowLongToBeat(game, overrides) {
  if (!hltbLiveEnabled) {
    return null;
  }

  const terms = curateSearchTermsForGame(game, overrides);
  let best = null;

  for (const term of terms) {
    let results = [];
    try {
      results = (await hltbService.search(term, SearchModifier.HIDE_DLC)).map(normalizeHltbResult);
    } catch (error) {
      console.warn(`HLTB lookup failed for "${term}": ${error.message}`);
      continue;
    }

    if (!results.length) {
      continue;
    }

    const ranked = [...results].sort((left, right) =>
      compareCandidates(scoreCandidate(game, left), scoreCandidate(game, right))
    );

    const top = ranked[0];
    if (!best || compareCandidates(scoreCandidate(game, top), scoreCandidate(game, best)) < 0) {
      best = top;
    }
  }

  if (!best) {
    return null;
  }

  return {
    gameplayMain: best.gameplayMain ?? "",
    gameplayMainExtra: best.gameplayMainExtra ?? "",
    gameplayCompletionist: best.gameplayCompletionist ?? "",
    hltbId: best.id ?? "",
    hltbName: best.name ?? "",
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadCachedRows() {
  try {
    const entries = await fs.readdir(OUTPUT_DIR);
    const csvFiles = entries.filter((entry) => entry.endsWith(".csv")).sort().reverse();
    const rows = [];

    for (const fileName of csvFiles) {
      const file = await fs.readFile(path.join(OUTPUT_DIR, fileName), "utf8");
      rows.push(...parseCsv(file));
    }

    return rows;
  } catch {
    return [];
  }
}

function buildCachedLookup(rows) {
  const lookup = new Map();

  for (const row of rows) {
    const cachedRow = {
      name: row.name,
      gameplayMain: row.gameplayMain || row.Main || "",
      gameplayMainExtra: row.gameplayMainExtra || row["Main Extra"] || "",
      gameplayCompletionist: row.gameplayCompletionist || row.Completionist || "",
      imageUrl: row.imageUrl || row.Cover || "",
      hltbId: row.hltbId || row.id || "",
      hltbName: row.hltbName || row.name || "",
    };

    const cachedScore = Number(Boolean(cachedRow.hltbId)) + Number(Boolean(cachedRow.gameplayMain));

    for (const key of buildNormalizedKeys(cachedRow.name, cachedRow.hltbName)) {
      const existing = lookup.get(key);
      const existingScore = Number(Boolean(existing?.hltbId)) + Number(Boolean(existing?.gameplayMain));

      if (!existing || cachedScore > existingScore) {
        lookup.set(key, cachedRow);
      }
    }
  }

  return lookup;
}

function findCachedRow(game, cachedLookup) {
  for (const key of buildNormalizedKeys(game.title, game.normalizedTitle, stripTitleNoise(game.title))) {
    const match = cachedLookup.get(key);
    if (match) {
      return match;
    }
  }

  return null;
}

function buildMatchedRowLookup(rows, games, overrides) {
  const lookup = new Map();

  rows.forEach((row, index) => {
    if (!row.hltbId && !row.gameplayMain && !row.gameplayMainExtra && !row.gameplayCompletionist) {
      return;
    }

    const game = games[index];
    const override = getTitleOverride(overrides, game.title);
    const score =
      Number(Boolean(row.hltbId)) +
      Number(Boolean(row.gameplayMain)) +
      Number(Boolean(row.gameplayMainExtra)) +
      Number(Boolean(row.gameplayCompletionist));

    for (const key of buildNormalizedKeys(...deriveTitleVariants(game.title, override), row.hltbName, row.name)) {
      const existing = lookup.get(key);
      if (!existing || score > existing.score) {
        lookup.set(key, { row, score });
      }
    }
  });

  return lookup;
}

function findMatchedRow(game, lookup, overrides) {
  for (const key of buildGameLookupKeys(game, overrides)) {
    const match = lookup.get(key);
    if (match) {
      return match.row;
    }
  }

  return null;
}

function applyMatchedRow(row, matchedRow) {
  if (!matchedRow) {
    return row;
  }

  return {
    ...row,
    gameplayMain: matchedRow.gameplayMain,
    gameplayMainExtra: matchedRow.gameplayMainExtra,
    gameplayCompletionist: matchedRow.gameplayCompletionist,
    hltbId: matchedRow.hltbId,
    hltbName: matchedRow.hltbName,
    matchSource: "derived",
  };
}

function hasDurationData(row) {
  return Boolean(row.gameplayMain || row.gameplayMainExtra || row.gameplayCompletionist);
}

function mergeWithCache(game, liveRow, cachedRow) {
  const hltbData = liveRow?.hltbId
    ? { ...liveRow, matchSource: "live" }
    : cachedRow?.hltbId || cachedRow?.gameplayMain
      ? {
          gameplayMain: cachedRow.gameplayMain,
          gameplayMainExtra: cachedRow.gameplayMainExtra,
          gameplayCompletionist: cachedRow.gameplayCompletionist,
          hltbId: cachedRow.hltbId,
          hltbName: cachedRow.hltbName,
          matchSource: "cache",
        }
      : {
          gameplayMain: "",
          gameplayMainExtra: "",
          gameplayCompletionist: "",
          hltbId: "",
          hltbName: "",
          matchSource: "none",
        };

  return {
    name: game.title,
    service: game.service,
    serviceKey: game.serviceKey,
    catalogTypes: game.catalogTypes.join(" | "),
    tier: game.tier,
    platforms: game.platforms,
    releaseDate: game.releaseDate,
    streamingSupported: game.streamingSupported,
    imageUrl: game.imageUrl || cachedRow?.imageUrl || "",
    gameplayMain: hltbData.gameplayMain,
    gameplayMainExtra: hltbData.gameplayMainExtra,
    gameplayCompletionist: hltbData.gameplayCompletionist,
    hltbId: hltbData.hltbId,
    hltbName: hltbData.hltbName,
    productId: game.productId,
    productUrl: game.productUrl,
    matchSource: hltbData.matchSource,
  };
}

async function probeHltb() {
  try {
    const results = await hltbService.search("Halo Infinite", SearchModifier.HIDE_DLC);
    return Array.isArray(results);
  } catch (error) {
    console.warn(`HLTB live lookups unavailable: ${error.message}`);
    return false;
  }
}

async function writeCsv(rows, filePath) {
  const header = [
    "name",
    "service",
    "serviceKey",
    "catalogTypes",
    "tier",
    "platforms",
    "releaseDate",
    "streamingSupported",
    "gameplayMain",
    "gameplayMainExtra",
    "gameplayCompletionist",
    "imageUrl",
    "hltbId",
    "hltbName",
    "productId",
    "productUrl",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      header
        .map((column) => escapeCsvCell(row[column]))
        .join(",")
    );
  }

  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

function summarizeByService(rows) {
  return rows.reduce((accumulator, row) => {
    const key = row.serviceKey;
    if (!accumulator[key]) {
      accumulator[key] = {
        service: row.service,
        serviceKey: row.serviceKey,
        totalTitles: 0,
        matchedTitles: 0,
      };
    }

    accumulator[key].totalTitles += 1;
    if (hasDurationData(row)) {
      accumulator[key].matchedTitles += 1;
    }

    return accumulator;
  }, {});
}

function summarizeByCatalogType(rows) {
  return rows.reduce((accumulator, row) => {
    for (const catalogType of String(row.catalogTypes || "")
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean)) {
      if (!accumulator[catalogType]) {
        accumulator[catalogType] = {
          catalogType,
          totalTitles: 0,
          matchedTitles: 0,
        };
      }

      accumulator[catalogType].totalTitles += 1;
      if (hasDurationData(row)) {
        accumulator[catalogType].matchedTitles += 1;
      }
    }

    return accumulator;
  }, {});
}

async function run() {
  const startedAt = new Date();
  console.log(`Refreshing catalogs for Xbox (${DEFAULT_LANGUAGE}/${DEFAULT_MARKET}) and PlayStation (${PLAYSTATION_LOCALE})`);

  await ensureOutputDir();
  const cachedRows = await loadCachedRows();
  const cachedLookup = buildCachedLookup(cachedRows);
  const titleOverrides = await loadTitleOverrides();

  const xboxIds = await fetchXboxCatalogIds(DEFAULT_LANGUAGE, DEFAULT_MARKET);
  console.log(`Fetched ${xboxIds.length} Xbox Game Pass catalog ids`);

  const [xboxProducts, playstationProducts] = await Promise.all([
    fetchXboxProducts(xboxIds, DEFAULT_LANGUAGE, DEFAULT_MARKET),
    fetchPlayStationProducts(PLAYSTATION_LOCALE),
  ]);

  const sourceProducts = mergeProducts([...xboxProducts, ...playstationProducts]);
  console.log(`Resolved ${sourceProducts.length} total catalog titles across both services`);

  hltbLiveEnabled = await probeHltb();

  const rows = await mapWithConcurrency(sourceProducts, HLTB_CONCURRENCY, async (game, index) => {
    let liveRow = null;

    if (hltbLiveEnabled) {
      await delay(HLTB_DELAY_MS);
      liveRow = await searchHowLongToBeat(game, titleOverrides);
    }

    const merged = mergeWithCache(game, liveRow, findCachedRow(game, cachedLookup));
    console.log(
      `Processed ${index + 1}/${sourceProducts.length}: ${game.service} / ${game.title}${merged.hltbId ? ` [${merged.matchSource}]` : " [no match]"}`
    );
    return merged;
  });

  const matchedRowLookup = buildMatchedRowLookup(rows, sourceProducts, titleOverrides);
  const finalizedRows = rows.map((row, index) =>
    row.matchSource === "none" ? applyMatchedRow(row, findMatchedRow(sourceProducts[index], matchedRowLookup, titleOverrides)) : row
  );

  const rowsWithData = finalizedRows
    .filter((row) => hasDurationData(row))
    .sort((left, right) => {
      const leftMain = Number(left.gameplayMain || 0);
      const rightMain = Number(right.gameplayMain || 0);
      if (leftMain !== rightMain) {
        return rightMain - leftMain;
      }
      if (left.service !== right.service) {
        return left.service.localeCompare(right.service);
      }
      return left.name.localeCompare(right.name);
    });

  const missing = finalizedRows.filter((row) => !row.hltbId && !row.gameplayMain && !row.gameplayMainExtra && !row.gameplayCompletionist);
  const metadata = {
    generatedAt: new Date().toISOString(),
    market: DEFAULT_MARKET,
    language: DEFAULT_LANGUAGE,
    playstationLocale: PLAYSTATION_LOCALE,
    hltbLiveEnabled,
    totalCatalogCount: sourceProducts.length,
    matchedCount: rowsWithData.length,
    freshMatchCount: rowsWithData.filter((row) => row.matchSource === "live").length,
    cachedMatchCount: rowsWithData.filter((row) => row.matchSource === "cache").length,
    derivedMatchCount: rowsWithData.filter((row) => row.matchSource === "derived").length,
    unmatchedCount: missing.length,
    serviceCounts: summarizeByService(finalizedRows),
    catalogTypeCounts: summarizeByCatalogType(finalizedRows),
    unmatchedTitles: missing.map((row) => ({
      service: row.service,
      title: row.name,
      catalogTypes: row.catalogTypes,
    })),
    durationSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
  };

  await Promise.all([
    writeCsv(rowsWithData, OUTPUT_CSV),
    fs.writeFile(OUTPUT_METADATA, JSON.stringify(metadata, null, 2), "utf8"),
  ]);

  console.log(`Wrote ${rowsWithData.length} matched rows to ${OUTPUT_CSV}`);
  console.log(`Wrote metadata to ${OUTPUT_METADATA}`);
  console.log(`Unmatched titles: ${missing.length}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

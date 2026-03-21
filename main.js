const { HowLongToBeatService } = require("howlongtobeat");
const fs = require("node:fs/promises");
const path = require("node:path");

const XBOX_CATALOG_URL =
  "https://catalog.gamepass.com/sigls/v3?id=29a81209-df6f-41fd-a528-2ae6b91f719c&language=LANGUAGE&market=MARKET&platformContext=ConsoleGen8;ConsoleGen9;pc&subscriptionContext=cfq7ttc0khs0";
const DISPLAY_CATALOG_URL =
  "https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=IDS&market=MARKET&languages=LANGUAGE&MS-CV=DGU1mcuYo0WMMp+F.1";

const OUTPUT_DIR = path.join(__dirname, "data");
const OUTPUT_CSV = path.join(OUTPUT_DIR, "list.csv");
const OUTPUT_METADATA = path.join(OUTPUT_DIR, "metadata.json");
const DEFAULT_MARKET = process.env.GP_MARKET || "US";
const DEFAULT_LANGUAGE = process.env.GP_LANGUAGE || "en-us";
const HLTB_CONCURRENCY = Number(process.env.HLTB_CONCURRENCY || 4);
const HLTB_DELAY_MS = Number(process.env.HLTB_DELAY_MS || 250);
const PRODUCT_BATCH_SIZE = 20;

const hltbService = new HowLongToBeatService();
let hltbLiveEnabled = true;

function normalizeTitle(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[™®©]/g, "")
    .replace(/\b(xbox series x\|s|xbox one|windows|pc|console edition|standard edition|definitive edition|game of the year edition|complete edition|anniversary edition|premium edition|deluxe edition|remastered|hd remaster|ultimate edition|digital version|game preview)\b/gi, " ")
    .replace(/[\(\)\[\]\-:,'".!&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildCatalogUrl(language, market) {
  return XBOX_CATALOG_URL.replace("LANGUAGE", language).replace("MARKET", market);
}

function buildProductsUrl(ids, language, market) {
  return DISPLAY_CATALOG_URL.replace("IDS", ids.join(","))
    .replace("LANGUAGE", language)
    .replace("MARKET", market);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "HowLongToBeatGamePass/2.0",
      accept: "application/json, text/plain, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchCatalogIds(language, market) {
  const payload = await fetchJson(buildCatalogUrl(language, market));
  return payload.slice(1).map((entry) => entry.id);
}

function pickImage(product) {
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

function pickProductUrl(product) {
  const localized = product.LocalizedProperties?.[0];
  const url =
    localized?.ProductUrl ||
    localized?.ProductUri ||
    localized?.StoreId ||
    localized?.Url;

  if (typeof url !== "string" || !url) {
    return "";
  }

  return url.startsWith("http") ? url : `https://www.xbox.com${url}`;
}

function mapProduct(product) {
  const localized = product.LocalizedProperties?.[0];
  const title = localized?.ProductTitle?.trim();

  if (!title) {
    return null;
  }

  return {
    productId: product.ProductId,
    title,
    normalizedTitle: normalizeTitle(title),
    productUrl: pickProductUrl(product),
    imageUrl: pickImage(product),
  };
}

async function fetchProducts(ids, language, market) {
  const products = [];

  for (let index = 0; index < ids.length; index += PRODUCT_BATCH_SIZE) {
    const batch = ids.slice(index, index + PRODUCT_BATCH_SIZE);
    const payload = await fetchJson(buildProductsUrl(batch, language, market));
    const mapped = (payload.Products || []).map(mapProduct).filter(Boolean);
    products.push(...mapped);
    console.log(`Fetched product metadata ${Math.min(index + PRODUCT_BATCH_SIZE, ids.length)}/${ids.length}`);
  }

  const unique = new Map();
  for (const product of products) {
    if (!unique.has(product.productId)) {
      unique.set(product.productId, product);
    }
  }

  return [...unique.values()].sort((a, b) => a.title.localeCompare(b.title));
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

async function writeCsv(rows, filePath) {
  const header = [
    "name",
    "gameplayMain",
    "gameplayMainExtra",
    "gameplayCompletionist",
    "imageUrl",
    "hltbId",
    "hltbName",
    "xboxProductId",
    "xboxProductUrl",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.gameplayMain,
        row.gameplayMainExtra,
        row.gameplayCompletionist,
        row.imageUrl,
        row.hltbId,
        row.hltbName,
        row.xboxProductId,
        row.xboxProductUrl,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
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

  return {
    exact,
    includes,
    populatedFields,
    distancePenalty,
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

async function searchHowLongToBeat(game) {
  if (!hltbLiveEnabled) {
    return null;
  }

  const terms = curateSearchTerms(game.title);
  let best = null;

  for (const term of terms) {
    let results = [];
    try {
      results = await hltbService.search(term);
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

  return {
    name: game.title,
    gameplayMain: best?.gameplayMain ?? "",
    gameplayMainExtra: best?.gameplayMainExtra ?? "",
    gameplayCompletionist: best?.gameplayCompletionist ?? "",
    imageUrl: game.imageUrl,
    hltbId: best?.id ?? "",
    hltbName: best?.name ?? "",
    xboxProductId: game.productId,
    xboxProductUrl: game.productUrl,
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

    const key = normalizeTitle(cachedRow.name || "");
    if (!key) {
      continue;
    }

    const existing = lookup.get(key);
    const existingScore = Number(Boolean(existing?.hltbId)) + Number(Boolean(existing?.gameplayMain));
    const cachedScore = Number(Boolean(cachedRow.hltbId)) + Number(Boolean(cachedRow.gameplayMain));

    if (!existing || cachedScore > existingScore) {
      lookup.set(key, cachedRow);
    }
  }
  return lookup;
}

function mergeWithCache(liveRow, cachedRow, game) {
  if (liveRow?.hltbId) {
    return { ...liveRow, matchSource: "live" };
  }

  if (cachedRow) {
    return {
      name: game.title,
      gameplayMain: cachedRow.gameplayMain,
      gameplayMainExtra: cachedRow.gameplayMainExtra,
      gameplayCompletionist: cachedRow.gameplayCompletionist,
      imageUrl: game.imageUrl || cachedRow.imageUrl || "",
      hltbId: cachedRow.hltbId,
      hltbName: cachedRow.hltbName,
      xboxProductId: game.productId,
      xboxProductUrl: game.productUrl,
      matchSource: "cache",
    };
  }

  return {
    name: game.title,
    gameplayMain: "",
    gameplayMainExtra: "",
    gameplayCompletionist: "",
    imageUrl: game.imageUrl,
    hltbId: "",
    hltbName: "",
    xboxProductId: game.productId,
    xboxProductUrl: game.productUrl,
    matchSource: "none",
  };
}

async function probeHltb() {
  try {
    const results = await hltbService.search("Halo Infinite");
    return Array.isArray(results);
  } catch (error) {
    console.warn(`HLTB live lookups unavailable: ${error.message}`);
    return false;
  }
}

async function run() {
  const startedAt = new Date();
  console.log(`Refreshing Game Pass data for ${DEFAULT_LANGUAGE}/${DEFAULT_MARKET}`);

  await ensureOutputDir();
  const cachedRows = await loadCachedRows();
  const cachedLookup = buildCachedLookup(cachedRows);

  const productIds = await fetchCatalogIds(DEFAULT_LANGUAGE, DEFAULT_MARKET);
  console.log(`Fetched ${productIds.length} Game Pass catalog ids`);

  const games = await fetchProducts(productIds, DEFAULT_LANGUAGE, DEFAULT_MARKET);
  console.log(`Resolved ${games.length} products with metadata`);

  hltbLiveEnabled = await probeHltb();

  const rows = await mapWithConcurrency(games, HLTB_CONCURRENCY, async (game, index) => {
    let result = null;
    if (hltbLiveEnabled) {
      await delay(HLTB_DELAY_MS);
      result = await searchHowLongToBeat(game);
    }

    const merged = mergeWithCache(result, cachedLookup.get(game.normalizedTitle), game);
    console.log(
      `Processed ${index + 1}/${games.length}: ${game.title}${merged.hltbId ? ` [${merged.matchSource}]` : " [no match]"}`
    );
    return merged;
  });

  const rowsWithData = rows
    .filter((row) => row.gameplayMain || row.gameplayMainExtra || row.gameplayCompletionist)
    .sort((left, right) => {
      const leftMain = Number(left.gameplayMain || 0);
      const rightMain = Number(right.gameplayMain || 0);
      if (leftMain !== rightMain) {
        return rightMain - leftMain;
      }
      return left.name.localeCompare(right.name);
    });

  const missing = rows.filter((row) => !row.hltbId).map((row) => row.name);
  const freshMatchCount = rows.filter((row) => row.matchSource === "live").length;
  const cachedMatchCount = rows.filter((row) => row.matchSource === "cache").length;
  const metadata = {
    generatedAt: new Date().toISOString(),
    market: DEFAULT_MARKET,
    language: DEFAULT_LANGUAGE,
    hltbLiveEnabled,
    xboxCatalogCount: games.length,
    matchedCount: rowsWithData.length,
    freshMatchCount,
    cachedMatchCount,
    unmatchedCount: missing.length,
    unmatchedTitles: missing,
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

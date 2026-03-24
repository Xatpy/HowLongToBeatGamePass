# Beatable

Beatable is a lightweight data product and static web app built around a simple promise: find your next game and know the time commitment.

The product focuses on a practical question: which games in subscription libraries are actually finishable, and how long do they take?

The project pulls live catalog data from Xbox and PlayStation, enriches titles with HowLongToBeat durations and review scores when available, and serves a fast browser UI for browsing by service, platform, and completion time. It is also now structured around a stable remote data contract so the same dataset can power the web app and future mobile apps.

## Product Overview

The app is intentionally simple.

It is built around two catalog views:

- `Xbox Game Pass`
- `PlayStation Plus Premium`

The current UI focuses on the core user flow:

- choose a catalog
- search for a game
- filter by platform
- filter by completion time
- sort by `Main`, `Main + Extra`, `Completionist`, or `Title`

This is not meant to be a storefront clone. It is a decision tool for people who want to pick something worth playing and know the time commitment up front.

## Current Dataset

Latest generated dataset in this repo:

- generated: `2026-03-24T08:11:16.333Z`
- tracked catalog titles: `1,174`
- matched titles with visible HLTB duration data: `963`
- unmatched titles: `178`

Service breakdown:

- Xbox Game Pass: `436 / 541` matched
- PlayStation Plus: `527 / 633` matched

Generated outputs:

- `data/catalog-manifest.json`
  - stable manifest for web and mobile clients
- `data/catalog.json`
  - stable current JSON dataset
- `data/catalogs/catalog-<version>.json`
  - immutable versioned JSON snapshots
- `data/list.csv`
  - generated CSV export of matched rows
- `data/metadata.json`
  - refresh timestamp, counts, service breakdowns, catalog breakdowns, and unmatched titles

## Shared Data Contract

The app is now built around one canonical remote data contract intended for both the browser app and future mobile apps.

Stable URLs:

- `/data/catalog-manifest.json`
  - the entry point clients should check first
- `/data/catalog.json`
  - the latest stable JSON dataset
- `/data/catalogs/catalog-<version>.json`
  - immutable versioned dataset files

The manifest currently includes:

- `schemaVersion`
- `product`
- `version`
- `generatedAt`
- `datasetUrl`
- `currentUrl`
- `manifestUrl`
- `sha256`
- `sizeBytes`
- `matchedCount`
- `totalCatalogCount`

Current manifest example:

```json
{
  "schemaVersion": 1,
  "product": "Beatable",
  "version": "20260324T081116Z",
  "generatedAt": "2026-03-24T08:11:16.333Z",
  "datasetUrl": "/data/catalogs/catalog-20260324T081116Z.json",
  "currentUrl": "/data/catalog.json",
  "manifestUrl": "/data/catalog-manifest.json"
}
```

The intended client update flow is:

1. Fetch `/data/catalog-manifest.json`.
2. Compare the returned `version` with the locally cached one.
3. If unchanged, keep using local data.
4. If changed, download `datasetUrl`.
5. Swap to the new dataset only after the download succeeds.

This keeps the client simple and gives deterministic versioning for mobile, while avoiding direct dependence on the refresh pipeline.

## How It Works

The refresh pipeline does four things:

1. Fetch the live Xbox Game Pass catalog from Microsoft public catalog endpoints.
2. Fetch the live PlayStation Plus catalogs from PlayStation public catalog endpoints.
3. Normalize all titles into one shared schema.
4. Try to match each title against HowLongToBeat and write the results into the app dataset.

The pipeline includes:

- title normalization for edition/platform/store variants
- guarded matching so overly broad fallback search terms do not attach the wrong HLTB entry to a game
- cached recovery from prior CSV snapshots
- manual overrides in `data/title-overrides.json` for stubborn title mismatches
- retry logic for unstable network requests
- JSON manifest and versioned dataset generation for shared client consumption

The generated JSON dataset currently includes fields such as:

- `name`
- `service`
- `serviceKey`
- `catalogTypes`
- `tier`
- `platforms`
- `releaseDate`
- `streamingSupported`
- `reviewScore`
- `gameplayMain`
- `gameplayMainExtra`
- `gameplayCompletionist`
- `imageUrl`
- `hltbId`
- `hltbName`
- `productId`
- `productUrl`

## Supported Catalog Data

Xbox:

- Game Pass catalog
- normalized platforms: `PC`, `Xbox`

PlayStation:

- Game Catalog
- Classics Catalog
- Ubisoft+ Classics
- Monthly Games
- normalized platforms: `PS4`, `PS5`

The UI is intentionally simpler than the raw source data. Users choose between Xbox and PlayStation views first, then narrow by platform and search.

## Web And Mobile Direction

The long-term shape of the project is:

- UI code is local to the client
- remote network access is limited to:
  - game images
  - the catalog data contract

That makes the product a good fit for mobile wrappers or native clients because:

- the interface can ship bundled with the app
- the dataset can be updated independently
- updates are explicit and versioned
- offline caching is straightforward

The browser app already consumes the manifest-first JSON contract and still keeps CSV fallback support as a safety net during the transition.

## Running Locally

Install dependencies:

```bash
npm install
```

Refresh the dataset:

```bash
npm run update-data
```

Start the app:

```bash
npm run start
```

or:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4173
```

Validate the code:

```bash
npm run check
```

If port `4173` is already in use:

```bash
PORT=4174 npm run start
```

## Environment Variables

Supported runtime options:

- `GP_MARKET`
  - Xbox market code
  - default: `US`
- `GP_LANGUAGE`
  - Xbox locale
  - default: `en-us`
- `PS_LOCALE`
  - PlayStation locale
  - default: `en-us`
- `HLTB_CONCURRENCY`
  - concurrent HLTB lookups
  - default: `4`
- `HLTB_DELAY_MS`
  - delay between HLTB requests
  - default: `250`
- `FETCH_RETRIES`
  - retry count for live catalog requests
  - default: `3`
- `FETCH_RETRY_DELAY_MS`
  - base retry delay in milliseconds
  - default: `1500`
- `PORT`
  - local server port
  - default: `4173`
- `HOST`
  - local server host
  - default: `127.0.0.1`

## Repo Structure

Core files:

- `main.js`
  - catalog refresh pipeline
- `server.js`
  - local static server
- `index.html`
  - app shell
- `js/app.js`
  - filtering, sorting, rendering, and UI state
- `css/styles.css`
  - frontend styling
- `data/title-overrides.json`
  - manual title aliases for difficult HLTB matches
- `data/catalog-manifest.json`
  - stable manifest for shared clients
- `data/catalog.json`
  - stable current JSON dataset
- `data/catalogs/`
  - immutable versioned JSON datasets
- `data/list.csv`
  - generated CSV export
- `data/metadata.json`
  - generated refresh metadata

## Current Limitations

The biggest limitation is still HowLongToBeat matching quality.

Most of the remaining unmatched titles are not simple misses. They are usually one of these:

- store SKU variants like `Standard Edition`, `Cross-Gen Bundle`, or platform-tagged names
- trademark-heavy or punctuation-heavy titles
- sports/live-service titles where HLTB data is weak or inconsistent
- legacy PlayStation classics with naming that does not line up cleanly with HLTB canon

That means:

- catalog refresh works
- the app remains useful today
- the last slice of coverage improvement is increasingly title-specific
- entity resolution still needs to be conservative, because an incorrect HLTB match is worse than an unmatched title

## Why This Project Exists

Subscription libraries are optimized for merchandising, not for planning.

This project is for users who want quick answers to questions like:

- What can I finish this weekend?
- What is worth starting on Game Pass right now?
- What shorter PS Plus Premium games are available on PS5?
- How long is this game before I commit to it?

The product stays deliberately small:

- no framework
- no build step
- no database
- just generated data plus a static browser app and a versioned dataset contract

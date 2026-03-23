# How Long To Beat Subscription Catalogs

How Long To Beat Subscription Catalogs is a small data product and static web app that answers a simple question:

Which games in modern subscription libraries are worth starting if you care about completion time?

The app pulls live catalog data from official Xbox and PlayStation sources, normalizes the results into a shared dataset, enriches titles with HowLongToBeat durations when possible, and publishes a filterable browser UI.

## Product Overview

This project turns messy subscription storefront data into a single view you can browse by:

- service
- catalog type
- platform
- title
- HowLongToBeat duration

Today the product supports:

- Xbox Game Pass
  - platform filtering for `PC` and `Xbox`
- PlayStation Plus
  - `Game Catalog`
  - `Classics Catalog`
  - `Monthly Games`
  - `Ubisoft+ Classics`
  - platform filtering for `PS4` and `PS5`

The output is intentionally simple:

- a generated dataset in `data/list.csv`
- metadata and refresh diagnostics in `data/metadata.json`
- a static frontend served from `index.html`

As of March 21, 2026, the current dataset tracks:

- `1,173` catalog titles total
- `540` Xbox Game Pass titles
- `633` PlayStation Plus titles
- `123` titles with cached HowLongToBeat matches

## Project Overview

This repo is now structured as a lightweight catalog pipeline plus a static app.

Core pieces:

- `main.js`
  - fetches Xbox and PlayStation catalogs
  - normalizes products into one schema
  - attempts HowLongToBeat enrichment
  - falls back to cached matches when HLTB is blocked
  - writes `data/list.csv` and `data/metadata.json`
- `server.js`
  - tiny local static server for development
- `js/app.js`
  - loads generated data and powers filtering, sorting, and summary cards
- `index.html`
  - shell for the UI
- `css/styles.css`
  - app styling
- `data/`
  - generated outputs plus historical CSV snapshots used for cache recovery

## Data Flow

The refresh pipeline works like this:

1. Fetch the live Xbox Game Pass catalog from Microsoft public catalog endpoints.
2. Fetch the live PlayStation Plus catalogs from PlayStation public `bin/imagic/gameslist` endpoints.
3. Normalize all titles into one row format with shared fields like:
   - `name`
   - `service`
   - `catalogTypes`
   - `platforms`
   - `productUrl`
   - `hltbId`
   - `gameplayMain`
4. Attempt HowLongToBeat lookups.
5. If HLTB is unavailable, reuse prior matches from historical CSV data.
6. Emit refreshed CSV and metadata for the frontend.

## Why This Exists

Subscription catalogs are large, change frequently, and are hard to compare across services. Storefronts are optimized for merchandising, not for answering practical questions like:

- What short game should I start tonight?
- Which service has more games I can realistically finish?
- Is this title on PS5, PS4, PC, or Xbox?
- Which catalog section is this game actually in?

This project is meant to answer those questions with a single local dataset and a simple browser UI.

## Running Locally

Install dependencies:

```bash
npm install
```

Refresh the dataset:

```bash
npm run update-data
```

Start the local app:

```bash
npm run start
```

Or:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4173
```

Validate the scripts:

```bash
npm run check
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
  - local dev server port
  - default: `4173`
- `HOST`
  - local dev server host
  - default: `127.0.0.1`

## Current Limitations

The biggest constraint is not Xbox or PlayStation. It is HowLongToBeat.

As of March 21, 2026:

- automated HLTB lookups are currently blocked upstream in this project context
- `hltbLiveEnabled` is `false` in the latest generated metadata
- the app currently depends on cached matches for enriched durations

What that means in practice:

- the full catalog still refreshes successfully
- unmatched titles are preserved and reported in `data/metadata.json`
- new titles without historical cache will usually appear without HLTB durations until upstream access works again or a different enrichment strategy is added

There are also some scope decisions worth calling out:

- PlayStation coverage currently includes broader Plus catalog sections, not just a strict Premium-only view
- Xbox platform classification is derived from Microsoft availability metadata and normalized to `PC` and `Xbox`
- the frontend shows only rows that currently have HLTB data, while metadata reports the full tracked catalog

## Output Files

Generated files:

- `data/list.csv`
  - matched games shown by the frontend
- `data/metadata.json`
  - refresh metadata, counts, service breakdowns, catalog breakdowns, and unmatched titles

Useful metadata fields:

- `generatedAt`
- `totalCatalogCount`
- `matchedCount`
- `unmatchedCount`
- `serviceCounts`
- `catalogTypeCounts`
- `hltbLiveEnabled`

## Development Notes

This repo started as an old Game Pass-only scraper with frozen 2020-era data, legacy D3 usage, and brittle async flow. It has been refactored into:

- a multi-source catalog updater
- a normalized data model
- a cache-aware enrichment pipeline
- a plain JavaScript static frontend

The implementation is intentionally lightweight. There is no build step, no frontend framework, and no database. The generated files are the product.

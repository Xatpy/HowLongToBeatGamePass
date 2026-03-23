# Beatable

Beatable is a lightweight data product and static web app built around a simple promise: find your next game and know the time commitment.

Which games in subscription libraries are actually finishable, and how long do they take?

The project pulls live catalog data from Xbox and PlayStation, enriches titles with HowLongToBeat durations when available, and serves a fast browser UI for browsing by service, platform, and completion time.

## Product Overview

The app is intentionally simple.

It is built around two catalog views:

- `Xbox Game Pass`
- `PlayStation Plus Premium`

The current UI focuses on the core user flow:

- choose a catalog
- search for a game
- filter by platform
- sort by `Main`, `Main + Extra`, or `Completionist`

This is not meant to be a storefront clone. It is a decision tool for people who want to pick something worth playing and know the time commitment up front.

## Current Dataset

Latest generated dataset in this repo:

- generated: `March 22, 2026`
- tracked catalog titles: `1,173`
- matched titles with visible HLTB duration data: `940`
- unmatched titles: `196`

Service breakdown:

- Xbox Game Pass: `435 / 540` matched
- PlayStation Plus: `505 / 633` matched

Generated outputs:

- `data/list.csv`
  - matched titles shown in the frontend
- `data/metadata.json`
  - refresh timestamp, counts, service breakdowns, catalog breakdowns, and unmatched titles

## How It Works

The refresh pipeline does four things:

1. Fetch the live Xbox Game Pass catalog from Microsoft public catalog endpoints.
2. Fetch the live PlayStation Plus catalogs from PlayStation public catalog endpoints.
3. Normalize all titles into one shared schema.
4. Try to match each title against HowLongToBeat and write the results into the app dataset.

The pipeline includes:

- title normalization for edition/platform/store variants
- cached recovery from prior CSV snapshots
- manual overrides in `data/title-overrides.json` for stubborn title mismatches
- retry logic for unstable network requests

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
- `data/list.csv`
  - generated matched rows
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
- just generated data plus a static browser app

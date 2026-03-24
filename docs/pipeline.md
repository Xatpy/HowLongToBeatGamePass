# Data Pipeline

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

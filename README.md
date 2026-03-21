# How Long To Beat Game Pass

This project cross-references the live Xbox Game Pass catalog with [HowLongToBeat](https://howlongtobeat.com) and publishes a sortable static table.

## What changed

The original repo was built around a hardcoded 2020-era title list, a legacy D3 table, and brittle async scraping logic. It now:

- pulls the current Game Pass catalog directly from Xbox's public catalog endpoints
- enriches titles with current Microsoft product metadata
- matches games against `howlongtobeat`
- writes refreshed output to `data/list.csv` and `data/metadata.json`
- renders the frontend with plain modern JavaScript instead of `d3.v3`

## Usage

Install dependencies:

```bash
npm install
```

Refresh the dataset:

```bash
npm run update-data
```

Validate the scripts:

```bash
npm run check
```

Optional environment variables:

- `GP_MARKET`: Xbox market code, default `US`
- `GP_LANGUAGE`: locale, default `en-us`
- `HLTB_CONCURRENCY`: concurrent HowLongToBeat lookups, default `4`

## Notes

- The updater depends on current Xbox and HowLongToBeat responses, so results can change over time.
- Some Game Pass titles do not have clean HowLongToBeat matches. Those are recorded in `data/metadata.json`.
- If HowLongToBeat blocks automated access, the updater falls back to previously cached matches from `data/list.csv` instead of failing the run.

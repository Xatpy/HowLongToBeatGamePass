# Architecture

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

## Repo Structure

Core files:

- `main.js`: catalog refresh pipeline
- `server.js`: local static server
- `index.html`: app shell
- `js/app.js`: filtering, sorting, rendering, and UI state
- `css/styles.css`: frontend styling
- `data/title-overrides.json`: manual title aliases for difficult HLTB matches
- `data/catalog-manifest.json`: stable manifest for shared clients
- `data/catalog.json`: stable current JSON dataset
- `data/catalogs/`: immutable versioned JSON datasets
- `data/list.csv`: generated CSV export
- `data/metadata.json`: generated refresh metadata

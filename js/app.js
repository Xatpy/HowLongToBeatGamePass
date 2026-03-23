const DATA_FILE = "./data/list.csv";
const METADATA_FILE = "./data/metadata.json";

const SORT_LABELS = {
  gameplayMain: "Main",
  gameplayMainExtra: "Main + Extra",
  gameplayCompletionist: "Completionist",
  name: "Title",
};

const TIME_FILTERS = [
  { value: "any", label: "Any", limit: Infinity },
  { value: "under-5", label: "Under 5h", limit: 5 },
  { value: "under-10", label: "Under 10h", limit: 10 },
  { value: "under-20", label: "Under 20h", limit: 20 },
];

const state = {
  rows: [],
  query: "",
  service: "xbox-game-pass",
  platform: "all",
  timeFilter: "any",
  sortBy: "gameplayMain",
  sortDirection: "asc",
  lastDurationSortBy: "gameplayMain",
  metadata: null,
};

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

function normalize(text) {
  return String(text || "").toLowerCase().trim();
}

function splitField(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatHours(value) {
  const hours = Number(value || 0);
  return hours ? `${hours}h` : "—";
}

function getActiveSortLabel() {
  return SORT_LABELS[state.sortBy] || "Main";
}

function isDurationSortField(field) {
  return field === "gameplayMain" || field === "gameplayMainExtra" || field === "gameplayCompletionist";
}

function getActiveTimeFilterField() {
  return isDurationSortField(state.sortBy) ? state.sortBy : state.lastDurationSortBy;
}

function getActiveServiceMeta() {
  return state.service === "playstation-plus"
    ? { label: "PlayStation Plus Premium", short: "PlayStation" }
    : { label: "Xbox Game Pass", short: "Xbox" };
}

function getTimeFilterLimit() {
  const active = TIME_FILTERS.find((filter) => filter.value === state.timeFilter);
  return active ? active.limit : Infinity;
}

function getComparableValue(row, field) {
  if (field === "name") {
    return String(row.name || "");
  }

  const numeric = Number(row[field] || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getRowHltbUrl(row) {
  return row.hltbId ? `https://howlongtobeat.com/game/${row.hltbId}` : "";
}

function getPlatformOptions() {
  const scopedRows = state.rows.filter((row) => row.serviceKey === state.service);
  const values = [...new Set(scopedRows.flatMap((row) => splitField(row.platforms)))].sort((left, right) =>
    left.localeCompare(right)
  );

  return [{ value: "all", label: "All platforms" }, ...values.map((value) => ({ value, label: value }))];
}

function populatePlatformSelect() {
  const select = document.getElementById("platform-filter");
  const options = getPlatformOptions();

  if (!options.some((option) => option.value === state.platform)) {
    state.platform = "all";
  }

  select.innerHTML = options
    .map(
      (option) =>
        `<option value="${option.value}"${option.value === state.platform ? " selected" : ""}>${option.label}</option>`
    )
    .join("");
}

function rowMatchesTimeFilter(row) {
  if (state.timeFilter === "any") {
    return true;
  }

  const value = Number(row[getActiveTimeFilterField()] || 0);
  const limit = getTimeFilterLimit();

  // Time-filtered views intentionally exclude missing/null duration fields.
  return value > 0 && value < limit;
}

function getFilteredRows() {
  const query = normalize(state.query);

  const filtered = state.rows.filter((row) => {
    if (row.serviceKey !== state.service) {
      return false;
    }

    if (query && !normalize(row.name).includes(query)) {
      return false;
    }

    if (state.platform !== "all" && !splitField(row.platforms).includes(state.platform)) {
      return false;
    }

    if (!rowMatchesTimeFilter(row)) {
      return false;
    }

    return true;
  });

  filtered.sort((left, right) => {
    if (state.sortBy === "name") {
      return String(left.name || "").localeCompare(String(right.name || "")) * (state.sortDirection === "asc" ? 1 : -1);
    }

    const leftValue = getComparableValue(left, state.sortBy);
    const rightValue = getComparableValue(right, state.sortBy);

    if (leftValue === rightValue) {
      return String(left.name || "").localeCompare(String(right.name || ""));
    }

    return (leftValue - rightValue) * (state.sortDirection === "asc" ? 1 : -1);
  });

  return filtered;
}

function renderMetadata() {
  const node = document.getElementById("last-updated");
  const rawValue = state.metadata?.generated || state.metadata?.generatedAt;

  if (!rawValue) {
    node.hidden = true;
    node.textContent = "";
    return;
  }

  // Support both a preformatted generated string and ISO timestamps.
  const formatted = /\d{4}-\d{2}-\d{2}T/.test(rawValue)
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(rawValue))
    : rawValue;

  node.textContent = `Last updated: ${formatted}`;
  node.hidden = false;
}

function renderServiceToggle() {
  const services = [
    { value: "xbox-game-pass", label: "Xbox Game Pass" },
    { value: "playstation-plus", label: "PlayStation Plus Premium" },
  ];

  const container = document.getElementById("service-pills");
  container.innerHTML = services
    .map(
      (service) => `
        <button
          type="button"
          class="segment${state.service === service.value ? " is-active" : ""}"
          data-service="${service.value}"
          aria-pressed="${state.service === service.value ? "true" : "false"}"
        >
          ${service.label}
        </button>
      `
    )
    .join("");

  for (const button of container.querySelectorAll("[data-service]")) {
    button.addEventListener("click", () => {
      if (state.service === button.dataset.service) {
        return;
      }

      state.service = button.dataset.service;
      state.platform = "all";
      populatePlatformSelect();
      render();
    });
  }
}

function renderTimeFilters() {
  const container = document.getElementById("time-pills");
  container.innerHTML = TIME_FILTERS
    .map(
      (filter) => `
        <button
          type="button"
          class="time-pill${state.timeFilter === filter.value ? " is-active" : ""}"
          data-time-filter="${filter.value}"
          aria-pressed="${state.timeFilter === filter.value ? "true" : "false"}"
        >
          ${filter.label}
        </button>
      `
    )
    .join("");

  for (const button of container.querySelectorAll("[data-time-filter]")) {
    button.addEventListener("click", () => {
      state.timeFilter = button.dataset.timeFilter;
      render();
    });
  }
}

function renderSortTabs() {
  for (const button of document.querySelectorAll("[data-sort]")) {
    const isActive = button.dataset.sort === state.sortBy;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
}

function renderSummary(rows) {
  const activeService = getActiveServiceMeta();
  document.getElementById("results-count").textContent = `${rows.length} games`;
  document.getElementById("results-context").textContent = `${activeService.short} · Sorted by ${getActiveSortLabel()}`;
}

function renderResults(rows) {
  const container = document.getElementById("results-list");

  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">No titles matched the current filters.</div>';
    return;
  }

  container.innerHTML = rows
    .map((row) => {
      const hltbUrl = getRowHltbUrl(row);
      const platformTags = splitField(row.platforms)
        .map((platform) => `<span class="tag tag-platform">${platform}</span>`)
        .join("");
      const catalogTags = splitField(row.catalogTypes)
        .map((catalogType) => `<span class="tag tag-catalog">${catalogType}</span>`)
        .join("");

      return `
        <article class="game-card${hltbUrl ? " game-card-clickable" : ""}"${hltbUrl ? ` data-hltb-url="${hltbUrl}"` : ""}>
          <div class="game-card-main">
            <div class="game-art-wrap">
              <img class="game-art" src="${row.imageUrl}" alt="${row.name} cover art" loading="lazy">
            </div>
            <div class="game-copy">
              <div class="game-title-row">
                <h2 class="game-title">${row.name}</h2>
                ${hltbUrl ? `<a class="game-link" href="${hltbUrl}" target="_blank" rel="noreferrer">HLTB ↗</a>` : ""}
              </div>
              <p class="game-subtitle">${row.hltbName || row.service}</p>
              <div class="tag-row">
                ${catalogTags}
                ${platformTags}
              </div>
            </div>
          </div>

          <div class="game-stats">
            <div class="stat">
              <span class="stat-name">Main</span>
              <span class="stat-value">${formatHours(row.gameplayMain)}</span>
            </div>
            <div class="stat">
              <span class="stat-name">Main + Extra</span>
              <span class="stat-value">${formatHours(row.gameplayMainExtra)}</span>
            </div>
            <div class="stat">
              <span class="stat-name">Completionist</span>
              <span class="stat-value">${formatHours(row.gameplayCompletionist)}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  for (const card of container.querySelectorAll("[data-hltb-url]")) {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) {
        return;
      }
      window.open(card.dataset.hltbUrl, "_blank", "noopener,noreferrer");
    });
  }
}

function render() {
  const rows = getFilteredRows();
  renderServiceToggle();
  renderTimeFilters();
  renderSortTabs();
  renderSummary(rows);
  renderResults(rows);
}

function setSort(column) {
  if (state.sortBy === column) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortBy = column;
    state.sortDirection = column === "name" ? "asc" : "asc";
    if (isDurationSortField(column)) {
      state.lastDurationSortBy = column;
    }
  }

  render();
}

async function loadCsvData() {
  const response = await fetch(DATA_FILE);
  if (!response.ok) {
    throw new Error(`Failed to load ${DATA_FILE}`);
  }
  return parseCsv(await response.text());
}

async function loadMetadata() {
  try {
    const response = await fetch(METADATA_FILE);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silent failure is fine for a static app enhancement.
      });
    });
  }
}

async function load() {
  state.rows = await loadCsvData();
  state.metadata = await loadMetadata();

  renderMetadata();
  populatePlatformSelect();

  document.getElementById("search").addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  document.getElementById("platform-filter").addEventListener("change", (event) => {
    state.platform = event.target.value;
    render();
  });

  for (const button of document.querySelectorAll("[data-sort]")) {
    button.addEventListener("click", () => setSort(button.dataset.sort));
  }

  render();
}

registerServiceWorker();

load().catch((error) => {
  console.error(error);
  document.getElementById("results-list").innerHTML =
    '<div class="empty-state">Failed to load data. Run <code>npm run update-data</code> and refresh.</div>';
});

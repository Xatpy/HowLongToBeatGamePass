const DATA_FILE = "./data/list.csv";
const METADATA_FILE = "./data/metadata.json";

const SORT_LABELS = {
  gameplayMain: "Main Story",
  gameplayMainExtra: "Main + Extra",
  gameplayCompletionist: "Completionist",
  name: "Title",
};

const TIME_FILTERS = [
  { value: "any", label: "Any Time", limit: Infinity },
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
  return SORT_LABELS[state.sortBy] || "Main Story";
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

  return [{ value: "all", label: "All Platforms" }, ...values.map((value) => ({ value, label: value }))];
}

function renderPlatformPills() {
  const container = document.getElementById("platform-pills");
  const options = getPlatformOptions();

  if (!options.some((option) => option.value === state.platform)) {
    state.platform = "all";
  }

  container.innerHTML = options
    .map(
      (option) => `
        <button
          type="button"
          class="platform-pill${option.value === state.platform ? " is-active" : ""}"
          data-platform="${option.value}"
          aria-pressed="${option.value === state.platform ? "true" : "false"}"
        >
          ${option.label}
        </button>
      `
    )
    .join("");

  for (const button of container.querySelectorAll("[data-platform]")) {
    button.addEventListener("click", () => {
      state.platform = button.dataset.platform;
      render();
    });
  }
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

    const leftHasData = leftValue > 0;
    const rightHasData = rightValue > 0;

    if (leftHasData && !rightHasData) return -1;
    if (!leftHasData && rightHasData) return 1;

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
    {
      value: "xbox-game-pass",
      label: "Xbox Game Pass",
      icon: '<svg class="service-tab-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M11.967 0a11.972 11.972 0 00-7.398 2.548A10.867 10.867 0 0110.61 5.4c1.236-1.042 3.033-1.06 4.316-.046a10.871 10.871 0 016.143 2.957A11.956 11.956 0 0012.012 0h-.045zM2.57 4.544a11.977 11.977 0 00-2.316 6.136c-.161 2.37.382 4.67 1.554 6.702 1.34-1.921 3.238-3.41 5.474-4.22.457-.168.995.143 1.15.586.13.376-1.55 1.76-2.58 3.518-1.05 1.782-1.465 3.97-.93 5.405 1.107 1.012 2.45 1.745 3.93 2.115a6.45 6.45 0 01-1.39-4.28c0-3.32 2.695-6.015 6.014-6.015a6.017 6.017 0 016.015 6.015 6.48 6.48 0 01-1.303 4.143v-.004c1.558-.383 2.97-.132 4.14-2.181.565-1.474.126-3.692-.958-5.467-1.05-1.728-2.614-3.04-2.522-3.407.13-.539.814-.52 1.185-.434v-.003c2.28.847 4.186 2.368 5.513 4.31 1.253-2.102 1.777-4.502 1.554-6.953-.306-3.235-1.902-6.133-4.322-8.156A11.751 11.751 0 0018.8 3.54a11.517 11.517 0 00-5.83-2.673c-.097.432-.387.795-1.026.795h-.002c-.63 0-.916-.35-1.018-.767a11.556 11.556 0 00-5.885 2.684v.003c-.09.072-.18.147-.27.222.095-.55.617-1.284.617-1.284A11.898 11.898 0 003.5 2.5a11.884 11.884 0 00-.93 2.044z"/></svg>',
    },
    {
      value: "playstation-plus",
      label: "PlayStation Plus",
      icon: '<svg class="service-tab-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12.28 12.394l4.576.01c.219-1.32-.42-1.93-1.636-2.261l-5.619-1.52.002 6.634a3.176 3.176 0 01-2.91 3.488 3.236 3.236 0 01-3.6-3.266c0-1.782 1.4-3.242 3.16-3.242a3.172 3.172 0 011.666.471l1.714-2.222a5.457 5.457 0 00-3.376-1.168 5.418 5.418 0 00-5.467 5.55A5.632 5.632 0 006.591 20.66a5.438 5.438 0 005.474-5.352l.004-9.988 5.385 1.572c2.164.632 4.148 2.016 4.148 3.992l-4.747-.008.005 2.551-.005 13.56-2.57-3.241.002-11.354zM21.6 8.21c-.55-1.424-2.253-2.316-4.58-2.99l-4.755-1.378.002-2.599L18.81 3.16c3.966 1.144 5.378 2.646 5.176 4.496-.037.34-.146.617-.384.802v-.248z"/></svg>',
    },
  ];

  const container = document.getElementById("service-pills");
  container.innerHTML = services
    .map(
      (service) => `
        <button
          type="button"
          class="service-tab${state.service === service.value ? " is-active" : ""}"
          data-service="${service.value}"
          aria-pressed="${state.service === service.value ? "true" : "false"}"
        >
          ${service.icon} ${service.label}
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
    
    // Header row column sorting indicators
    if (button.tagName === "SPAN") {
      const dirText = isActive ? (state.sortDirection === "asc" ? " ↑" : " ↓") : "";
      
      // Preserve "Main Story" label specifically
      let label = button.dataset.sort === "gameplayMain" ? "Main Story" : SORT_LABELS[button.dataset.sort];
      // For column headers, we also have Platform and Title
      if (button.dataset.sort === "name") label = "Game Title";
      
      button.textContent = label + dirText;
      button.style.color = isActive ? "var(--text)" : "var(--muted)";
    } 
    // Button pill sorting styling
    else {
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
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
      
      // Render small tags for column
      const platformTags = splitField(row.platforms)
        .map((platform) => {
          const type = platform.toLowerCase().includes('xbox') ? 'xbox' : 
                       platform.toLowerCase().includes('ps') || platform.toLowerCase().includes('playstation') ? 'ps' : 'pc';
          return `<span class="badge badge-${type}">${platform}</span>`
        })
        .join("");

      return `
        <article class="game-row" ${hltbUrl ? `data-hltb-url="${hltbUrl}"` : ""}>
          <div class="game-row-title">
            <img class="game-art" src="${row.imageUrl}" alt="${row.name}">
            <span class="game-name">${row.name}</span>
          </div>
          <div class="game-row-platforms">
            ${platformTags}
          </div>
          <div class="dur dur-main ${!Number(row.gameplayMain) ? 'dur-none' : ''}">${formatHours(row.gameplayMain)}</div>
          <div class="dur dur-extra ${!Number(row.gameplayMainExtra) ? 'dur-none' : ''}">${formatHours(row.gameplayMainExtra)}</div>
          <div class="dur dur-comp ${!Number(row.gameplayCompletionist) ? 'dur-none' : ''}">${formatHours(row.gameplayCompletionist)}</div>
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
  renderPlatformPills();
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

  document.getElementById("search").addEventListener("input", (event) => {
    state.query = event.target.value;
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

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

const WINDOW_SIZE = 80;

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const state = {
  rows: [],
  query: "",
  service: "playstation-plus",
  platform: "all",
  timeFilter: "any",
  sortBy: "gameplayMain",
  sortDirection: "asc",
  lastDurationSortBy: "gameplayMain",
  metadata: null,
  // Windowing state
  filteredRows: [],
  renderedCount: 0,
  scrollObserver: null,
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

function formatReviewScore(value) {
  const score = Number(value || 0);
  return score ? `${score}%` : "—";
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
      value: "playstation-plus",
      label: "PlayStation Plus",
      icon: '<svg class="service-tab-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z"/></svg>',
    },
    {
      value: "xbox-game-pass",
      label: "Xbox Game Pass",
      icon: '<svg class="service-tab-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912C23.002 17.48 24 14.861 24 12.004c0-3.34-1.365-6.362-3.57-8.536 0 0-.027-.022-.082-.042-.063-.022-.152-.045-.281-.045-.592 0-1.985.434-4.805 3.246zM3.654 3.426c-.057.02-.082.041-.086.042C1.365 5.642 0 8.664 0 12.004c0 2.854.998 5.473 2.661 7.533-1.401-2.605 3.579-9.951 6.08-12.91-2.82-2.813-4.216-3.245-4.806-3.245-.131 0-.223.021-.281.046v-.002zM12 3.551S9.055 1.828 6.755 1.746c-.903-.033-1.454.295-1.521.339C7.379.646 9.659 0 11.984 0H12c2.334 0 4.605.646 6.766 2.085-.068-.046-.615-.372-1.52-.339C14.946 1.828 12 3.545 12 3.545v.006z"/></svg>',
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

function buildRowHtml(row) {
  const hltbUrl = getRowHltbUrl(row);

  const platformTags = splitField(row.platforms)
    .map((platform) => {
      const type = platform.toLowerCase().includes('xbox') ? 'xbox' :
                   platform.toLowerCase().includes('ps') || platform.toLowerCase().includes('playstation') ? 'ps' : 'pc';
      return `<span class="badge badge-${type}">${platform}</span>`;
    })
    .join("");

  return `
    <article class="game-row" ${hltbUrl ? `data-hltb-url="${hltbUrl}"` : ""}>
      <div class="game-row-title">
        <img class="game-art" src="${row.imageUrl}" alt="${row.name}" loading="lazy" decoding="async" onerror="this.style.display='none'">
        <span class="game-name">${row.name}</span>
      </div>
      <div class="game-row-platforms">
        ${platformTags}
      </div>
      <div class="review-score ${!Number(row.reviewScore) ? 'review-none' : ''}">${formatReviewScore(row.reviewScore)}</div>
      <div class="dur dur-main ${!Number(row.gameplayMain) ? 'dur-none' : ''}">${formatHours(row.gameplayMain)}</div>
      <div class="dur dur-extra ${!Number(row.gameplayMainExtra) ? 'dur-none' : ''}">${formatHours(row.gameplayMainExtra)}</div>
      <div class="dur dur-comp ${!Number(row.gameplayCompletionist) ? 'dur-none' : ''}">${formatHours(row.gameplayCompletionist)}</div>
    </article>
  `;
}

function attachRowClickHandlers(container) {
  for (const card of container.querySelectorAll("[data-hltb-url]")) {
    if (card.dataset.clickBound) continue;
    card.dataset.clickBound = "1";
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) {
        return;
      }
      window.open(card.dataset.hltbUrl, "_blank", "noopener,noreferrer");
    });
  }
}

function teardownScrollObserver() {
  if (state.scrollObserver) {
    state.scrollObserver.disconnect();
    state.scrollObserver = null;
  }
  const oldSentinel = document.getElementById("scroll-sentinel");
  if (oldSentinel) oldSentinel.remove();
}

function appendNextWindow() {
  const container = document.getElementById("results-list");
  const rows = state.filteredRows;
  const start = state.renderedCount;
  const end = Math.min(start + WINDOW_SIZE, rows.length);

  if (start >= rows.length) {
    teardownScrollObserver();
    return;
  }

  const fragment = document.createDocumentFragment();
  const temp = document.createElement("div");

  for (let i = start; i < end; i++) {
    temp.innerHTML = buildRowHtml(rows[i]);
    fragment.appendChild(temp.firstElementChild);
  }

  // Remove old sentinel before appending new rows
  const oldSentinel = document.getElementById("scroll-sentinel");
  if (oldSentinel) oldSentinel.remove();

  container.appendChild(fragment);
  state.renderedCount = end;

  attachRowClickHandlers(container);

  // If there are more rows, add a new sentinel
  if (end < rows.length) {
    const sentinel = document.createElement("div");
    sentinel.id = "scroll-sentinel";
    sentinel.style.height = "1px";
    container.appendChild(sentinel);

    if (!state.scrollObserver) {
      state.scrollObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            appendNextWindow();
          }
        },
        { rootMargin: "200px" }
      );
    }
    state.scrollObserver.observe(sentinel);
  } else {
    teardownScrollObserver();
  }
}

function renderResults(rows) {
  const container = document.getElementById("results-list");

  // Tear down any prior windowing
  teardownScrollObserver();

  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">No titles matched the current filters.</div>';
    state.filteredRows = [];
    state.renderedCount = 0;
    return;
  }

  // Reset container and windowing state
  container.innerHTML = "";
  state.filteredRows = rows;
  state.renderedCount = 0;

  // Render the first window
  appendNextWindow();
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

  document.getElementById("search").addEventListener(
    "input",
    debounce((event) => {
      state.query = event.target.value;
      render();
    }, 120)
  );

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

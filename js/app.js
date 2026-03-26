const DATA_MANIFEST_FILE = "./data/catalog-manifest.json";
const DATA_JSON_FALLBACK_FILE = "./data/catalog.json";
const DATA_CSV_FALLBACK_FILE = "./data/list.csv";
const METADATA_FILE = "./data/metadata.json";
const DATASET_CACHE_STORAGE_KEY = "beatable.catalog.dataset.v1";
const MANIFEST_CACHE_STORAGE_KEY = "beatable.catalog.manifest.v1";
const DATASET_CACHE_META_STORAGE_KEY = "beatable.catalog.cache-meta.v1";
const USER_STATE_STORAGE_KEY = "beatable.user-state.v1";

const SORT_LABELS = {
  gameplayMain: "Main Story",
  gameplayMainExtra: "Main + Extra",
  gameplayCompletionist: "Completionist",
  reviewScore: "Review",
  name: "Title",
};

const LENGTH_FILTERS = [
  { value: "all", label: "All Lengths", compactLabel: "All" },
  { value: "under_5_hours", label: "Under 5h", compactLabel: "<5h" },
  { value: "between_5_and_10_hours", label: "5-10h", compactLabel: "5-10h" },
  { value: "over_10_hours", label: "Over 10h", compactLabel: ">10h" },
];

const LIST_STATUS_OPTIONS = [
  { value: "", label: "Add to list" },
  { value: "want_to_play", label: "Want to Play" },
  { value: "playing", label: "Playing" },
  { value: "completed", label: "Completed" },
];

const LIST_STATUS_LABELS = {
  want_to_play: "Want to Play",
  playing: "Playing",
  completed: "Completed",
};

const WINDOW_SIZE = 60;
const REMOTE_MANIFEST_URL = "https://xatpy.github.io/beatable/data/catalog-manifest.json";

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function isBundledAppRuntime() {
  return /^(capacitor|ionic|file):$/i.test(window.location.protocol);
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatHours(value) {
  const hours = Number(value || 0);
  return hours ? `${hours}h` : "—";
}

function formatReviewScore(value) {
  const score = Number(value || 0);
  return score ? `${score}%` : "—";
}

function getRowHltbUrl(row) {
  return row?.hltbId ? `https://howlongtobeat.com/game/${row.hltbId}` : "";
}

function formatDate(value) {
  if (!value) return "Unknown";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function getActiveSortLabel() {
  return SORT_LABELS[state.sortBy] || "Main Story";
}

function isCompactMobileLayout() {
  return window.matchMedia("(max-width: 640px)").matches;
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

function persistCurrentFilters() {
  state.userState.savedFilters = sanitizeSavedFilters({
    query: state.query,
    service: state.service,
    lengthBucket: state.lengthBucket,
    platform: state.platform,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
  });
  persistUserState();
}

function getComparableValue(row, field) {
  if (field === "name") {
    return String(row.name || "");
  }

  const numeric = Number(row[field] || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getFallbackGameKey(row) {
  const parts = [
    row.serviceKey || "",
    row.hltbId || "",
    row.productUrl || "",
    normalize(row.name),
  ];
  return parts.join("::");
}

function getGameKey(row) {
  return String(row?.productId || "").trim() || getFallbackGameKey(row);
}

function createDefaultUserState() {
  return {
    games: {},
    savedFilters: {
      query: "",
      service: "playstation-plus",
      lengthBucket: "all",
      platform: "all",
      sortBy: "gameplayMain",
      sortDirection: "asc",
    },
  };
}

function sanitizeListStatus(value) {
  return LIST_STATUS_LABELS[value] ? value : null;
}

function sanitizeSavedFilters(filters) {
  return {
    query: typeof filters?.query === "string" ? filters.query.slice(0, 120) : "",
    service: filters?.service === "xbox-game-pass" ? "xbox-game-pass" : "playstation-plus",
    lengthBucket: LENGTH_FILTERS.some((filter) => filter.value === filters?.lengthBucket) ? filters.lengthBucket : "all",
    platform: typeof filters?.platform === "string" && filters.platform.trim() ? filters.platform : "all",
    sortBy: SORT_LABELS[filters?.sortBy] ? filters.sortBy : "gameplayMain",
    sortDirection: filters?.sortDirection === "desc" ? "desc" : "asc",
  };
}

function normalizeUserGameState(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const normalized = {
    listStatus: sanitizeListStatus(entry.listStatus),
    isFavorite: Boolean(entry.isFavorite),
    isHidden: Boolean(entry.isHidden),
    updatedAt: Number(entry.updatedAt) || Date.now(),
  };

  if (!normalized.listStatus && !normalized.isFavorite && !normalized.isHidden) {
    return null;
  }

  return normalized;
}

function readPersistedUserState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_STATE_STORAGE_KEY) || "null");
    const nextState = createDefaultUserState();

    if (!parsed || typeof parsed !== "object") {
      return nextState;
    }

    if (parsed.games && typeof parsed.games === "object") {
      for (const [key, value] of Object.entries(parsed.games)) {
        const normalized = normalizeUserGameState(value);
        if (normalized) {
          nextState.games[key] = normalized;
        }
      }
    }

    nextState.savedFilters = sanitizeSavedFilters(parsed.savedFilters);
    return nextState;
  } catch {
    return createDefaultUserState();
  }
}

function persistUserState() {
  try {
    localStorage.setItem(USER_STATE_STORAGE_KEY, JSON.stringify(state.userState));
  } catch {
    // Ignore storage failures and keep the session state live in memory.
  }
}

function getUserGameState(key) {
  return state.userState.games[key] || null;
}

function updateUserGameState(key, updates) {
  if (!key) return;

  const current = getUserGameState(key) || {
    listStatus: null,
    isFavorite: false,
    isHidden: false,
    updatedAt: Date.now(),
  };

  const next = normalizeUserGameState({
    ...current,
    ...updates,
    updatedAt: Date.now(),
  });

  if (next) {
    state.userState.games[key] = next;
  } else {
    delete state.userState.games[key];
  }

  persistUserState();
  render();
}

function setListStatus(key, status) {
  const current = getUserGameState(key);
  const nextStatus = sanitizeListStatus(status);
  updateUserGameState(key, { listStatus: nextStatus });

  if (!current?.listStatus && nextStatus) {
    showToast("Added to your list");
  } else if (current?.listStatus !== nextStatus && nextStatus) {
    showToast("Status updated");
  }
}

function removeFromList(key) {
  const current = getUserGameState(key);
  if (!current?.listStatus) {
    return;
  }

  updateUserGameState(key, { listStatus: null });
  showToast("Removed from your list");
}

function toggleFavorite(key) {
  const current = getUserGameState(key);
  updateUserGameState(key, { isFavorite: !current?.isFavorite });
  showToast(current?.isFavorite ? "Removed from favorites" : "Added to favorites");
}

function hideGame(key) {
  updateUserGameState(key, { isHidden: true });
  showToast("Game hidden");
}

function unhideGame(key) {
  updateUserGameState(key, { isHidden: false });
  showToast("Game restored");
}

function saveFilters(filters) {
  state.userState.savedFilters = sanitizeSavedFilters(filters);
  persistUserState();
  state.savedFiltersMessage = "Filters saved on this device";
  render();

  window.clearTimeout(state.savedFiltersMessageTimer);
  state.savedFiltersMessageTimer = window.setTimeout(() => {
    state.savedFiltersMessage = "";
    render();
  }, 2200);
}

function getLibraryCounts() {
  const collections = getLibraryCollections();
  return {
    saved: collections.myList.length + collections.completed.length,
    favorites: collections.favorites.length,
    completed: collections.completed.length,
    hidden: collections.hidden.length,
    totalManaged: Object.keys(state.userState.games).length,
  };
}

function hasPersonalData() {
  return getLibraryCounts().totalManaged > 0;
}

function renderToast() {
  const node = document.getElementById("toast");

  if (!state.toastMessage) {
    node.hidden = true;
    node.textContent = "";
    node.classList.remove("is-visible");
    return;
  }

  node.textContent = state.toastMessage;
  node.hidden = false;
  node.classList.add("is-visible");
}

function showToast(message) {
  state.toastMessage = message;
  renderToast();

  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    state.toastMessage = "";
    renderToast();
  }, 1800);
}

function getLibraryCollections() {
  const items = Object.entries(state.userState.games)
    .map(([key, entry]) => {
      const row = state.rowsByKey.get(key);
      if (!row) {
        return null;
      }

      return { key, row, entry };
    })
    .filter(Boolean)
    .sort((left, right) => (right.entry.updatedAt || 0) - (left.entry.updatedAt || 0));

  return {
    myList: items.filter((item) => item.entry.listStatus === "want_to_play" || item.entry.listStatus === "playing"),
    favorites: items.filter((item) => item.entry.isFavorite),
    completed: items.filter((item) => item.entry.listStatus === "completed"),
    hidden: items.filter((item) => item.entry.isHidden),
  };
}

function getPlatformOptions() {
  const scopedRows = state.rows.filter((row) => row.serviceKey === state.service);
  const values = [...new Set(scopedRows.flatMap((row) => splitField(row.platforms)))].sort((left, right) =>
    left.localeCompare(right)
  );

  return [{ value: "all", label: "All Platforms" }, ...values.map((value) => ({ value, label: value }))];
}

function getCurrentFilterSignature() {
  return JSON.stringify({
    query: state.query,
    service: state.service,
    lengthBucket: state.lengthBucket,
    platform: state.platform,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
  });
}

function getSavedFilterSignature() {
  return JSON.stringify(state.userState.savedFilters);
}

function rowMatchesLengthFilter(row) {
  if (state.lengthBucket === "all") {
    return true;
  }

  const value = Number(row[getActiveTimeFilterField()] || 0);
  if (!value) {
    return false;
  }

  if (state.lengthBucket === "under_5_hours") {
    return value < 5;
  }

  if (state.lengthBucket === "between_5_and_10_hours") {
    return value >= 5 && value <= 10;
  }

  if (state.lengthBucket === "over_10_hours") {
    return value > 10;
  }

  return true;
}

function getBrowseRows() {
  const query = normalize(state.query);

  const filtered = state.rows.filter((row) => {
    const key = getGameKey(row);
    const userGame = getUserGameState(key);

    if (row.serviceKey !== state.service) {
      return false;
    }

    if (userGame?.isHidden) {
      return false;
    }

    if (query && !normalize(row.name).includes(query)) {
      return false;
    }

    if (state.platform !== "all" && !splitField(row.platforms).includes(state.platform)) {
      return false;
    }

    if (!rowMatchesLengthFilter(row)) {
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

function renderMetadata() {
  const node = document.getElementById("last-updated");
  const rawValue = state.metadata?.generated || state.metadata?.generatedAt;

  if (!rawValue) {
    node.hidden = true;
    node.textContent = "";
    return;
  }

  const formatted = /\d{4}-\d{2}-\d{2}T/.test(rawValue)
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(rawValue))
    : rawValue;

  node.textContent = `Last updated: ${formatted}`;
  node.hidden = false;
}

function renderBrowseLibrarySummary() {
  const counts = getLibraryCounts();
  const node = document.getElementById("browse-library-stats");
  if (!node) return;
  node.textContent = counts.totalManaged
    ? `${counts.saved} saved · ${counts.favorites} favorites · ${counts.completed} completed`
    : "Save games to your list as you browse";
}

function renderPrimaryNav() {
  const tabs = [
    { value: "browse", label: "Browse" },
    { value: "library", label: "My Library" },
  ];

  const markup = tabs
    .map(
      (tab) => `
        <button
          type="button"
          class="primary-nav-button${state.currentTab === tab.value ? " is-active" : ""}"
          data-action="switch-tab"
          data-tab="${tab.value}"
          aria-pressed="${state.currentTab === tab.value ? "true" : "false"}"
        >
          ${tab.label}
        </button>
      `
    )
    .join("");

  for (const container of [document.getElementById("header-nav"), document.getElementById("primary-nav")]) {
    if (container) {
      container.innerHTML = markup;
    }
  }
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
      const availablePlatforms = getPlatformOptions().map((option) => option.value);
      if (!availablePlatforms.includes(state.platform)) {
        state.platform = "all";
      }
      persistCurrentFilters();
      render();
    });
  }
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
          data-platform="${escapeHtml(option.value)}"
          aria-pressed="${option.value === state.platform ? "true" : "false"}"
        >
          ${escapeHtml(option.label)}
        </button>
      `
    )
    .join("");

  for (const button of container.querySelectorAll("[data-platform]")) {
    button.addEventListener("click", () => {
      state.platform = button.dataset.platform;
      persistCurrentFilters();
      render();
    });
  }
}

function renderLengthFilters() {
  const container = document.getElementById("length-pills");
  const compactLabels = isCompactMobileLayout();
  container.innerHTML = LENGTH_FILTERS
    .map(
      (filter) => `
        <button
          type="button"
          class="time-pill${state.lengthBucket === filter.value ? " is-active" : ""}"
          data-length-filter="${filter.value}"
          aria-pressed="${state.lengthBucket === filter.value ? "true" : "false"}"
        >
          ${compactLabels ? filter.compactLabel : filter.label}
        </button>
      `
    )
    .join("");

  for (const button of container.querySelectorAll("[data-length-filter]")) {
    button.addEventListener("click", () => {
      state.lengthBucket = button.dataset.lengthFilter;
      persistCurrentFilters();
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

function renderFiltersFooter() {
  const node = document.getElementById("filters-status");
  const hasActiveFilters = state.platform !== "all" || state.lengthBucket !== "all";
  node.hidden = !hasActiveFilters;
}

function renderSummary(rows) {
  const activeService = getActiveServiceMeta();
  const hiddenCount = state.rows.filter((row) => row.serviceKey === state.service && getUserGameState(getGameKey(row))?.isHidden).length;
  document.getElementById("results-count").textContent = `${rows.length} games`;
  document.getElementById("results-context").innerHTML = hiddenCount
    ? `
      <span>${activeService.short} · ${getActiveSortLabel()}</span>
      <button type="button" class="hidden-link" data-action="open-hidden">· ${hiddenCount} hidden</button>
    `
    : `<span>${activeService.short} · ${getActiveSortLabel()}</span>`;
  const statusNode = document.getElementById("results-status");
  if (state.catalogStatus) {
    statusNode.textContent = state.catalogStatus;
    statusNode.hidden = false;
  } else {
    statusNode.textContent = "";
    statusNode.hidden = true;
  }
}

function getPlatformBadgeType(platform) {
  const value = platform.toLowerCase();
  if (value.includes("xbox")) return "xbox";
  if (value.includes("ps") || value.includes("playstation")) return "ps";
  return "pc";
}

function buildPlatformTags(row) {
  return splitField(row.platforms)
    .map((platform) => `<span class="badge badge-${getPlatformBadgeType(platform)}">${escapeHtml(platform)}</span>`)
    .join("");
}

function buildGameStateChips(entry) {
  if (!entry) {
    return '<span class="state-chip state-chip-neutral">Not saved</span>';
  }

  const chips = [];
  if (entry.listStatus) {
    chips.push(`<span class="state-chip state-chip-status">${escapeHtml(LIST_STATUS_LABELS[entry.listStatus])}</span>`);
  }
  if (entry.isFavorite) {
    chips.push('<span class="state-chip state-chip-favorite">Favorite</span>');
  }
  if (entry.isHidden) {
    chips.push('<span class="state-chip state-chip-hidden">Hidden</span>');
  }

  if (!chips.length) {
    chips.push('<span class="state-chip state-chip-neutral">Not saved</span>');
  }

  return chips.join("");
}

function buildStatusSelect(key, entry, className = "", config = {}) {
  const value = entry?.listStatus || "";
  const optionMarkup = LIST_STATUS_OPTIONS
    .map(
      (option) =>
        `<option value="${option.value}"${option.value === value ? " selected" : ""}>${escapeHtml(option.label)}</option>`
    )
    .join("");
  const hint = config.onboarding ? '<span class="status-select-hint">Start your list</span>' : "";
  const onboardingClass = config.onboarding ? " is-onboarding" : "";

  return `
    <label class="status-select ${className}${onboardingClass}">
      <span class="sr-only">Set list status</span>
      <select data-action="set-status" data-game-key="${escapeHtml(key)}">
        ${optionMarkup}
      </select>
      ${hint}
    </label>
  `;
}

function buildMetricsHtml(row) {
  return `
    <div class="metric-chip">
      <span class="metric-label">Review</span>
      <strong class="metric-value">${escapeHtml(formatReviewScore(row.reviewScore))}</strong>
    </div>
    <div class="metric-chip">
      <span class="metric-label">Main</span>
      <strong class="metric-value metric-main">${escapeHtml(formatHours(row.gameplayMain))}</strong>
    </div>
    <div class="metric-chip">
      <span class="metric-label">Main + Extra</span>
      <strong class="metric-value metric-extra">${escapeHtml(formatHours(row.gameplayMainExtra))}</strong>
    </div>
    <div class="metric-chip">
      <span class="metric-label">Completionist</span>
      <strong class="metric-value metric-comp">${escapeHtml(formatHours(row.gameplayCompletionist))}</strong>
    </div>
  `;
}

function buildDurationChips(row) {
  const chips = [
    { key: "reviewScore", label: "Review", value: formatReviewScore(row.reviewScore), tone: "metric-review" },
    { key: "gameplayMain", label: "Main", value: formatHours(row.gameplayMain), tone: "metric-main" },
    { key: "gameplayMainExtra", label: "Extra", value: formatHours(row.gameplayMainExtra), tone: "metric-extra" },
    { key: "gameplayCompletionist", label: "100%", value: formatHours(row.gameplayCompletionist), tone: "metric-comp" },
  ];

  return chips
    .map((chip) => {
      const activeClass = chip.key === getActiveTimeFilterField() ? " is-active" : "";
      return `
        <span class="duration-chip ${chip.tone}${activeClass}">
          <span class="duration-chip-label">${chip.label}</span>
          <strong>${chip.value}</strong>
        </span>
      `;
    })
    .join("");
}

function getActiveSortRowValue(row) {
  if (state.sortBy === "reviewScore") {
    return {
      label: "Review",
      text: formatReviewScore(row.reviewScore),
      tone: Number(row.reviewScore) ? "metric-review" : "metric-muted",
    };
  }

  const value = formatHours(row[state.sortBy]);
  let tone = "metric-muted";
  if (state.sortBy === "gameplayMain" && value !== "—") tone = "metric-main";
  if (state.sortBy === "gameplayMainExtra" && value !== "—") tone = "metric-extra";
  if (state.sortBy === "gameplayCompletionist" && value !== "—") tone = "metric-comp";

  return {
    label: getActiveSortLabel(),
    text: value,
    tone,
  };
}

function getRowStatusIcon(entry) {
  if (entry?.isFavorite) {
    return {
      className: "status-icon-favorite",
      svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 17.27 5.18 3.05-1.38-5.88 4.57-3.96-6.02-.51L12 4.5 9.65 9.97l-6.02.51 4.57 3.96-1.38 5.88z"/></svg>',
    };
  }

  if (entry?.listStatus === "completed") {
    return {
      className: "status-icon-complete",
      svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.1 14.4-4-4 1.4-1.4 2.6 2.6 5.2-5.2 1.4 1.4Z"/></svg>',
    };
  }

  if (entry?.listStatus === "playing") {
    return {
      className: "status-icon-playing",
      svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-2.5 14.5v-9l7 4.5Z"/></svg>',
    };
  }

  if (entry?.listStatus === "want_to_play") {
    return {
      className: "status-icon-bookmark",
      svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z"/></svg>',
    };
  }

  return {
    className: "status-icon-empty",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5h12a1 1 0 0 1 1 1V20l-7-4-7 4V5.5a1 1 0 0 1 1-1z"/></svg>',
  };
}

function buildGameInitial(row) {
  return escapeHtml(String(row.name || "?").trim().charAt(0).toUpperCase() || "?");
}

function buildBrowseCardHtml(row) {
  const key = getGameKey(row);
  const entry = getUserGameState(key);
  const platformTags = buildPlatformTags(row);
  const stateChips = [];
  if (entry?.listStatus) {
    stateChips.push(`<span class="state-chip state-chip-status">${escapeHtml(LIST_STATUS_LABELS[entry.listStatus])}</span>`);
  }
  if (entry?.isFavorite) {
    stateChips.push('<span class="state-chip state-chip-favorite">Favorite</span>');
  }
  const imageMarkup = row.imageUrl
    ? `<img class="game-art game-art-row" src="${escapeHtml(row.imageUrl)}" alt="${escapeHtml(row.name)}" loading="lazy" decoding="async" onerror="this.outerHTML=createBrowseArtFallback(this.alt)">`
    : createBrowseArtFallback(row.name);

  return `
    <article class="browse-card" data-game-key="${escapeHtml(key)}">
      <div class="browse-card-main" data-action="open-detail" data-game-key="${escapeHtml(key)}">
        ${imageMarkup}
        <div class="browse-card-copy">
          <div class="browse-card-heading">
            <h3 class="game-name">${escapeHtml(row.name)}</h3>
            ${stateChips.length ? `<div class="game-state-chips">${stateChips.join("")}</div>` : ""}
          </div>
          <div class="browse-card-platforms">${platformTags}</div>
        </div>
      </div>
      <div class="browse-card-metric">
        <span class="browse-card-metric-label">Review</span>
        <strong class="browse-card-metric-value metric-review">${formatReviewScore(row.reviewScore)}</strong>
      </div>
      <div class="browse-card-metric">
        <span class="browse-card-metric-label">Main</span>
        <strong class="browse-card-metric-value metric-main">${formatHours(row.gameplayMain)}</strong>
      </div>
      <div class="browse-card-metric">
        <span class="browse-card-metric-label">Extra</span>
        <strong class="browse-card-metric-value metric-extra">${formatHours(row.gameplayMainExtra)}</strong>
      </div>
      <div class="browse-card-metric">
        <span class="browse-card-metric-label">100%</span>
        <strong class="browse-card-metric-value metric-comp">${formatHours(row.gameplayCompletionist)}</strong>
      </div>
      <div class="browse-card-actions">
        <button type="button" class="action-button action-button-list" data-action="open-list-menu" data-game-key="${escapeHtml(key)}">+ List</button>
        <button type="button" class="icon-toggle-button${entry?.isFavorite ? " is-active" : ""}" data-action="toggle-favorite" data-game-key="${escapeHtml(key)}" aria-label="${entry?.isFavorite ? "Unfavorite game" : "Favorite game"}">
          <svg viewBox="0 0 24 24" fill="${entry?.isFavorite ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 17.27 5.18 3.05-1.38-5.88 4.57-3.96-6.02-.51L12 4.5 9.65 9.97l-6.02.51 4.57 3.96-1.38 5.88z"/></svg>
        </button>
        <button type="button" class="icon-toggle-button" data-action="open-overflow" data-game-key="${escapeHtml(key)}" aria-label="More options">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
        </button>
      </div>
    </article>
  `;
}

function createBrowseArtFallback(name) {
  return `<div class="game-art game-art-row game-art-placeholder" aria-hidden="true">${escapeHtml(String(name || "?").trim().charAt(0).toUpperCase() || "?")}</div>`;
}

async function openExternalUrl(url) {
  if (!url) {
    return false;
  }

  try {
    const browserPlugin = window.Capacitor?.Plugins?.Browser;
    if (browserPlugin?.open) {
      await browserPlugin.open({ url });
      return true;
    }
  } catch {
    // Fall through to the standard browser behavior.
  }

  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (popup) {
    return true;
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.click();
  return true;
}

function buildLibraryCardHtml(item) {
  const { key, row, entry } = item;
  const favoriteLabel = entry?.isFavorite ? "Favorited" : "Favorite";
  const hideLabel = entry?.isHidden ? "Restore" : "Hide";
  return `
    <article class="library-card" data-game-key="${escapeHtml(key)}">
      <div class="library-card-main">
        <img class="game-art" src="${escapeHtml(row.imageUrl)}" alt="${escapeHtml(row.name)}" loading="lazy" decoding="async" onerror="this.style.display='none'">
        <div class="library-card-copy">
          <div class="game-state-chips">${buildGameStateChips(entry)}</div>
          <h3 class="game-name">${escapeHtml(row.name)}</h3>
          <p class="library-card-meta">${escapeHtml(row.service)} · ${escapeHtml(splitField(row.platforms).join(", ") || "Platform unknown")}</p>
        </div>
      </div>
      <div class="library-card-actions">
        ${buildStatusSelect(key, entry, "status-select-small")}
        <button type="button" class="action-button action-button-favorite${entry?.isFavorite ? " is-active" : ""}" data-action="toggle-favorite" data-game-key="${escapeHtml(key)}" aria-label="${entry?.isFavorite ? "Remove favorite" : "Add favorite"}">
          <span class="action-button-icon">★</span>
          <span>${favoriteLabel}</span>
        </button>
        <button type="button" class="action-button" data-action="${entry?.isHidden ? "unhide" : "hide"}" data-game-key="${escapeHtml(key)}">
          ${hideLabel}
        </button>
      </div>
    </article>
  `;
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

  for (let index = start; index < end; index += 1) {
    temp.innerHTML = buildBrowseCardHtml(rows[index]);
    fragment.appendChild(temp.firstElementChild);
  }

  const oldSentinel = document.getElementById("scroll-sentinel");
  if (oldSentinel) oldSentinel.remove();

  container.appendChild(fragment);
  state.renderedCount = end;

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
  teardownScrollObserver();

  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">No titles matched the current filters. Hidden games can be restored from My Library.</div>';
    state.filteredRows = [];
    state.renderedCount = 0;
    return;
  }

  container.innerHTML = "";
  state.filteredRows = rows;
  state.renderedCount = 0;
  appendNextWindow();
}

function renderLibrary() {
  const stats = document.getElementById("library-stats");
  const sectionsContainer = document.getElementById("library-sections");
  const collections = getLibraryCollections();
  const counts = getLibraryCounts();
  const statsHtml = [
    {
      label: "My List",
      value: collections.myList.length,
      tone: "library-stat-list",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    },
    {
      label: "Favorites",
      value: collections.favorites.length,
      tone: "library-stat-favorites",
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21 3.8 12.8a5.5 5.5 0 0 1 7.8-7.8L12 5.4l.4-.4a5.5 5.5 0 0 1 7.8 7.8z"/></svg>',
    },
    {
      label: "Completed",
      value: collections.completed.length,
      tone: "library-stat-completed",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.2 4.2L19 6.5"/></svg>',
    },
    {
      label: "Hidden",
      value: collections.hidden.length,
      tone: "library-stat-hidden",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3 21 21"/><path d="M10.7 10.7a3 3 0 0 0 4.2 4.2"/><path d="M9.9 5.1A10.9 10.9 0 0 1 12 5c5.5 0 9.5 4.3 10.8 7-.5.9-1.4 2.1-2.7 3.3"/><path d="M6.2 6.3C3.8 8 2.3 10.3 1.2 12c1.1 1.8 4.7 7 10.8 7 1.7 0 3.2-.3 4.5-.8"/></svg>',
    },
  ]
    .map(
      (item) => `
        <div class="library-stat ${item.tone}">
          <span class="library-stat-icon" aria-hidden="true">${item.icon}</span>
          <strong>${item.value}</strong>
          <span>${item.label}</span>
        </div>
      `
    )
    .join("");

  stats.innerHTML = statsHtml;

  if (!counts.totalManaged) {
    sectionsContainer.innerHTML = `
      <section class="library-empty-state">
        <h3>Your personal game list</h3>
        <p>Save games to decide what to play next. Everything stays on your device.</p>
        <button type="button" class="ghost-button" data-action="switch-tab" data-tab="browse">Browse games</button>
      </section>
    `;
    return;
  }

  const sectionConfigs = [
    { key: "my-list", title: "My List", empty: "No saved games yet.", items: collections.myList, className: "library-section-featured" },
    { key: "favorites", title: "Favorites", empty: "Favorite games to keep them handy.", items: collections.favorites },
    { key: "completed", title: "Completed", empty: "Completed games will appear here.", items: collections.completed },
    { key: "hidden", title: "Hidden", empty: "Hidden games can be restored anytime.", items: collections.hidden },
  ];

  sectionsContainer.innerHTML = `
    <div class="library-sections-grid">
      ${sectionConfigs
        .filter((section) => section.items.length || section.key !== "hidden")
    .map((section) => {
      const cards = section.items.length
        ? section.items.map((item) => buildLibraryCardHtml(item)).join("")
        : `<div class="empty-state empty-state-inline">${section.empty}</div>`;

      return `
        <section class="library-section${section.className ? ` ${section.className}` : ""}" id="library-section-${section.key}">
          <div class="library-section-header">
            <h3>${section.title}</h3>
            <span>${section.items.length}</span>
          </div>
          <div class="library-grid">
            ${cards}
          </div>
        </section>
      `;
    })
    .join("")}
    </div>
  `;
}

function renderActionSheet() {
  const sheet = document.getElementById("action-sheet");
  const content = document.getElementById("action-sheet-content");

  if (!state.actionSheetGameKey) {
    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
    content.innerHTML = "";
    return;
  }

  const row = state.rowsByKey.get(state.actionSheetGameKey);
  if (!row) {
    state.actionSheetGameKey = "";
    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
    content.innerHTML = "";
    return;
  }

  const entry = getUserGameState(state.actionSheetGameKey);
  const hltbUrl = getRowHltbUrl(row);
  const statusRows = LIST_STATUS_OPTIONS.filter((option) => option.value).map((option) => {
    const selected = entry?.listStatus === option.value;
    return `
      <button type="button" class="sheet-action-row" data-action="sheet-set-status" data-status="${option.value}" data-game-key="${escapeHtml(state.actionSheetGameKey)}">
        <span>${option.label}</span>
        <span class="sheet-check">${selected ? "✓" : ""}</span>
      </button>
    `;
  }).join("");
  const isListMenu = state.actionSheetMode === "list";

  content.innerHTML = isListMenu
    ? `
      <div class="action-sheet-header">
        <h3 id="action-sheet-title">${escapeHtml(row.name)}</h3>
      </div>
      <div class="sheet-section">
        ${statusRows}
        ${entry?.listStatus ? `
          <button type="button" class="sheet-action-row sheet-action-row-destructive" data-action="sheet-remove-list" data-game-key="${escapeHtml(state.actionSheetGameKey)}">
            <span>Remove from list</span>
          </button>
        ` : ""}
      </div>
      <button type="button" class="sheet-cancel-button" data-action="close-actions">Cancel</button>
    `
    : `
      <div class="action-sheet-header">
        <h3 id="action-sheet-title">${escapeHtml(row.name)}</h3>
      </div>
      <div class="sheet-section">
        <button type="button" class="sheet-action-row sheet-action-row-destructive" data-action="sheet-hide" data-game-key="${escapeHtml(state.actionSheetGameKey)}">
          <span>Hide game</span>
        </button>
        ${hltbUrl ? `
          <button type="button" class="sheet-action-row" data-action="sheet-open-hltb" data-game-key="${escapeHtml(state.actionSheetGameKey)}">
            <span>View on HowLongToBeat ↗</span>
          </button>
        ` : ""}
      </div>
      <button type="button" class="sheet-cancel-button" data-action="close-actions">Cancel</button>
    `;

  sheet.hidden = false;
  sheet.setAttribute("aria-hidden", "false");
}

function renderDetailSheet() {
  const sheet = document.getElementById("detail-sheet");
  const content = document.getElementById("detail-content");

  if (!state.selectedGameKey) {
    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
    content.innerHTML = "";
    return;
  }

  const row = state.rowsByKey.get(state.selectedGameKey);
  if (!row) {
    state.selectedGameKey = "";
    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
    content.innerHTML = "";
    return;
  }

  const entry = getUserGameState(state.selectedGameKey);
  const metadata = [
    { label: "Service", value: row.service },
    { label: "Platforms", value: splitField(row.platforms).join(", ") || "Unknown" },
    { label: "Tier", value: row.tier || "Included" },
    { label: "Catalog", value: row.catalogTypes || "Catalog" },
    { label: "Release", value: formatDate(row.releaseDate) },
    { label: "Streaming", value: row.streamingSupported ? (row.streamingSupported === "true" ? "Supported" : "Not listed") : "Not listed" },
  ]
    .map(
      (item) => `
        <div class="detail-meta-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `
    )
    .join("");

  content.innerHTML = `
    <div class="detail-header">
      <button type="button" class="detail-close" data-action="close-detail" aria-label="Close details">Close</button>
    </div>
    <div class="detail-hero">
      <img class="detail-art" src="${escapeHtml(row.imageUrl)}" alt="${escapeHtml(row.name)}" loading="lazy" decoding="async" onerror="this.style.display='none'">
      <div class="detail-copy">
        <p class="library-kicker">${escapeHtml(row.service)}</p>
        <h2 id="detail-title">${escapeHtml(row.name)}</h2>
        <div class="game-state-chips">${buildGameStateChips(entry)}</div>
      </div>
    </div>
    <div class="detail-metrics">
      ${buildMetricsHtml(row)}
    </div>
    <div class="detail-actions">
      ${buildStatusSelect(state.selectedGameKey, entry)}
      <button type="button" class="action-button action-button-favorite${entry?.isFavorite ? " is-active" : ""}" data-action="toggle-favorite" data-game-key="${escapeHtml(state.selectedGameKey)}" aria-label="${entry?.isFavorite ? "Remove favorite" : "Add favorite"}">
        <span class="action-button-icon">★</span>
        <span>${entry?.isFavorite ? "Favorited" : "Favorite"}</span>
      </button>
      <button type="button" class="action-button" data-action="${entry?.isHidden ? "unhide" : "hide"}" data-game-key="${escapeHtml(state.selectedGameKey)}">
        ${entry?.isHidden ? "Restore" : "Hide"}
      </button>
    </div>
    <div class="detail-meta">
      ${metadata}
    </div>
  `;

  sheet.hidden = false;
  sheet.setAttribute("aria-hidden", "false");
}

function renderBrowse() {
  const browseScreen = document.getElementById("browse-screen");
  const libraryScreen = document.getElementById("library-screen");
  browseScreen.hidden = state.currentTab !== "browse";
  libraryScreen.hidden = state.currentTab !== "library";

  renderBrowseLibrarySummary();
  renderServiceToggle();
  renderPlatformPills();
  renderLengthFilters();
  renderSortTabs();
  renderFiltersFooter();

  const rows = getBrowseRows();
  renderSummary(rows);
  renderResults(rows);
}

function render() {
  renderPrimaryNav();
  renderBrowse();
  renderLibrary();
  renderDetailSheet();
  renderActionSheet();
  renderToast();
}

function setSort(column) {
  if (state.sortBy === column) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortBy = column;
    state.sortDirection = column === "reviewScore" ? "desc" : "asc";
    if (isDurationSortField(column)) {
      state.lastDurationSortBy = column;
    }
  }

  persistCurrentFilters();
  render();
}

async function loadCsvData() {
  const response = await fetch(DATA_CSV_FALLBACK_FILE);
  if (!response.ok) {
    throw new Error(`Failed to load ${DATA_CSV_FALLBACK_FILE}`);
  }
  return parseCsv(await response.text());
}

async function fetchJsonFile(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json();
}

function resolveDataUrl(target, base) {
  if (!target) {
    return "";
  }

  try {
    return new URL(target, base || window.location.href).href;
  } catch {
    return target;
  }
}

function readCachedCatalogData() {
  try {
    const cacheMeta = JSON.parse(localStorage.getItem(DATASET_CACHE_META_STORAGE_KEY) || "null");
    const manifest = JSON.parse(localStorage.getItem(MANIFEST_CACHE_STORAGE_KEY) || "null");
    const dataset = JSON.parse(localStorage.getItem(DATASET_CACHE_STORAGE_KEY) || "null");

    if (!cacheMeta || !manifest || !dataset || !Array.isArray(dataset.games)) {
      return null;
    }

    return {
      version: cacheMeta.version || manifest.version || dataset.version || "",
      downloadedAt: cacheMeta.downloadedAt || "",
      rows: dataset.games,
      metadata: manifest,
    };
  } catch {
    return null;
  }
}

function writeCachedCatalogData(manifest, dataset) {
  try {
    localStorage.setItem(
      DATASET_CACHE_META_STORAGE_KEY,
      JSON.stringify({
        version: manifest.version || dataset.version || "",
        downloadedAt: new Date().toISOString(),
      })
    );
    localStorage.setItem(MANIFEST_CACHE_STORAGE_KEY, JSON.stringify(manifest));
    localStorage.setItem(DATASET_CACHE_STORAGE_KEY, JSON.stringify(dataset));
  } catch {
    // Ignore storage quota or availability issues; network and bundled fallbacks still work.
  }
}

function validateDatasetPayload(dataset, manifest) {
  return Boolean(
    dataset &&
    Array.isArray(dataset.games) &&
    (!manifest?.version || !dataset.version || manifest.version === dataset.version)
  );
}

function compareCatalogVersions(left, right) {
  const a = String(left || "").trim();
  const b = String(right || "").trim();

  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  const timestampPattern = /^\d{8}T\d{6}Z$/;
  if (timestampPattern.test(a) && timestampPattern.test(b)) {
    return a.localeCompare(b);
  }

  const semverPattern = /^(\d+)\.(\d+)(?:\.(\d+))?$/;
  const aMatch = a.match(semverPattern);
  const bMatch = b.match(semverPattern);
  if (aMatch && bMatch) {
    for (let index = 1; index <= 3; index += 1) {
      const diff = Number(aMatch[index] || 0) - Number(bMatch[index] || 0);
      if (diff !== 0) {
        return diff;
      }
    }
    return 0;
  }

  return a.localeCompare(b);
}

async function fetchManifestDataset(manifestUrl) {
  const manifest = await fetchJsonFile(manifestUrl);
  const datasetUrl = resolveDataUrl(
    manifest.datasetUrl || manifest.datasetPath || manifest.currentUrl || manifest.currentPath || DATA_JSON_FALLBACK_FILE,
    manifest.manifestUrl || manifestUrl
  );
  const dataset = await fetchJsonFile(datasetUrl);

  if (!validateDatasetPayload(dataset, manifest)) {
    throw new Error(`Invalid dataset payload from ${datasetUrl}`);
  }

  return { manifest, dataset };
}

async function loadBundledCatalogData() {
  const dataset = await fetchJsonFile(DATA_JSON_FALLBACK_FILE);
  return {
    rows: Array.isArray(dataset.games) ? dataset.games : [],
    metadata: dataset,
    version: dataset.version || "",
  };
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

async function loadInitialCatalogData() {
  const cached = readCachedCatalogData();

  if (isBundledAppRuntime()) {
    try {
      const bundled = await loadBundledCatalogData();
      if (!cached) {
        return bundled;
      }

      const bundledVersion = bundled.version || "";
      const cachedVersion = cached.version || "";
      if (!cachedVersion || compareCatalogVersions(bundledVersion, cachedVersion) > 0) {
        writeCachedCatalogData(bundled.metadata || {}, { version: bundled.version, games: bundled.rows });
        return bundled;
      }

      return cached;
    } catch {
      if (cached) {
        return cached;
      }
    }
  }

  if (cached) {
    return cached;
  }

  try {
    return await loadBundledCatalogData();
  } catch {
    try {
      const metadata = await loadMetadata();
      return {
        rows: await loadCsvData(),
        metadata,
        version: metadata?.version || "",
      };
    } catch {
      throw new Error("Failed to load any catalog data source");
    }
  }
}

async function refreshCatalogInBackground() {
  const manifestCandidates = isBundledAppRuntime()
    ? [REMOTE_MANIFEST_URL, DATA_MANIFEST_FILE]
    : [DATA_MANIFEST_FILE, REMOTE_MANIFEST_URL];
  const cached = readCachedCatalogData();

  state.catalogStatus = "Checking for updates...";
  render();

  for (const manifestUrl of manifestCandidates) {
    try {
      const { manifest, dataset } = await fetchManifestDataset(manifestUrl);
      const version = manifest.version || dataset.version || "";

      const versionDiff = compareCatalogVersions(version, cached?.version || "");

      if (cached && cached.version && versionDiff === 0) {
        state.metadata = manifest;
        state.catalogStatus = "";
        renderMetadata();
        render();
        return;
      }

      if (cached && cached.version && versionDiff < 0) {
        continue;
      }

      state.catalogStatus = "Updating catalog...";
      render();

      writeCachedCatalogData(manifest, dataset);
      state.rows = dataset.games;
      state.rowsByKey = new Map(state.rows.map((row) => [getGameKey(row), row]));
      state.metadata = manifest;
      state.catalogStatus = "Catalog updated";
      renderMetadata();
      render();

      window.setTimeout(() => {
        state.catalogStatus = "";
        render();
      }, 2500);

      return;
    } catch {
      // Try the next manifest source.
    }
  }

  state.catalogStatus = "";
  render();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && !isBundledAppRuntime()) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Silent failure is fine for a static app enhancement.
      });
    });
  }
}

function handleActionClick(event) {
  const actionNode = event.target.closest("[data-action]");
  if (!actionNode) {
    return;
  }

  const { action, gameKey, tab, status } = actionNode.dataset;

  if (action === "switch-tab") {
    state.currentTab = tab;
    render();
    return;
  }

  if (action === "toggle-favorite" && gameKey) {
    toggleFavorite(gameKey);
    return;
  }

  if (action === "hide" && gameKey) {
    hideGame(gameKey);
    return;
  }

  if (action === "unhide" && gameKey) {
    unhideGame(gameKey);
    return;
  }

  if (action === "open-detail" && gameKey) {
    state.selectedGameKey = gameKey;
    renderDetailSheet();
    return;
  }

  if (action === "open-list-menu" && gameKey) {
    state.actionSheetGameKey = gameKey;
    state.actionSheetMode = "list";
    renderActionSheet();
    return;
  }

  if (action === "open-overflow" && gameKey) {
    state.actionSheetGameKey = gameKey;
    state.actionSheetMode = "overflow";
    renderActionSheet();
    return;
  }

  if (action === "close-actions") {
    state.actionSheetGameKey = "";
    state.actionSheetMode = "";
    renderActionSheet();
    return;
  }

  if (action === "sheet-set-status" && gameKey) {
    state.actionSheetGameKey = "";
    state.actionSheetMode = "";
    setListStatus(gameKey, status);
    return;
  }

  if (action === "sheet-remove-list" && gameKey) {
    state.actionSheetGameKey = "";
    state.actionSheetMode = "";
    removeFromList(gameKey);
    return;
  }

  if (action === "sheet-toggle-favorite" && gameKey) {
    state.actionSheetGameKey = "";
    toggleFavorite(gameKey);
    return;
  }

  if (action === "sheet-hide" && gameKey) {
    state.actionSheetGameKey = "";
    state.actionSheetMode = "";
    hideGame(gameKey);
    return;
  }

  if (action === "sheet-open-hltb" && gameKey) {
    const row = state.rowsByKey.get(gameKey);
    const url = getRowHltbUrl(row);
    state.actionSheetGameKey = "";
    state.actionSheetMode = "";
    renderActionSheet();
    if (url) {
      void openExternalUrl(url);
      showToast("Opening HowLongToBeat");
    }
    return;
  }

  if (action === "open-hidden") {
    state.currentTab = "library";
    render();
    window.requestAnimationFrame(() => {
      document.getElementById("library-section-hidden")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }

  if (action === "close-detail") {
    state.selectedGameKey = "";
    renderDetailSheet();
  }
}

function handleStatusChange(event) {
  const select = event.target.closest('select[data-action="set-status"]');
  if (!select) {
    return;
  }

  setListStatus(select.dataset.gameKey, select.value);
}

function handleCardOpen(event) {
  if (event.target.closest("button, select, label")) {
    return;
  }

  const card = event.target.closest('.browse-card-main[data-game-key], .library-card[data-game-key]');
  if (!card) {
    return;
  }

  state.selectedGameKey = card.dataset.gameKey;
  renderDetailSheet();
}

async function load() {
  state.userState = readPersistedUserState();
  state.query = state.userState.savedFilters.query;
  state.service = state.userState.savedFilters.service;
  state.lengthBucket = state.userState.savedFilters.lengthBucket;
  state.platform = state.userState.savedFilters.platform;
  state.sortBy = state.userState.savedFilters.sortBy;
  state.sortDirection = state.userState.savedFilters.sortDirection;
  if (isDurationSortField(state.sortBy)) {
    state.lastDurationSortBy = state.sortBy;
  }

  const dataset = await loadInitialCatalogData();
  state.rows = dataset.rows;
  state.rowsByKey = new Map(state.rows.map((row) => [getGameKey(row), row]));
  state.metadata = dataset.metadata;

  renderMetadata();

  document.getElementById("search").addEventListener(
    "input",
    debounce((event) => {
      state.query = event.target.value;
      persistCurrentFilters();
      render();
    }, 120)
  );
  document.getElementById("search").value = state.query;

  for (const button of document.querySelectorAll("[data-sort]")) {
    button.addEventListener("click", () => setSort(button.dataset.sort));
  }

  document.body.addEventListener("click", handleActionClick);
  document.body.addEventListener("change", handleStatusChange);
  document.getElementById("results-list").addEventListener("click", handleCardOpen);
  document.getElementById("library-sections").addEventListener("click", handleCardOpen);

  let compactLayout = isCompactMobileLayout();
  window.addEventListener(
    "resize",
    debounce(() => {
      const nextCompactLayout = isCompactMobileLayout();
      if (nextCompactLayout !== compactLayout) {
        compactLayout = nextCompactLayout;
        render();
      }
    }, 100)
  );

  render();
  void refreshCatalogInBackground();
}

const state = {
  rows: [],
  rowsByKey: new Map(),
  query: "",
  service: "playstation-plus",
  platform: "all",
  lengthBucket: "all",
  sortBy: "gameplayMain",
  sortDirection: "asc",
  lastDurationSortBy: "gameplayMain",
  metadata: null,
  catalogStatus: "",
  filteredRows: [],
  renderedCount: 0,
  scrollObserver: null,
  currentTab: "browse",
  selectedGameKey: "",
  actionSheetGameKey: "",
  actionSheetMode: "",
  userState: createDefaultUserState(),
  savedFiltersMessage: "",
  savedFiltersMessageTimer: 0,
  toastMessage: "",
  toastTimer: 0,
};

registerServiceWorker();

load().catch((error) => {
  console.error(error);
  document.getElementById("results-list").innerHTML =
    '<div class="empty-state">Failed to load data. Run <code>npm run update-data</code> and refresh.</div>';
});

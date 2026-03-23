const DATA_FILE = "./data/list.csv";
const METADATA_FILE = "./data/metadata.json";

const state = {
  rows: [],
  query: "",
  service: "xbox-game-pass",
  platform: "all",
  sortBy: "gameplayMain",
  sortDirection: "desc",
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

function formatHours(value) {
  const hours = Number(value || 0);
  if (!hours) {
    return "N/A";
  }
  return `${hours}h`;
}

function splitField(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFilteredRows() {
  const query = normalize(state.query);
  const filtered = state.rows.filter((row) => {
    if (query && !normalize(row.name).includes(query)) {
      return false;
    }

    if (row.serviceKey !== state.service) {
      return false;
    }

    if (state.platform !== "all" && !splitField(row.platforms).includes(state.platform)) {
      return false;
    }

    return true;
  });

  const direction = state.sortDirection === "asc" ? 1 : -1;
  filtered.sort((left, right) => {
    if (state.sortBy === "name" || state.sortBy === "service") {
      return String(left[state.sortBy] || "").localeCompare(String(right[state.sortBy] || "")) * direction;
    }

    return (Number(left[state.sortBy] || 0) - Number(right[state.sortBy] || 0)) * direction;
  });

  return filtered;
}

function sortIndicator(column) {
  if (state.sortBy !== column) {
    return "";
  }
  return state.sortDirection === "asc" ? " ↑" : " ↓";
}

function populateSelect(id, options, selectedValue) {
  const select = document.getElementById(id);
  select.innerHTML = options
    .map(
      (option) =>
        `<option value="${option.value}"${option.value === selectedValue ? " selected" : ""}>${option.label}</option>`
    )
    .join("");
}

function getPlatformOptions() {
  const scopedRows = state.rows.filter((row) => row.serviceKey === state.service);

  const values = [...new Set(scopedRows.flatMap((row) => splitField(row.platforms)))].sort((left, right) =>
    left.localeCompare(right)
  );

  return [{ value: "all", label: "All platforms" }, ...values.map((value) => ({ value, label: value }))];
}

function getActiveService() {
  return state.service === "playstation-plus"
    ? { label: "PlayStation Plus Premium", shortLabel: "PlayStation" }
    : { label: "Xbox Game Pass", shortLabel: "Xbox" };
}

function renderServicePills() {
  const services = [
    { value: "xbox-game-pass", label: "Xbox Game Pass" },
    { value: "playstation-plus", label: "PlayStation Plus Premium" },
  ];

  const container = document.getElementById("service-pills");
  container.dataset.activeService = state.service;
  container.innerHTML = services
    .map(
      (service) => `
        <button
          type="button"
          class="service-pill${state.service === service.value ? " is-active" : ""}"
          data-service="${service.value}"
          aria-pressed="${state.service === service.value ? "true" : "false"}"
        >
          <span class="service-pill-label">${service.label}</span>
        </button>
      `
    )
    .join("");

  for (const button of container.querySelectorAll("[data-service]")) {
    button.addEventListener("click", () => {
      state.service = button.getAttribute("data-service");
      if (!getPlatformOptions().some((option) => option.value === state.platform)) {
        state.platform = "all";
      }
      populateSelect("platform-filter", getPlatformOptions(), state.platform);
      renderServicePills();
      render();
    });
  }
}

function renderMetricCell(row, field, maxValue, variant = "") {
  const value = Number(row[field] || 0);
  const width = maxValue > 0 ? Math.max((value / maxValue) * 100, value ? 8 : 0) : 0;
  const serviceClass = row.serviceKey === "playstation-plus" ? " is-playstation" : "";
  const variantClass = variant ? ` ${variant}` : "";

  return `
    <div class="metric-cell">
      <span class="metric-value">${formatHours(value)}</span>
      <div class="metric-track">
        <div class="metric-fill${serviceClass}${variantClass}" style="width:${width}%"></div>
      </div>
    </div>
  `;
}

function render() {
  const rows = getFilteredRows();
  const activeService = getActiveService();
  document.getElementById("results-count").textContent = `${activeService.shortLabel} · ${rows.length} games shown`;

  const tbody = document.getElementById("table-body");
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No titles matched the current filters.</td></tr>';
  } else {
    tbody.innerHTML = rows
      .map((row) => {
        const serviceClass = row.serviceKey === "playstation-plus" ? "chip-service-playstation" : "chip-service-xbox";
        const catalogChips = splitField(row.catalogTypes)
          .map((catalogType) => `<span class="chip chip-catalog">${catalogType}</span>`)
          .join("");
        const platformChips = splitField(row.platforms)
          .map((platform) => `<span class="chip chip-platform">${platform}</span>`)
          .join("");
        const hltbUrl = row.hltbId ? `https://howlongtobeat.com/game/${row.hltbId}` : row.productUrl || "#";

        return `
          <tr class="data-row">
            <td>
              <div class="title-cell">
                <a class="cover-link" href="${hltbUrl}" target="_blank" rel="noreferrer">
                  <img class="cover" src="${row.imageUrl}" alt="${row.name} cover art" loading="lazy">
                </a>
                <div class="title-text">
                  <strong><a class="game-link" href="${hltbUrl}" target="_blank" rel="noreferrer">${row.name}</a></strong>
                  <span class="subtle">${row.hltbName || row.service}</span>
                </div>
              </div>
            </td>
            <td><span class="chip ${serviceClass}">${row.service}</span></td>
            <td><div class="chip-stack">${catalogChips || '<span class="subtle">N/A</span>'}</div></td>
            <td><div class="chip-stack">${platformChips || '<span class="subtle">N/A</span>'}</div></td>
            <td><span class="metric-value">${formatHours(row.gameplayMain)}</span></td>
            <td><span class="metric-value">${formatHours(row.gameplayMainExtra)}</span></td>
            <td><span class="metric-value">${formatHours(row.gameplayCompletionist)}</span></td>
            <td class="link-cell">
              <a href="${hltbUrl}" target="_blank" rel="noreferrer">${row.hltbId ? "HLTB ↗" : "Link ↗"}</a>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  for (const button of document.querySelectorAll("[data-sort]")) {
    const column = button.getAttribute("data-sort");
    button.textContent = button.dataset.label + sortIndicator(column);
  }
}

function setSort(column) {
  if (state.sortBy === column) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortBy = column;
    state.sortDirection = column === "name" || column === "service" ? "asc" : "desc";
  }

  render();
}

function initializeFilters() {
  populateSelect("platform-filter", getPlatformOptions(), state.platform);

  document.getElementById("platform-filter").addEventListener("change", (event) => {
    state.platform = event.target.value;
    render();
  });

  renderServicePills();
}

async function load() {
  const [csvResponse, metadataResponse] = await Promise.all([fetch(DATA_FILE), fetch(METADATA_FILE)]);

  state.rows = parseCsv(await csvResponse.text());
  state.metadata = await metadataResponse.json();

  document.getElementById("search").addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  for (const button of document.querySelectorAll("[data-sort]")) {
    button.addEventListener("click", () => setSort(button.getAttribute("data-sort")));
  }

  initializeFilters();
  render();
}

load().catch((error) => {
  console.error(error);
  document.getElementById("table-body").innerHTML =
    '<tr><td colspan="8" class="empty-state">Failed to load data. Run <code>npm run update-data</code> and refresh.</td></tr>';
});

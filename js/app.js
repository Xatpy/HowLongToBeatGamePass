const DATA_FILE = "./data/list.csv";
const METADATA_FILE = "./data/metadata.json";

const state = {
  rows: [],
  query: "",
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

  return lines
    .filter(Boolean)
    .map((line) => {
      const values = parseCsvLine(line);
      return headers.reduce((row, header, index) => {
        row[header] = values[index] ?? "";
        return row;
      }, {});
    });
}

function normalize(text) {
  return text.toLowerCase().trim();
}

function formatHours(value) {
  const hours = Number(value || 0);
  if (!hours) {
    return "N/A";
  }
  return `${hours}h`;
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function getFilteredRows() {
  const query = normalize(state.query);
  const filtered = query
    ? state.rows.filter((row) => normalize(row.name).includes(query))
    : [...state.rows];

  const direction = state.sortDirection === "asc" ? 1 : -1;
  filtered.sort((left, right) => {
    if (state.sortBy === "name") {
      return left.name.localeCompare(right.name) * direction;
    }

    return (Number(left[state.sortBy] || 0) - Number(right[state.sortBy] || 0)) * direction;
  });

  return filtered;
}

function computeSummary(rows) {
  const totalMain = rows.reduce((sum, row) => sum + Number(row.gameplayMain || 0), 0);
  const maxMain = rows.reduce((max, row) => Math.max(max, Number(row.gameplayMain || 0)), 0);

  return {
    visibleCount: rows.length,
    totalMain,
    maxMain,
  };
}

function sortIndicator(column) {
  if (state.sortBy !== column) {
    return "";
  }
  return state.sortDirection === "asc" ? " ↑" : " ↓";
}

function render() {
  const rows = getFilteredRows();
  const summary = computeSummary(rows);

  document.getElementById("results-count").textContent = `${summary.visibleCount} games shown`;
  document.getElementById("results-hours").textContent = `${Math.round(summary.totalMain)} total main-story hours`;
  document.getElementById("results-max").textContent = `${summary.maxMain}h longest main story`;

  document.getElementById("last-updated").textContent = formatDate(state.metadata?.generatedAt);
  document.getElementById("catalog-count").textContent = String(state.metadata?.xboxCatalogCount ?? state.rows.length);
  document.getElementById("matched-count").textContent = String(state.metadata?.matchedCount ?? state.rows.length);
  document.getElementById("unmatched-count").textContent = String(state.metadata?.unmatchedCount ?? 0);

  const tbody = document.getElementById("table-body");
  tbody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td class="game-cell">
            <img class="cover" src="${row.imageUrl}" alt="${row.name} cover art" loading="lazy">
            <div>
              <a href="${row.xboxProductUrl || `https://howlongtobeat.com/game/${row.hltbId}`}" target="_blank" rel="noreferrer">${row.name}</a>
              <div class="subtle">${row.hltbName || "Matched title unavailable"}</div>
            </div>
          </td>
          <td>${formatHours(row.gameplayMain)}</td>
          <td>${formatHours(row.gameplayMainExtra)}</td>
          <td>${formatHours(row.gameplayCompletionist)}</td>
          <td><a href="https://howlongtobeat.com/game/${row.hltbId}" target="_blank" rel="noreferrer">HLTB</a></td>
        </tr>
      `
    )
    .join("");

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
    state.sortDirection = column === "name" ? "asc" : "desc";
  }

  render();
}

async function load() {
  const [csvResponse, metadataResponse] = await Promise.all([
    fetch(DATA_FILE),
    fetch(METADATA_FILE),
  ]);

  state.rows = parseCsv(await csvResponse.text());
  state.metadata = await metadataResponse.json();

  document.getElementById("search").addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  for (const button of document.querySelectorAll("[data-sort]")) {
    button.addEventListener("click", () => setSort(button.getAttribute("data-sort")));
  }

  render();
}

load().catch((error) => {
  console.error(error);
  document.getElementById("table-body").innerHTML =
    '<tr><td colspan="5">Failed to load data. Run <code>npm run update-data</code> and refresh.</td></tr>';
});

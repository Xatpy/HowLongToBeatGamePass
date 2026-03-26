const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TARGET = path.join(ROOT, "capacitor-www");

const FILES = [
  "index.html",
  "manifest.json",
  "sw.js",
  "robots.txt",
];

const DIRECTORIES = [
  "css",
  "js",
  "icons",
];

const DATA_FILES = [
  "data/catalog-manifest.json",
  "data/catalog.json",
  "data/list.csv",
  "data/metadata.json",
];

const DATA_DIRECTORIES = [
  "data/catalogs",
];

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyFile(relativePath) {
  const source = path.join(ROOT, relativePath);
  const target = path.join(TARGET, relativePath);
  await ensureDir(path.dirname(target));
  await fs.copyFile(source, target);
}

async function copyDirectory(relativePath) {
  const source = path.join(ROOT, relativePath);
  const target = path.join(TARGET, relativePath);
  await ensureDir(path.dirname(target));
  await fs.cp(source, target, { recursive: true });
}

async function main() {
  await fs.rm(TARGET, { recursive: true, force: true });
  await ensureDir(TARGET);

  for (const file of FILES) {
    await copyFile(file);
  }

  for (const directory of DIRECTORIES) {
    await copyDirectory(directory);
  }

  for (const file of DATA_FILES) {
    await copyFile(file);
  }

  for (const directory of DATA_DIRECTORIES) {
    await copyDirectory(directory);
  }

  console.log(`Prepared Capacitor web assets in ${TARGET}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

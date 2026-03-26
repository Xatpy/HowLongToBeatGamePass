const fs = require("node:fs/promises");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const CAPACITOR_CONFIG_FILE = path.join(ROOT, "capacitor.config.json");
const IOS_ROOT = path.join(ROOT, "ios", "App");
const IOS_PROJECT_FILE = path.join(IOS_ROOT, "App.xcodeproj", "project.pbxproj");
const IOS_INFO_PLIST = path.join(IOS_ROOT, "App", "Info.plist");
const IOS_APP_ICON_DIR = path.join(IOS_ROOT, "App", "Assets.xcassets", "AppIcon.appiconset");
const IOS_APP_ICON_SOURCE_DIR = path.join(
  ROOT,
  process.env.IOS_APP_ICON_SOURCE_DIR || "assets/AppIcons/Assets.xcassets/AppIcon.appiconset"
);
const ENV_FILES = [".env", ".env.local"];

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function loadCapacitorConfig() {
  return JSON.parse(await fs.readFile(CAPACITOR_CONFIG_FILE, "utf8"));
}

async function loadEnvFiles() {
  for (const fileName of ENV_FILES) {
    const filePath = path.join(ROOT, fileName);

    if (!(await pathExists(filePath))) {
      continue;
    }

    const contents = await fs.readFile(filePath, "utf8");

    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) {
        continue;
      }

      const [, key, rawValue] = match;
      if (process.env[key]) {
        continue;
      }

      const value = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
      process.env[key] = value;
    }
  }
}

async function syncBundleIdentifier(appId) {
  const original = await fs.readFile(IOS_PROJECT_FILE, "utf8");
  const updated = original.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`);

  if (updated !== original) {
    await fs.writeFile(IOS_PROJECT_FILE, updated, "utf8");
  }
}

async function syncDevelopmentTeam(teamId) {
  const original = await fs.readFile(IOS_PROJECT_FILE, "utf8");
  const replacement = teamId ? `DEVELOPMENT_TEAM = ${teamId};` : `DEVELOPMENT_TEAM = "";`;
  const updated = original.replace(/DEVELOPMENT_TEAM = [^;]*;/g, replacement);

  if (updated !== original) {
    await fs.writeFile(IOS_PROJECT_FILE, updated, "utf8");
  }
}

async function syncDisplayName(appName) {
  const original = await fs.readFile(IOS_INFO_PLIST, "utf8");
  const updated = original.replace(
    /(<key>CFBundleDisplayName<\/key>\s*<string>)([^<]*)(<\/string>)/,
    `$1${appName}$3`
  );

  if (updated !== original) {
    await fs.writeFile(IOS_INFO_PLIST, updated, "utf8");
  }
}

async function syncAppIcon() {
  if (!(await pathExists(IOS_APP_ICON_SOURCE_DIR))) {
    throw new Error(`Missing iOS app icon source directory: ${IOS_APP_ICON_SOURCE_DIR}`);
  }

  await fs.rm(IOS_APP_ICON_DIR, { recursive: true, force: true });
  await fs.cp(IOS_APP_ICON_SOURCE_DIR, IOS_APP_ICON_DIR, { recursive: true });
}

async function main() {
  if (!(await pathExists(IOS_ROOT))) {
    console.log("Skipping iOS branding sync: ios/App does not exist yet");
    return;
  }

  await loadEnvFiles();
  const config = await loadCapacitorConfig();
  const appId = config.xatpyNative?.iosAppId || config.appId;
  const developmentTeam = process.env.IOS_DEVELOPMENT_TEAM || config.xatpyNative?.iosDevelopmentTeam || "";
  await syncBundleIdentifier(appId);
  await syncDevelopmentTeam(developmentTeam);
  await syncDisplayName(config.appName);
  await syncAppIcon();

  console.log(`Synced iOS branding for ${config.appName} (${appId})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

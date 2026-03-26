const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CAPACITOR_CONFIG_FILE = path.join(ROOT, "capacitor.config.json");
const ANDROID_ROOT = path.join(ROOT, "android");
const APP_BUILD_GRADLE = path.join(ANDROID_ROOT, "app", "build.gradle");
const APP_MANIFEST = path.join(ANDROID_ROOT, "app", "src", "main", "AndroidManifest.xml");
const APP_STRINGS = path.join(ANDROID_ROOT, "app", "src", "main", "res", "values", "strings.xml");
const JAVA_ROOT = path.join(ANDROID_ROOT, "app", "src", "main", "java");
const KOTLIN_ROOT = path.join(ANDROID_ROOT, "app", "src", "main", "kotlin");
const RES_ROOT = path.join(ANDROID_ROOT, "app", "src", "main", "res");
const ANDROID_APP_ICON_SOURCE_ROOT = path.join(ROOT, process.env.ANDROID_APP_ICON_SOURCE_ROOT || "assets/AppIcons/android");
const ICON_SIZES = [
  { dir: "mipmap-mdpi" },
  { dir: "mipmap-hdpi" },
  { dir: "mipmap-xhdpi" },
  { dir: "mipmap-xxhdpi" },
  { dir: "mipmap-xxxhdpi" },
];

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

async function replaceInFile(filePath, replacer) {
  if (!(await pathExists(filePath))) {
    return;
  }

  const original = await fs.readFile(filePath, "utf8");
  const updated = replacer(original);

  if (updated !== original) {
    await fs.writeFile(filePath, updated, "utf8");
  }
}

async function syncBuildGradle(appId) {
  await replaceInFile(APP_BUILD_GRADLE, (contents) =>
    contents
      .replace(/applicationId\s+["'][^"']+["']/g, `applicationId "${appId}"`)
      .replace(/namespace\s+["'][^"']+["']/g, `namespace "${appId}"`)
  );
}

async function syncManifestPackage(appId) {
  await replaceInFile(APP_MANIFEST, (contents) => {
    if (/package="[^"]+"/.test(contents)) {
      return contents.replace(/package="[^"]+"/, `package="${appId}"`);
    }
    return contents;
  });
}

async function syncAppName(appName) {
  await replaceInFile(APP_STRINGS, (contents) =>
    contents.replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${appName}</string>`)
  );
}

async function syncAppIcons() {
  if (!(await pathExists(ANDROID_APP_ICON_SOURCE_ROOT))) {
    throw new Error(`Missing Android app icon source directory: ${ANDROID_APP_ICON_SOURCE_ROOT}`);
  }

  for (const { dir } of ICON_SIZES) {
    const sourceDir = path.join(ANDROID_APP_ICON_SOURCE_ROOT, dir);
    const mipmapDir = path.join(RES_ROOT, dir);

    if (!(await pathExists(sourceDir))) {
      throw new Error(`Missing Android mipmap source directory: ${sourceDir}`);
    }

    await fs.mkdir(mipmapDir, { recursive: true });
    await fs.cp(sourceDir, mipmapDir, { recursive: true, force: true });
  }
}

async function findMainActivity(rootDir) {
  if (!(await pathExists(rootDir))) {
    return null;
  }

  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (/MainActivity\.(java|kt)$/.test(entry.name)) {
        return fullPath;
      }
    }
  }

  return null;
}

function packagePath(rootDir, appId) {
  return path.join(rootDir, ...appId.split("."));
}

async function syncSourcePackage(rootDir, appId) {
  const mainActivityPath = await findMainActivity(rootDir);
  if (!mainActivityPath) {
    return;
  }

  const fileName = path.basename(mainActivityPath);
  const originalSource = await fs.readFile(mainActivityPath, "utf8");
  const packageMatch = originalSource.match(/^\s*package\s+([a-zA-Z0-9_.]+)\s*;?\s*$/m);
  const oldAppId = packageMatch?.[1];
  const packageLine = fileName.endsWith(".kt") ? `package ${appId}` : `package ${appId};`;
  const updatedSource = oldAppId
    ? originalSource.replace(/^\s*package\s+[a-zA-Z0-9_.]+\s*;?\s*$/m, packageLine)
    : originalSource;

  const targetDir = packagePath(rootDir, appId);
  const targetPath = path.join(targetDir, fileName);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetPath, updatedSource, "utf8");

  if (mainActivityPath !== targetPath) {
    await fs.rm(mainActivityPath, { force: true });

    if (oldAppId) {
      const oldRootDir = packagePath(rootDir, oldAppId);
      await removeEmptyDirectories(oldRootDir, rootDir);
    }
  }
}

async function removeEmptyDirectories(startDir, stopDir) {
  let current = startDir;

  while (current.startsWith(stopDir) && current !== stopDir) {
    try {
      const entries = await fs.readdir(current);
      if (entries.length > 0) {
        return;
      }
      await fs.rmdir(current);
      current = path.dirname(current);
    } catch {
      return;
    }
  }
}

async function main() {
  if (!(await pathExists(ANDROID_ROOT))) {
    console.log("Skipping Android branding sync: android/ does not exist yet");
    return;
  }

  const config = await loadCapacitorConfig();
  const appId = config.xatpyNative?.androidAppId || config.appId;
  const appName = config.appName || "Beatable";

  await syncBuildGradle(appId);
  await syncManifestPackage(appId);
  await syncAppName(appName);
  await syncAppIcons();
  await syncSourcePackage(JAVA_ROOT, appId);
  await syncSourcePackage(KOTLIN_ROOT, appId);

  console.log(`Synced Android branding for ${appName} (${appId})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

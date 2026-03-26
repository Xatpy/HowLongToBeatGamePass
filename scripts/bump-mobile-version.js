const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ANDROID_BUILD_GRADLE = path.join(ROOT, "android/app/build.gradle");
const IOS_PBXPROJ = path.join(ROOT, "ios/App/App.xcodeproj/project.pbxproj");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--version") {
      args.version = argv[index + 1];
      index += 1;
    } else if (token === "--build") {
      args.build = argv[index + 1];
      index += 1;
    } else if (token === "--help" || token === "-h") {
      args.help = true;
    }
  }
  return args;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseSemver(value) {
  const match = String(value || "").trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
}

function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) {
    return String(left || "").localeCompare(String(right || ""));
  }
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return 0;
}

function incrementPatch(version) {
  const parsed = parseSemver(version);
  assert(parsed, `Expected semantic version like 1.2.3, got "${version}"`);
  parsed[2] += 1;
  return parsed.join(".");
}

function extractAndroidVersions(text) {
  const codeMatch = text.match(/versionCode\s+(\d+)/);
  const nameMatch = text.match(/versionName\s+"([^"]+)"/);
  assert(codeMatch, "Failed to find Android versionCode");
  assert(nameMatch, "Failed to find Android versionName");
  return {
    build: Number(codeMatch[1]),
    version: nameMatch[1],
  };
}

function extractIosVersions(text) {
  const buildMatches = [...text.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)];
  const marketingMatches = [...text.matchAll(/MARKETING_VERSION = ([^;]+);/g)];
  assert(buildMatches.length >= 1, "Failed to find iOS CURRENT_PROJECT_VERSION");
  assert(marketingMatches.length >= 1, "Failed to find iOS MARKETING_VERSION");
  return {
    build: Number(buildMatches[0][1]),
    version: marketingMatches[0][1].trim(),
  };
}

function replaceAndroidVersions(text, nextBuild, nextVersion) {
  let updated = text.replace(/versionCode\s+\d+/, `versionCode ${nextBuild}`);
  updated = updated.replace(/versionName\s+"[^"]+"/, `versionName "${nextVersion}"`);
  return updated;
}

function replaceIosVersions(text, nextBuild, nextVersion) {
  let updated = text.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${nextBuild};`);
  updated = updated.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${nextVersion};`);
  return updated;
}

function printHelp() {
  console.log(`Usage:
  npm run version:mobile
  npm run version:mobile -- --version 1.2.0
  npm run version:mobile -- --build 7
  npm run version:mobile -- --version 1.2.0 --build 7

Defaults:
  - build increments to max(Android versionCode, iOS CURRENT_PROJECT_VERSION) + 1
  - version uses the higher of Android/iOS version strings and bumps its patch
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const androidText = readText(ANDROID_BUILD_GRADLE);
  const iosText = readText(IOS_PBXPROJ);
  const android = extractAndroidVersions(androidText);
  const ios = extractIosVersions(iosText);

  const nextBuild = args.build ? Number(args.build) : Math.max(android.build, ios.build) + 1;
  assert(Number.isInteger(nextBuild) && nextBuild > 0, `Invalid build number "${args.build}"`);

  const baseVersion = compareSemver(android.version, ios.version) >= 0 ? android.version : ios.version;
  const nextVersion = args.version || incrementPatch(baseVersion);
  assert(parseSemver(nextVersion), `Invalid version "${nextVersion}". Expected semantic version like 1.2 or 1.2.3.`);

  writeText(ANDROID_BUILD_GRADLE, replaceAndroidVersions(androidText, nextBuild, nextVersion));
  writeText(IOS_PBXPROJ, replaceIosVersions(iosText, nextBuild, nextVersion));

  console.log(`Updated mobile versions:
  Android versionCode: ${android.build} -> ${nextBuild}
  Android versionName: ${android.version} -> ${nextVersion}
  iOS CURRENT_PROJECT_VERSION: ${ios.build} -> ${nextBuild}
  iOS MARKETING_VERSION: ${ios.version} -> ${nextVersion}`);
}

main();

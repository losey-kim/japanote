import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entryFilePath = fileURLToPath(import.meta.url);
const assetPattern = /assets\/[A-Za-z0-9_./-]+\.(?:css|js)(?:\?v=[^"'`\s]+)?/gu;

function getFileHash(filePath) {
  const content = readFileSync(filePath);
  return createHash("md5").update(content).digest("hex").slice(0, 8);
}

function parseCliArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--root" && argv[index + 1]) {
      options.rootDir = resolve(repoRoot, argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

function getHtmlFiles(rootDir) {
  return readdirSync(rootDir)
    .filter((name) => name.endsWith(".html"))
    .map((name) => resolve(rootDir, name));
}

function buildHashMap(content, rootDir) {
  const map = new Map();
  const matches = content.match(assetPattern) || [];

  for (const rawAsset of matches) {
    const asset = rawAsset.replace(/\?v=[^"'`\s]+$/u, "");

    if (map.has(asset)) {
      continue;
    }

    const fullPath = resolve(rootDir, asset);

    if (!existsSync(fullPath)) {
      console.warn(`⚠ ${asset} 파일을 찾을 수 없어서 건너뜁니다.`);
      continue;
    }

    map.set(asset, getFileHash(fullPath));
  }

  return map;
}

function updateVersionStrings(filePath, rootDir) {
  let content = readFileSync(filePath, "utf8");
  let changed = false;
  const hashMap = buildHashMap(content, rootDir);

  for (const [asset, hash] of hashMap) {
    const pattern = new RegExp(
      `${asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\?v=[^"'\`\\s]+)?`,
      "g"
    );
    const replacement = `${asset}?v=${hash}`;
    const next = content.replace(pattern, replacement);

    if (next !== content) {
      changed = true;
      content = next;
    }
  }

  if (changed) {
    writeFileSync(filePath, content, "utf8");
  }

  return changed;
}

function getTargetFiles(rootDir) {
  const files = [...getHtmlFiles(rootDir)];
  const loaderPath = resolve(rootDir, "assets", "js", "page-script-loader.js");

  if (existsSync(loaderPath)) {
    files.push(loaderPath);
  }

  return files;
}

export function applyAssetVersioning(options = {}) {
  const rootDir = options.rootDir || repoRoot;
  const targetFiles = getTargetFiles(rootDir);
  let updatedCount = 0;

  for (const filePath of targetFiles) {
    if (updateVersionStrings(filePath, rootDir)) {
      const name = filePath.replace(rootDir + "\\", "").replace(rootDir + "/", "");
      console.log(`✔ ${name} 업데이트됨`);
      updatedCount += 1;
    }
  }

  if (!updatedCount) {
    console.log("모든 배포 파일이 이미 최신 버전입니다.");
  }
}

function isDirectRun() {
  return Boolean(process.argv[1] && resolve(process.argv[1]) === entryFilePath);
}

if (isDirectRun()) {
  applyAssetVersioning(parseCliArgs(process.argv.slice(2)));
}

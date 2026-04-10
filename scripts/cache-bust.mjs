import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 대상 에셋 파일 → HTML에서 참조되는 상대 경로 */
const trackedAssets = [
  "assets/css/styles.css",
  "assets/js/page-script-loader.js"
];

function getFileHash(filePath) {
  const content = readFileSync(filePath);
  return createHash("md5").update(content).digest("hex").slice(0, 8);
}

function buildHashMap() {
  const map = new Map();

  for (const asset of trackedAssets) {
    const fullPath = resolve(repoRoot, asset);
    try {
      map.set(asset, getFileHash(fullPath));
    } catch {
      console.warn(`⚠ ${asset} 파일을 찾을 수 없어서 건너뜁니다.`);
    }
  }

  return map;
}

function getHtmlFiles() {
  return readdirSync(repoRoot)
    .filter((name) => name.endsWith(".html"))
    .map((name) => resolve(repoRoot, name));
}

function updateVersionStrings(htmlPath, hashMap) {
  let content = readFileSync(htmlPath, "utf8");
  let changed = false;

  for (const [asset, hash] of hashMap) {
    // asset?v=anything → asset?v=hash
    const pattern = new RegExp(
      asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\?v=[^\"'\\s]+",
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
    writeFileSync(htmlPath, content, "utf8");
  }

  return changed;
}

const hashMap = buildHashMap();
const htmlFiles = getHtmlFiles();
let updatedCount = 0;

console.log("에셋 해시:");
for (const [asset, hash] of hashMap) {
  console.log(`  ${asset} → ${hash}`);
}

for (const htmlPath of htmlFiles) {
  if (updateVersionStrings(htmlPath, hashMap)) {
    const name = htmlPath.replace(repoRoot + "\\", "").replace(repoRoot + "/", "");
    console.log(`✔ ${name} 업데이트됨`);
    updatedCount += 1;
  }
}

if (!updatedCount) {
  console.log("모든 HTML 파일이 이미 최신 버전입니다.");
}

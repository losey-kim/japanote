import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildKanaDataFile } from "./build-kana-data.mjs";
import { applyAssetVersioning } from "./cache-bust.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(repoRoot, "output");
const defaultSiteUrl = "https://japanote.pages.dev";
const htmlFiles = readdirSync(repoRoot).filter((name) => name.endsWith(".html"));
const directoryCopies = ["assets", "data"];
const fileCopies = ["functions/challenge-preview/shared.js", "manifest.json", "sw.js"];

function normalizeSiteUrl(rawValue) {
  const value = String(rawValue || "").trim() || defaultSiteUrl;
  return value.replace(/\/+$/u, "");
}

function renderHtmlWithSiteUrl(fileName, siteUrl) {
  const sourcePath = resolve(repoRoot, fileName);
  const outputPath = resolve(outputRoot, fileName);
  const content = readFileSync(sourcePath, "utf8").replace(/__SITE_URL__/gu, siteUrl);

  writeFileSync(outputPath, content, "utf8");
}

function copyStaticDirectories() {
  for (const directoryName of directoryCopies) {
    cpSync(resolve(repoRoot, directoryName), resolve(outputRoot, directoryName), {
      recursive: true
    });
  }
}

function copyStaticFiles() {
  for (const relativePath of fileCopies) {
    const sourcePath = resolve(repoRoot, relativePath);
    const targetPath = resolve(outputRoot, relativePath);
    mkdirSync(dirname(targetPath), {
      recursive: true
    });
    cpSync(sourcePath, targetPath);
  }
}

function buildSite() {
  const siteUrl = normalizeSiteUrl(process.env.SITE_URL);

  rmSync(outputRoot, {
    recursive: true,
    force: true
  });
  mkdirSync(outputRoot, {
    recursive: true
  });

  for (const fileName of htmlFiles) {
    renderHtmlWithSiteUrl(fileName, siteUrl);
  }

  copyStaticDirectories();
  copyStaticFiles();
  buildKanaDataFile({
    outputPath: resolve(outputRoot, "data", "kana.json")
  });
  applyAssetVersioning({
    rootDir: outputRoot
  });

  console.log(`Built static site into ${outputRoot}`);
  console.log(`Using SITE_URL=${siteUrl}`);
}

buildSite();

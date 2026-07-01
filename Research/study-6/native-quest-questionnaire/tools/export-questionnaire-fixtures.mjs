#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

function playwrightRequire() {
  const nodePathEntries = (process.env.NODE_PATH || "").split(path.delimiter).filter(Boolean);
  const pnpmPlaywrightCandidates = [];
  nodePathEntries.forEach((entry) => {
    const pnpmDir = path.join(entry, ".pnpm");
    if (!fs.existsSync(pnpmDir)) {
      return;
    }
    fs.readdirSync(pnpmDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && dirent.name.startsWith("playwright@"))
      .forEach((dirent) => {
        pnpmPlaywrightCandidates.push(path.join(pnpmDir, dirent.name, "node_modules"));
      });
  });
  const candidates = [
    ...nodePathEntries,
    ...pnpmPlaywrightCandidates
  ];
  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, "playwright", "index.js")) &&
      fs.existsSync(path.join(candidate, "playwright-core", "index.js"))
    ) {
      return createRequire(path.join(candidate, "playwright", "index.js"));
    }
  }
  return createRequire(import.meta.url);
}

const require = playwrightRequire();
const { chromium } = require("playwright");

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..");
const STUDY_DIR = path.resolve(WORKSPACE_DIR, "..");
const PREVIEW_DIR = path.join(STUDY_DIR, "questionnaire-ui-preview");
const PREVIEW_URL = pathToFileURL(path.join(PREVIEW_DIR, "index.html")).href;

async function exportFixture(browser, query, outFile) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(`${PREVIEW_URL}${query}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.STUDY6_QUESTIONNAIRE_PREVIEW && document.getElementById("previewExportJson"));
  const data = await page.evaluate(() => window.STUDY6_QUESTIONNAIRE_PREVIEW.exportObject());
  fs.writeFileSync(path.join(PREVIEW_DIR, "fixtures", outFile), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await exportFixture(browser, "?previewSkipRequired=1", "default-state.json");
  await exportFixture(browser, "?previewSkipRequired=1&fixture=edge", "edge-cases.json");
} finally {
  await browser.close();
}

console.log("Exported questionnaire preview fixtures from the aligned local page.");

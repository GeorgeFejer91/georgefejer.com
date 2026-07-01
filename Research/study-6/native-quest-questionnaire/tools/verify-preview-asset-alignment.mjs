#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..");
const STUDY_DIR = path.resolve(WORKSPACE_DIR, "..");
const PREVIEW_DIR = path.join(STUDY_DIR, "questionnaire-ui-preview");
const PREVIEW_URL = process.env.STUDY6_PREVIEW_URL || "";

const REQUIRED_FILES = [
  "index.html",
  "styles.css",
  "questionnaire-item-library.js",
  "panel-preview.js"
];

function normalizeText(value) {
  return value.replace(/\r\n/g, "\n");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(normalizeText(value), "utf8").digest("hex").toUpperCase();
}

function fetchText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects < 5) {
        response.resume();
        resolve(fetchText(new URL(response.headers.location, url).href, redirects + 1));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      response.setEncoding("utf8");
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(chunks.join("")));
    }).on("error", reject);
  });
}

function linkedPreviewAssets(indexHtml) {
  const assets = new Map();
  assets.set("index.html", PREVIEW_URL);
  const pattern = /<(?:script|link)\b[^>]+(?:src|href)="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(indexHtml)) !== null) {
    const href = match[1];
    const name = href.split("?")[0].split("/").pop();
    if (REQUIRED_FILES.includes(name)) {
      assets.set(name, new URL(href, PREVIEW_URL).href);
    }
  }
  return assets;
}

async function main() {
  const failures = [];
  const remoteUrls = new Map();
  const remoteTexts = new Map();

  if (PREVIEW_URL) {
    const remoteIndex = await fetchText(PREVIEW_URL);
    for (const [file, url] of linkedPreviewAssets(remoteIndex)) {
      remoteUrls.set(file, url);
    }
    remoteTexts.set("index.html", remoteIndex);

    for (const file of REQUIRED_FILES) {
      if (!remoteUrls.has(file)) {
        failures.push(`remote preview did not expose ${file}`);
        continue;
      }
      if (file !== "index.html") {
        remoteTexts.set(file, await fetchText(remoteUrls.get(file)));
      }
    }
  }

  const files = [];
  for (const file of REQUIRED_FILES) {
    const localPath = path.join(PREVIEW_DIR, file);
    const localText = fs.existsSync(localPath) ? fs.readFileSync(localPath, "utf8") : null;
    const remoteText = remoteTexts.get(file) || null;
    const localHash = localText == null ? null : sha256Text(localText);
    const remoteHash = remoteText == null ? null : sha256Text(remoteText);

    if (localText == null) {
      failures.push(`local preview missing ${file}`);
    }
    if (PREVIEW_URL && remoteText == null) {
      failures.push(`remote preview missing ${file}`);
    }
    if (PREVIEW_URL && localHash && remoteHash && localHash !== remoteHash) {
      failures.push(`${file} local hash ${localHash} != deployed hash ${remoteHash}`);
    }

    files.push({
      file,
      local_path: localPath,
      deployed_url: remoteUrls.get(file) || null,
      local_sha256: localHash,
      deployed_sha256: remoteHash,
      local_matches_deployed: PREVIEW_URL ? Boolean(localHash && remoteHash && localHash === remoteHash) : null
    });
  }

  const report = {
    pass: failures.length === 0,
    failures,
    preview_url: PREVIEW_URL || null,
    deployed_preview_checked: Boolean(PREVIEW_URL),
    files
  };
  const reportPath = process.env.STUDY6_REPORT_PATH || path.join(WORKSPACE_DIR, "build", "preview-asset-alignment-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (!report.pass) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  const scope = PREVIEW_URL ? "deployed/local assets match" : "local preview assets are present";
  console.log(`Study 6 preview asset alignment passed: ${REQUIRED_FILES.length} ${scope}.`);
  console.log(reportPath);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

#!/usr/bin/env node
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..");
const STUDY_DIR = path.resolve(WORKSPACE_DIR, "..");
const PREVIEW_DIR = path.join(STUDY_DIR, "questionnaire-ui-preview");
const APK_PATH = process.env.STUDY6_APK || path.join(WORKSPACE_DIR, "quest-app", "build", "outputs", "apk", "debug", "quest-app-debug.apk");
const PREVIEW_URL = process.env.STUDY6_PREVIEW_URL || "https://www.georgefejer.com/Research/study-6/questionnaire-ui-preview/?previewSkipRequired=1&cb=232d4d3";

const REQUIRED_FILES = [
  "index.html",
  "styles.css",
  "questionnaire-item-library.js",
  "panel-preview.js"
];

function run(file, args, options = {}) {
  const result = childProcess.spawnSync(file, args, {
    cwd: options.cwd || STUDY_DIR,
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer || 128 * 1024 * 1024
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${file} ${args.join(" ")} failed with ${result.status}\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
  return result;
}

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

function extractApkAssets(apkPath) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "study6-preview-assets-"));
  try {
    const assetPaths = REQUIRED_FILES.map((file) => `assets/questionnaire-ui-preview/${file}`);
    run("tar", ["-xf", apkPath, "-C", tempDir, ...assetPaths]);
    const extracted = new Map();
    for (const file of REQUIRED_FILES) {
      const extractedPath = path.join(tempDir, "assets", "questionnaire-ui-preview", file);
      if (fs.existsSync(extractedPath)) {
        extracted.set(file, fs.readFileSync(extractedPath, "utf8"));
      }
    }
    return extracted;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const failures = [];
  const remoteIndex = await fetchText(PREVIEW_URL);
  const remoteUrls = linkedPreviewAssets(remoteIndex);
  const remoteTexts = new Map();
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

  const apkTexts = fs.existsSync(APK_PATH) ? extractApkAssets(APK_PATH) : new Map();
  if (!fs.existsSync(APK_PATH)) {
    failures.push(`APK missing: ${APK_PATH}`);
  }

  const files = [];
  for (const file of REQUIRED_FILES) {
    const localPath = path.join(PREVIEW_DIR, file);
    const localText = fs.existsSync(localPath) ? fs.readFileSync(localPath, "utf8") : null;
    const remoteText = remoteTexts.get(file) || null;
    const apkText = apkTexts.get(file) || null;
    const localHash = localText == null ? null : sha256Text(localText);
    const remoteHash = remoteText == null ? null : sha256Text(remoteText);
    const apkHash = apkText == null ? null : sha256Text(apkText);

    if (localText == null) {
      failures.push(`local preview missing ${file}`);
    }
    if (remoteText == null) {
      failures.push(`remote preview missing ${file}`);
    }
    if (apkText == null) {
      failures.push(`APK preview asset missing ${file}`);
    }
    if (localHash && remoteHash && localHash !== remoteHash) {
      failures.push(`${file} local hash ${localHash} != deployed hash ${remoteHash}`);
    }
    if (localHash && apkHash && localHash !== apkHash) {
      failures.push(`${file} local hash ${localHash} != APK hash ${apkHash}`);
    }

    files.push({
      file,
      local_path: localPath,
      deployed_url: remoteUrls.get(file) || null,
      local_sha256: localHash,
      deployed_sha256: remoteHash,
      apk_sha256: apkHash,
      local_matches_deployed: Boolean(localHash && remoteHash && localHash === remoteHash),
      local_matches_apk: Boolean(localHash && apkHash && localHash === apkHash)
    });
  }

  const report = {
    pass: failures.length === 0,
    failures,
    preview_url: PREVIEW_URL,
    apk_path: APK_PATH,
    files
  };
  const reportPath = process.env.STUDY6_REPORT_PATH || path.join(WORKSPACE_DIR, "build", "preview-asset-alignment-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (!report.pass) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`Study 6 preview asset alignment passed: ${REQUIRED_FILES.length} deployed/local/APK assets match.`);
  console.log(reportPath);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

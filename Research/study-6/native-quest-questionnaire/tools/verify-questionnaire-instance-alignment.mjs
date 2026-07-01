#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import vm from "node:vm";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..");
const STUDY_DIR = path.resolve(WORKSPACE_DIR, "..");
const PREVIEW_DIR = path.join(STUDY_DIR, "questionnaire-ui-preview");
const LOOKUP_PATH = path.join(STUDY_DIR, "for-ai", "study6_apk_permutation_lookup.json");
const GENERATOR_PATH = path.join(STUDY_DIR, "for-ai", "generate_study6_apk_permutation_lookup.js");
const GRADLE_PATH = path.join(WORKSPACE_DIR, "quest-app", "build.gradle.kts");
const PREVIEW_URL = process.env.STUDY6_PREVIEW_URL || "";

const REQUIRED_FILES = [
  "index.html",
  "styles.css",
  "questionnaire-item-library.js",
  "panel-preview.js"
];

const ASSESSMENT_PAGE_IDS = [
  "self_assessment_manikin",
  "affect_vas",
  "emotion_representation_vas",
  "hand_embodiment"
];

function normalizeText(value) {
  return value.replace(/\r\n/g, "\n");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(normalizeText(value), "utf8").digest("hex").toUpperCase();
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
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

function evaluateItemLibrary(scriptText, label) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(scriptText, sandbox, { filename: label });
  const library = sandbox.window.STUDY6_QUESTIONNAIRE_ITEM_LIBRARY;
  if (!library || !Array.isArray(library.items) || !Array.isArray(library.pages)) {
    throw new Error(`${label} did not expose STUDY6_QUESTIONNAIRE_ITEM_LIBRARY.items/pages`);
  }
  return JSON.parse(JSON.stringify(library));
}

function itemById(library) {
  return new Map(library.items.map((item) => [item.id, item]));
}

function itemIdsForPage(library, pageId) {
  const ids = [];
  const page = library.pages.find((candidate) => candidate.id === pageId);
  if (!page) {
    return ids;
  }
  for (const group of page.groups || []) {
    ids.push(...(group.fields || []));
  }
  return ids;
}

function scaleForItem(item) {
  return `${item.min}-${item.max}`;
}

function lookupIdForItem(item) {
  if (item.page === "self_assessment_manikin") {
    return {
      valence: "SAM1",
      arousal: "SAM2",
      dominance: "SAM3"
    }[item.scale_id];
  }
  if (item.page === "affect_vas") {
    return {
      valence_raw_0_100: "valence",
      arousal_raw_0_100: "arousal"
    }[item.field];
  }
  if (item.page === "emotion_representation_vas") {
    return item.label;
  }
  if (item.page === "hand_embodiment") {
    return {
      ownership: "Ownership",
      agency: "Agency"
    }[item.construct_id];
  }
  return null;
}

function canonicalQuestionnaireRows(library) {
  const byId = itemById(library);
  const rows = [];
  for (const pageId of ASSESSMENT_PAGE_IDS) {
    for (const itemId of itemIdsForPage(library, pageId)) {
      const item = byId.get(itemId);
      if (!item || item.editable !== "editable") {
        continue;
      }
      const lookupId = lookupIdForItem(item);
      if (!lookupId) {
        throw new Error(`No lookup item id mapping for preview item ${item.id}`);
      }
      rows.push({
        item_id: lookupId,
        label: item.label,
        scale: scaleForItem(item)
      });
    }
  }
  return rows;
}

function extractGeneratorQuestionnaireItems(sourceText) {
  const match = sourceText.match(/const questionnaireItems = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error("Could not find questionnaireItems array in lookup generator");
  }
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`result = ${match[1]}`, sandbox, { filename: GENERATOR_PATH });
  return JSON.parse(JSON.stringify(sandbox.result));
}

function signature(library) {
  return {
    id: library.id,
    version: library.version,
    pages: library.pages,
    assessment_items: library.items.filter((item) => ASSESSMENT_PAGE_IDS.includes(item.page))
  };
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
        failures.push(`deployed preview did not expose ${file}`);
      } else if (file !== "index.html") {
        remoteTexts.set(file, await fetchText(remoteUrls.get(file)));
      }
    }
  }

  const files = [];
  for (const file of REQUIRED_FILES) {
    const localPath = path.join(PREVIEW_DIR, file);
    const localText = fs.existsSync(localPath) ? fs.readFileSync(localPath, "utf8") : null;
    const deployedText = remoteTexts.get(file) || null;
    const localSha = localText == null ? null : sha256Text(localText);
    const deployedSha = deployedText == null ? null : sha256Text(deployedText);
    if (!localText) {
      failures.push(`local preview missing ${file}`);
    }
    if (PREVIEW_URL && !deployedText) {
      failures.push(`deployed preview missing ${file}`);
    }
    if (PREVIEW_URL && localSha && deployedSha && localSha !== deployedSha) {
      failures.push(`${file} local hash ${localSha} != deployed hash ${deployedSha}`);
    }
    files.push({
      file,
      local_sha256: localSha,
      deployed_sha256: deployedSha,
      local_matches_deployed: PREVIEW_URL ? Boolean(localSha && deployedSha && localSha === deployedSha) : null
    });
  }

  const localLibrary = evaluateItemLibrary(fs.readFileSync(path.join(PREVIEW_DIR, "questionnaire-item-library.js"), "utf8"), "local questionnaire-item-library.js");
  const deployedLibrary = PREVIEW_URL && remoteTexts.has("questionnaire-item-library.js")
    ? evaluateItemLibrary(remoteTexts.get("questionnaire-item-library.js"), "deployed questionnaire-item-library.js")
    : null;
  const canonicalLibrary = deployedLibrary || localLibrary;
  const canonicalSignature = signature(canonicalLibrary);
  const localSignature = signature(localLibrary);
  if (deployedLibrary && !equalJson(localSignature, canonicalSignature)) {
    failures.push("local questionnaire item library metadata differs from deployed preview");
  }

  const expectedRows = canonicalQuestionnaireRows(canonicalLibrary);
  const lookupRows = readJson(LOOKUP_PATH).questionnaire_items || [];
  if (!equalJson(lookupRows, expectedRows)) {
    failures.push(`lookup questionnaire_items differ from deployed preview: expected ${stableJson(expectedRows)} observed ${stableJson(lookupRows)}`);
  }

  const generatorRows = extractGeneratorQuestionnaireItems(fs.readFileSync(GENERATOR_PATH, "utf8"));
  if (!equalJson(generatorRows, expectedRows)) {
    failures.push("lookup generator questionnaireItems array differs from deployed preview");
  }

  for (const fixtureName of ["default-state.json", "edge-cases.json"]) {
    const fixturePath = path.join(PREVIEW_DIR, "fixtures", fixtureName);
    const fixture = readJson(fixturePath);
    const fixtureLibrary = fixture.questionnaire_item_library;
    if (!fixtureLibrary || !equalJson(signature(fixtureLibrary), canonicalSignature)) {
      failures.push(`${fixtureName} questionnaire_item_library differs from canonical preview`);
    }
  }

  const gradleText = fs.readFileSync(GRADLE_PATH, "utf8");
  if (gradleText.includes('from(studyRoot.resolve("questionnaire-ui-preview"))')) {
    failures.push("quest-app Gradle asset sync still packages questionnaire-ui-preview into the native APK");
  }

  const previewReadme = fs.readFileSync(path.join(PREVIEW_DIR, "README.md"), "utf8");
  const stalePhrases = [
    "`Inactive` to `Active`",
    "How active did you feel during this experience?",
    "How positive or negative did you feel during the last session?",
    "Very negative",
    "How active or inactive did you feel during the last session?",
    "Very inactive"
  ];
  for (const phrase of stalePhrases) {
    if (previewReadme.includes(phrase)) {
      failures.push(`questionnaire-ui-preview/README.md still contains stale wording: ${phrase}`);
    }
  }

  const report = {
    pass: failures.length === 0,
    failures,
    preview_url: PREVIEW_URL || null,
    deployed_preview_checked: Boolean(PREVIEW_URL),
    files,
    canonical_questionnaire_items: expectedRows,
    checked_instances: [
      PREVIEW_URL ? "deployed questionnaire-ui-preview" : "deployed questionnaire-ui-preview (skipped)",
      "local questionnaire-ui-preview",
      "questionnaire fixtures",
      "for-ai/study6_apk_permutation_lookup.json",
      "for-ai/generate_study6_apk_permutation_lookup.js",
      "quest-app Gradle native-APK asset boundary",
      "questionnaire-ui-preview/README.md stale wording scan"
    ]
  };

  const reportPath = process.env.STUDY6_REPORT_PATH || path.join(WORKSPACE_DIR, "build", "questionnaire-instance-alignment-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (!report.pass) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const scope = PREVIEW_URL ? "deployed/local/backend" : "local/backend";
  console.log(`Study 6 questionnaire instance alignment passed: ${expectedRows.length} canonical response items match ${scope} instances; APK preview packaging is absent.`);
  console.log(reportPath);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

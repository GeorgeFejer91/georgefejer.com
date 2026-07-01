#!/usr/bin/env node
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..");
const STUDY_DIR = path.resolve(WORKSPACE_DIR, "..");
const LOOKUP_PATH = path.join(STUDY_DIR, "for-ai", "study6_apk_permutation_lookup.json");
const APK_PATH = process.env.STUDY6_APK || path.join(WORKSPACE_DIR, "quest-app", "build", "outputs", "apk", "debug", "quest-app-debug.apk");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

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

function extractApkLookup(apkPath) {
  if (!fs.existsSync(apkPath)) {
    return null;
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "study6-apk-lookup-"));
  try {
    run("tar", ["-xf", apkPath, "-C", tempDir, "assets/for-ai/study6_apk_permutation_lookup.json"]);
    const extracted = path.join(tempDir, "assets", "for-ai", "study6_apk_permutation_lookup.json");
    return fs.existsSync(extracted) ? fs.readFileSync(extracted) : null;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function duplicateValues(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      dupes.add(value);
    }
    seen.add(value);
  }
  return [...dupes];
}

function byId(items, field, id) {
  return items.find((item) => item[field] === id);
}

function sequenceKey(rows, field) {
  return rows
    .slice()
    .sort((a, b) => a.block_order - b.block_order)
    .map((row) => row[field])
    .join(">");
}

const lookup = readJson(LOOKUP_PATH);
const failures = [];

if (lookup.schema_id !== "study6_apk_condition_audio_lookup_v1") {
  failures.push(`unexpected schema_id ${lookup.schema_id}`);
}
if (!Array.isArray(lookup.apk_variants) || lookup.apk_variants.length !== 2) {
  failures.push("expected exactly two APK variants");
}
if (!Array.isArray(lookup.conditions) || lookup.conditions.length !== 4) {
  failures.push("expected exactly four VR conditions");
}
if (!Array.isArray(lookup.audio_variants) || lookup.audio_variants.length !== 4) {
  failures.push("expected exactly four audio variants");
}
if (!Array.isArray(lookup.condition_permutations) || lookup.condition_permutations.length !== 24) {
  failures.push("expected 24 condition permutations");
}
if (!Array.isArray(lookup.audio_permutations) || lookup.audio_permutations.length !== 24) {
  failures.push("expected 24 audio permutations");
}
if (!Array.isArray(lookup.participant_allocation) || lookup.participant_allocation.length !== 100) {
  failures.push("expected 100 participant allocation rows");
}
if (!Array.isArray(lookup.questionnaire_items) || lookup.questionnaire_items.length !== 13) {
  failures.push("expected 13 questionnaire items");
}

const conditionIds = lookup.conditions.map((row) => row.vr_condition_id);
const audioIds = lookup.audio_variants.map((row) => row.audio_variant_id);
const itemIds = lookup.questionnaire_items.map((row) => row.item_id);
const apkIds = lookup.apk_variants.map((row) => row.apk_variant_id);

for (const [label, values] of [
  ["condition IDs", conditionIds],
  ["audio IDs", audioIds],
  ["questionnaire item IDs", itemIds],
  ["APK variant IDs", apkIds],
  ["participant IDs", lookup.participant_allocation.map((row) => row.participant_id)]
]) {
  const dupes = duplicateValues(values);
  if (dupes.length > 0) {
    failures.push(`duplicate ${label}: ${dupes.join(", ")}`);
  }
}

const expectedItems = [
  { item_id: "SAM1", label: "Retrospective Self-Assessment Manikin pictograph valence", scale: "1-9" },
  { item_id: "SAM2", label: "Retrospective Self-Assessment Manikin pictograph arousal", scale: "1-9" },
  { item_id: "SAM3", label: "Retrospective Self-Assessment Manikin pictograph dominance/control", scale: "1-9" },
  { item_id: "valence", label: "Retrospective valence VAS", scale: "0-100" },
  { item_id: "arousal", label: "Retrospective arousal VAS", scale: "0-100" },
  { item_id: "Anger", label: "Anger", scale: "0-100" },
  { item_id: "Disgust", label: "Disgust", scale: "0-100" },
  { item_id: "Fear", label: "Fear", scale: "0-100" },
  { item_id: "Happiness", label: "Happiness", scale: "0-100" },
  { item_id: "Sadness", label: "Sadness", scale: "0-100" },
  { item_id: "Surprise", label: "Surprise", scale: "0-100" },
  { item_id: "Ownership", label: "Adapted VEQ hand ownership", scale: "1-7" },
  { item_id: "Agency", label: "Adapted VEQ hand agency", scale: "1-7" }
];
if (itemIds.join(",") !== expectedItems.map((item) => item.item_id).join(",")) {
  failures.push(`questionnaire item order mismatch: ${itemIds.join(",")}`);
}
for (let index = 0; index < expectedItems.length; index += 1) {
  const expected = expectedItems[index];
  const observed = lookup.questionnaire_items[index] || {};
  for (const field of ["item_id", "label", "scale"]) {
    if (observed[field] !== expected[field]) {
      failures.push(`questionnaire item ${index + 1} ${field} expected ${expected[field]} observed ${observed[field]}`);
    }
  }
}

const conditionSequenceKeys = new Set();
for (const permutation of lookup.condition_permutations) {
  if (!/^perm_\d{2}$/.test(permutation.permutation_id)) {
    failures.push(`bad condition permutation id ${permutation.permutation_id}`);
  }
  const rows = permutation.block_order || [];
  if (rows.length !== 4) {
    failures.push(`${permutation.permutation_id} condition block count ${rows.length}`);
    continue;
  }
  const blockOrders = rows.map((row) => row.block_order).sort((a, b) => a - b).join(",");
  if (blockOrders !== "1,2,3,4") {
    failures.push(`${permutation.permutation_id} condition block orders ${blockOrders}`);
  }
  const ids = rows.map((row) => row.vr_condition_id);
  if (new Set(ids).size !== 4 || ids.some((id) => !conditionIds.includes(id))) {
    failures.push(`${permutation.permutation_id} condition IDs invalid ${ids.join(",")}`);
  }
  conditionSequenceKeys.add(sequenceKey(rows, "vr_condition_id"));
}
if (conditionSequenceKeys.size !== 24) {
  failures.push(`condition permutations are not 24 unique sequences, observed ${conditionSequenceKeys.size}`);
}

const audioSequenceKeys = new Set();
for (const permutation of lookup.audio_permutations) {
  if (!/^perm_\d{2}$/.test(permutation.permutation_id)) {
    failures.push(`bad audio permutation id ${permutation.permutation_id}`);
  }
  const rows = permutation.audio_order || [];
  if (rows.length !== 4) {
    failures.push(`${permutation.permutation_id} audio block count ${rows.length}`);
    continue;
  }
  const blockOrders = rows.map((row) => row.block_order).sort((a, b) => a - b).join(",");
  if (blockOrders !== "1,2,3,4") {
    failures.push(`${permutation.permutation_id} audio block orders ${blockOrders}`);
  }
  const ids = rows.map((row) => row.audio_variant_id);
  if (new Set(ids).size !== 4 || ids.some((id) => !audioIds.includes(id))) {
    failures.push(`${permutation.permutation_id} audio IDs invalid ${ids.join(",")}`);
  }
  audioSequenceKeys.add(sequenceKey(rows, "audio_variant_id"));
}
if (audioSequenceKeys.size !== 24) {
  failures.push(`audio permutations are not 24 unique sequences, observed ${audioSequenceKeys.size}`);
}

for (let index = 0; index < lookup.participant_allocation.length; index += 1) {
  const row = lookup.participant_allocation[index];
  const expectedId = `P${String(index + 1).padStart(3, "0")}`;
  if (row.participant_id !== expectedId) {
    failures.push(`participant row ${index + 1} expected ${expectedId} observed ${row.participant_id}`);
  }
  const expectedPermutation = `perm_${String((index % 24) + 1).padStart(2, "0")}`;
  if (row.permutation_id !== expectedPermutation) {
    failures.push(`${row.participant_id} expected ${expectedPermutation} observed ${row.permutation_id}`);
  }
  if (!byId(lookup.condition_permutations, "permutation_id", row.permutation_id)) {
    failures.push(`${row.participant_id} missing condition permutation ${row.permutation_id}`);
  }
  if (!byId(lookup.audio_permutations, "permutation_id", row.permutation_id)) {
    failures.push(`${row.participant_id} missing audio permutation ${row.permutation_id}`);
  }
}

const expectedCountsByPermutation = new Map();
for (const row of lookup.participant_allocation) {
  expectedCountsByPermutation.set(row.permutation_id, (expectedCountsByPermutation.get(row.permutation_id) || 0) + 1);
}
for (let i = 1; i <= 24; i += 1) {
  const permutationId = `perm_${String(i).padStart(2, "0")}`;
  const count = expectedCountsByPermutation.get(permutationId) || 0;
  const expectedCount = i <= 4 ? 5 : 4;
  if (count !== expectedCount) {
    failures.push(`${permutationId} participant allocation count expected ${expectedCount} observed ${count}`);
  }
}

const expectedResponseIds = new Set();
const expectedBlockStems = new Set();
for (const apk of lookup.apk_variants) {
  for (const participant of lookup.participant_allocation) {
    const conditionPermutation = byId(lookup.condition_permutations, "permutation_id", participant.permutation_id);
    const audioPermutation = byId(lookup.audio_permutations, "permutation_id", participant.permutation_id);
    for (const block of conditionPermutation.block_order) {
      const blockId = `B${String(block.block_order).padStart(2, "0")}`;
      const audioBlock = audioPermutation.audio_order.find((row) => row.block_order === block.block_order);
      if (!audioBlock) {
        failures.push(`${participant.participant_id} ${blockId} missing audio block`);
        continue;
      }
      const blockFileStem = `${apk.apk_file_code}_${participant.participant_id}_${blockId}_${block.vr_condition_id}`;
      expectedBlockStems.add(blockFileStem);
      for (const item of lookup.questionnaire_items) {
        expectedResponseIds.add(`${blockFileStem}_${item.item_id}`);
      }
    }
  }
}
const expectedBlockStemCount = lookup.apk_variants.length * lookup.participant_allocation.length * 4;
const expectedResponseIdCount = expectedBlockStemCount * lookup.questionnaire_items.length;
if (expectedBlockStems.size !== expectedBlockStemCount) {
  failures.push(`expected ${expectedBlockStemCount} unique block stems, observed ${expectedBlockStems.size}`);
}
if (expectedResponseIds.size !== expectedResponseIdCount) {
  failures.push(`expected ${expectedResponseIdCount} unique response IDs, observed ${expectedResponseIds.size}`);
}

for (const audio of lookup.audio_variants) {
  for (const language of ["en", "de"]) {
    const file = audio.audio_asset_file_by_language && audio.audio_asset_file_by_language[language];
    if (!file || !fs.existsSync(path.join(STUDY_DIR, "neutral-hand-audio", "audio", file))) {
      failures.push(`missing audio asset ${audio.audio_variant_id} ${language}: ${file}`);
    }
  }
}

let packagedLookupHash = null;
const sourceLookupBytes = fs.readFileSync(LOOKUP_PATH);
const sourceLookupHash = sha256Buffer(sourceLookupBytes);
const packagedLookup = extractApkLookup(APK_PATH);
if (!packagedLookup) {
  failures.push(`APK packaged lookup missing: ${APK_PATH}`);
} else {
  packagedLookupHash = sha256Buffer(packagedLookup);
  if (packagedLookupHash !== sourceLookupHash) {
    failures.push(`APK packaged lookup hash mismatch ${packagedLookupHash} != ${sourceLookupHash}`);
  }
}

const report = {
  pass: failures.length === 0,
  failures,
  lookup_path: LOOKUP_PATH,
  lookup_sha256: sourceLookupHash,
  apk_path: APK_PATH,
  apk_sha256: fs.existsSync(APK_PATH) ? sha256File(APK_PATH) : null,
  apk_packaged_lookup_sha256: packagedLookupHash,
  apk_variant_count: lookup.apk_variants.length,
  condition_count: lookup.conditions.length,
  audio_variant_count: lookup.audio_variants.length,
  condition_permutation_count: lookup.condition_permutations.length,
  audio_permutation_count: lookup.audio_permutations.length,
  unique_condition_permutation_sequences: conditionSequenceKeys.size,
  unique_audio_permutation_sequences: audioSequenceKeys.size,
  participant_count: lookup.participant_allocation.length,
  questionnaire_item_count: lookup.questionnaire_items.length,
  unique_block_stem_count: expectedBlockStems.size,
  unique_response_id_count: expectedResponseIds.size
};

const reportPath = process.env.STUDY6_REPORT_PATH || path.join(WORKSPACE_DIR, "build", "lookup-contract-report.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (!report.pass) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(`Study 6 lookup contract passed: 24 condition/audio permutations, ${expectedResponseIds.size} response IDs across ${lookup.apk_variants.length} APK variants.`);
console.log(reportPath);

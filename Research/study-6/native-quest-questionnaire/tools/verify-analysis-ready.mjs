#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..");
const STUDY_DIR = path.resolve(WORKSPACE_DIR, "..");
const LOOKUP_PATH = path.join(STUDY_DIR, "for-ai", "study6_apk_permutation_lookup.json");

const APK_VARIANT_ID = process.env.STUDY6_APK_VARIANT_ID || "BG_ENV";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function csvParse(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function csvObjects(file) {
  const rows = csvParse(fs.readFileSync(file, "utf8"));
  const header = rows.shift() || [];
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] || ""])));
}

function byId(items, field, id) {
  const found = items.find((item) => item[field] === id);
  if (!found) {
    throw new Error(`Missing ${field}=${id}`);
  }
  return found;
}

function ensureFile(file, failures) {
  if (!fs.existsSync(file)) {
    failures.push(`missing file ${file}`);
    return false;
  }
  return true;
}

function normalizeExportRoot(input, lookup) {
  const candidate = path.resolve(input);
  if (fs.existsSync(path.join(candidate, "analysis_ready")) && fs.existsSync(path.join(candidate, "raw_context"))) {
    return candidate;
  }
  const nested = path.join(candidate, "Study6DataExport", APK_VARIANT_ID);
  if (fs.existsSync(path.join(nested, "analysis_ready")) && fs.existsSync(path.join(nested, "raw_context"))) {
    return nested;
  }
  const directNested = path.join(candidate, APK_VARIANT_ID);
  if (fs.existsSync(path.join(directNested, "analysis_ready")) && fs.existsSync(path.join(directNested, "raw_context"))) {
    return directNested;
  }
  const apk = byId(lookup.apk_variants, "apk_variant_id", APK_VARIANT_ID);
  const legacySibling = path.join(candidate, apk.data_folder, "Study6DataExport", APK_VARIANT_ID);
  if (fs.existsSync(path.join(legacySibling, "analysis_ready")) && fs.existsSync(path.join(legacySibling, "raw_context"))) {
    return legacySibling;
  }
  throw new Error(`Input does not contain Study6DataExport/${APK_VARIANT_ID}: ${candidate}`);
}

function expectedParticipantIds(lookup, allocationState, responseRows) {
  const expectedFromEnv = (process.env.STUDY6_EXPECTED_PARTICIPANTS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (expectedFromEnv.length > 0) {
    return expectedFromEnv;
  }
  const completed = allocationState.completed_participant_ids || [];
  if (completed.length > 0) {
    return completed;
  }
  const ids = new Set(responseRows.map((row) => row.participant_id).filter(Boolean));
  return lookup.participant_allocation
    .map((row) => row.participant_id)
    .filter((participantId) => ids.has(participantId));
}

function blockStemFor(lookup, apk, participantId, blockOrder) {
  const participant = byId(lookup.participant_allocation, "participant_id", participantId);
  const permutation = byId(lookup.condition_permutations, "permutation_id", participant.permutation_id);
  const block = permutation.block_order.find((row) => row.block_order === blockOrder);
  if (!block) {
    throw new Error(`Missing block ${blockOrder} for ${participantId}`);
  }
  const blockId = `B${String(blockOrder).padStart(2, "0")}`;
  return `${apk.apk_file_code}_${participantId}_${blockId}_${block.vr_condition_id}`;
}

function main() {
  const inputRoot = process.argv[2] || process.env.STUDY6_EXPORT_ROOT;
  if (!inputRoot) {
    throw new Error("Usage: verify-analysis-ready.mjs <Study6DataExport or Study6DataExport/BG_ENV folder>");
  }

  const canonicalLookup = readJson(LOOKUP_PATH);
  const exportRoot = normalizeExportRoot(inputRoot, canonicalLookup);
  const rawContext = path.join(exportRoot, "raw_context");
  const lookup = readJson(path.join(rawContext, "condition_audio_lookup.json"));
  const apk = byId(lookup.apk_variants, "apk_variant_id", APK_VARIANT_ID);
  const failures = [];

  if (lookup.schema_id !== canonicalLookup.schema_id) {
    failures.push(`lookup schema mismatch: ${lookup.schema_id} != ${canonicalLookup.schema_id}`);
  }

  const analysisReady = path.join(exportRoot, "analysis_ready");
  const psychPath = path.join(analysisReady, `study6_${apk.apk_file_code}_psychometrics_wide.csv`);
  const demographicsPath = path.join(analysisReady, "demographics", `study6_${apk.apk_file_code}_demographics.csv`);
  const rawResponsePath = path.join(rawContext, "long_form", "questionnaire_responses_long.csv");
  const allocationStatePath = path.join(rawContext, "allocation_state.json");
  ensureFile(psychPath, failures);
  ensureFile(demographicsPath, failures);
  ensureFile(rawResponsePath, failures);
  ensureFile(allocationStatePath, failures);

  const responseRows = fs.existsSync(rawResponsePath) ? csvObjects(rawResponsePath) : [];
  const allocationState = fs.existsSync(allocationStatePath) ? readJson(allocationStatePath) : {};
  const expectedParticipants = expectedParticipantIds(lookup, allocationState, responseRows);
  const psychRows = fs.existsSync(psychPath) ? csvObjects(psychPath) : [];
  const demographicsRows = fs.existsSync(demographicsPath) ? csvObjects(demographicsPath) : [];
  const psychByParticipant = new Map(psychRows.map((row) => [row.participant_id, row]));
  const demographicsByParticipant = new Map(demographicsRows.map((row) => [row.participant_id, row]));
  const rawByKey = new Map();
  for (const row of responseRows) {
    rawByKey.set(`${row.participant_id}|${row.vr_condition_id}|${row.item_id}`, row.item_value);
  }

  const conditionIds = lookup.conditions.map((condition) => condition.vr_condition_id);
  const itemIds = lookup.questionnaire_items.map((item) => item.item_id);
  const expectedColumns = ["participant_id", ...conditionIds.flatMap((conditionId) => itemIds.map((itemId) => `${conditionId}_${itemId}`))];
  const observedColumns = fs.existsSync(psychPath) ? csvParse(fs.readFileSync(psychPath, "utf8"))[0] || [] : [];
  if (observedColumns.join(",") !== expectedColumns.join(",")) {
    failures.push(`psychometrics header mismatch\nexpected ${expectedColumns.join(",")}\nobserved ${observedColumns.join(",")}`);
  }

  for (const participantId of expectedParticipants) {
    const psychRow = psychByParticipant.get(participantId);
    if (!psychRow) {
      failures.push(`psychometrics wide CSV missing ${participantId}`);
      continue;
    }
    for (const conditionId of conditionIds) {
      for (const itemId of itemIds) {
        const column = `${conditionId}_${itemId}`;
        const expected = rawByKey.get(`${participantId}|${conditionId}|${itemId}`);
        if (psychRow[column] !== expected) {
          failures.push(`${participantId} ${column} expected ${expected} observed ${psychRow[column]}`);
        }
      }
    }
    if (!demographicsByParticipant.has(participantId)) {
      failures.push(`demographics CSV missing ${participantId}`);
    }
    for (let blockOrder = 1; blockOrder <= 4; blockOrder += 1) {
      const stem = blockStemFor(lookup, apk, participantId, blockOrder);
      const ecg = path.join(analysisReady, "block_ecg", `${stem}_ECG_PolarH10.csv`);
      ensureFile(ecg, failures);
    }
  }

  const analysisFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const current = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(current);
      } else {
        analysisFiles.push(current);
      }
    }
  }
  if (fs.existsSync(analysisReady)) {
    walk(analysisReady);
  }
  const forbidden = analysisFiles.filter((file) => /\.(json|jsonl|txt|png)$/i.test(file) || /session_ECG_PolarH10_master/i.test(path.basename(file)));
  for (const file of forbidden) {
    failures.push(`analysis_ready contains forbidden file ${file}`);
  }

  const expectedFileCount = 2 + (4 * expectedParticipants.length);
  if (analysisFiles.length !== expectedFileCount) {
    failures.push(`analysis_ready file count expected ${expectedFileCount} observed ${analysisFiles.length}`);
  }
  if (psychRows.length !== expectedParticipants.length) {
    failures.push(`psychometrics row count expected ${expectedParticipants.length} observed ${psychRows.length}`);
  }

  const report = {
    pass: failures.length === 0,
    failures,
    export_root: exportRoot,
    apk_variant_id: APK_VARIANT_ID,
    expected_participants: expectedParticipants,
    psychometrics_rows: psychRows.length,
    analysis_ready_file_count: analysisFiles.length
  };
  const reportPath = process.env.STUDY6_ANALYSIS_REPORT_PATH || path.join(path.dirname(exportRoot), "analysis-ready-expected-vs-observed.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (!report.pass) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`Study 6 analysis-ready verification passed: ${psychRows.length} participants, ${analysisFiles.length} files.`);
  console.log(reportPath);
}

main();

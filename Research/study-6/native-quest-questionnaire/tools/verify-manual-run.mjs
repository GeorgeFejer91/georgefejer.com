#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..");
const STUDY_DIR = path.resolve(WORKSPACE_DIR, "..");
const LOOKUP_PATH = path.join(STUDY_DIR, "for-ai", "study6_apk_permutation_lookup.json");

const APK_VARIANT_ID = process.env.STUDY6_APK_VARIANT_ID || "BG_ENV";
const DEV_DURATION_SECONDS = Number(process.env.STUDY6_DEV_DURATION_SECONDS || 20);
const MANUAL_PARTICIPANT_ID = process.env.STUDY6_MANUAL_PARTICIPANT_ID || "";

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

function normalizeObservedRoot(input, lookup) {
  const candidate = path.resolve(input);
  if (fs.existsSync(path.join(candidate, "condition_audio_lookup.json"))) {
    return candidate;
  }
  const apk = byId(lookup.apk_variants, "apk_variant_id", APK_VARIANT_ID);
  const nested = path.join(candidate, apk.data_folder);
  if (fs.existsSync(path.join(nested, "condition_audio_lookup.json"))) {
    return nested;
  }
  throw new Error(`Observed root does not contain condition_audio_lookup.json: ${candidate}`);
}

function latestParticipantId(completed) {
  return [...completed].sort((a, b) => {
    const na = Number(String(a).replace(/\D/g, ""));
    const nb = Number(String(b).replace(/\D/g, ""));
    return nb - na;
  })[0] || "";
}

function jsonl(file) {
  return fs.readFileSync(file, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function nestedValue(result, itemId) {
  const answers = result.answers && result.answers.emotion_assessment;
  if (!answers) {
    return undefined;
  }
  const fields = {
    SAM1: ["sam", "valence_raw_1_9"],
    SAM2: ["sam", "arousal_raw_1_9"],
    SAM3: ["sam", "dominance_raw_1_9"],
    valence: ["affect_vas", "valence_raw_0_100"],
    arousal: ["affect_vas", "arousal_raw_0_100"],
    Anger: ["emotion_representation_vas", "anger_raw_0_100"],
    Fear: ["emotion_representation_vas", "fear_raw_0_100"],
    Sadness: ["emotion_representation_vas", "sadness_raw_0_100"],
    Disgust: ["emotion_representation_vas", "disgust_raw_0_100"],
    Happiness: ["emotion_representation_vas", "happiness_raw_0_100"],
    Surprise: ["emotion_representation_vas", "surprise_raw_0_100"],
    Ownership: ["hand_embodiment", "ownership_raw_1_7"],
    Agency: ["hand_embodiment", "agency_raw_1_7"]
  };
  const [group, field] = fields[itemId] || [];
  return group && answers[group] ? answers[group][field] : undefined;
}

function main() {
  const inputRoot = process.argv[2] || process.env.STUDY6_OBSERVED_ROOT;
  if (!inputRoot) {
    throw new Error("Usage: verify-manual-run.mjs <pulled Study_particle_*_data folder>");
  }

  const canonicalLookup = readJson(LOOKUP_PATH);
  const root = normalizeObservedRoot(inputRoot, canonicalLookup);
  const lookup = readJson(path.join(root, "condition_audio_lookup.json"));
  const apk = byId(lookup.apk_variants, "apk_variant_id", APK_VARIANT_ID);
  const allocationState = readJson(path.join(root, "allocation_state.json"));
  const completed = allocationState.completed_participant_ids || [];
  const participantId = MANUAL_PARTICIPANT_ID || latestParticipantId(completed);
  const participant = byId(lookup.participant_allocation, "participant_id", participantId);
  const conditionPermutation = byId(lookup.condition_permutations, "permutation_id", participant.permutation_id);
  const audioPermutation = byId(lookup.audio_permutations, "permutation_id", participant.permutation_id);
  const dataDir = path.join(root, "data");
  const demographicsDir = path.join(root, "demographics");
  const failures = [];

  if (!completed.includes(participantId)) {
    failures.push(`allocation_state.json does not mark ${participantId} completed`);
  }

  const demographicsPath = path.join(demographicsDir, `${participantId}_demographics.json`);
  if (ensureFile(demographicsPath, failures)) {
    const demographics = readJson(demographicsPath);
    if (!demographics.complete || !demographics.consent_confirmed) {
      failures.push(`${participantId} demographics incomplete or missing consent`);
    }
  }

  const responseCsv = path.join(dataDir, "questionnaire_responses_long.csv");
  const metadataCsv = path.join(dataDir, "block_metadata_long.csv");
  ensureFile(responseCsv, failures);
  ensureFile(metadataCsv, failures);
  const responseRows = fs.existsSync(responseCsv) ? csvObjects(responseCsv) : [];
  const metadataRows = fs.existsSync(metadataCsv) ? csvObjects(metadataCsv) : [];
  const rowsByResponseId = new Map(responseRows.map((row) => [row.response_id, row]));
  const metadataByStem = new Map(metadataRows.map((row) => [row.block_file_stem, row]));
  const ecgMasterPath = path.join(dataDir, `${apk.apk_file_code}_${participantId}_session_ECG_PolarH10_master.csv`);
  const markerPath = path.join(dataDir, `${apk.apk_file_code}_${participantId}_session_markers.jsonl`);
  ensureFile(ecgMasterPath, failures);
  ensureFile(markerPath, failures);
  const markers = fs.existsSync(markerPath) ? jsonl(markerPath) : [];
  const sessionMarkerTypes = markers.map((marker) => marker.event_type);
  for (const eventType of ["session_physiology_started", "polar_connected", "polar_ecg_stream_started", "polar_ecg_stream_stopped", "session_physiology_completed"]) {
    if (!sessionMarkerTypes.includes(eventType)) {
      failures.push(`${participantId} missing session physiology marker ${eventType}`);
    }
  }
  const expectedResponseIds = [];
  const blocks = [];

  for (const conditionBlock of conditionPermutation.block_order) {
    const blockOrder = conditionBlock.block_order;
    const blockId = `B${String(blockOrder).padStart(2, "0")}`;
    const condition = byId(lookup.conditions, "vr_condition_id", conditionBlock.vr_condition_id);
    const audioBlock = audioPermutation.audio_order.find((row) => row.block_order === blockOrder);
    const audio = byId(lookup.audio_variants, "audio_variant_id", audioBlock.audio_variant_id);
    const blockFileStem = `${apk.apk_file_code}_${participantId}_${blockId}_${condition.vr_condition_id}`;
    blocks.push({ block_order: blockOrder, block_id: blockId, vr_condition_id: condition.vr_condition_id, audio_variant_id: audio.audio_variant_id, block_file_stem: blockFileStem });

    const metadataPath = path.join(dataDir, `${blockFileStem}_block_metadata.json`);
    const eventsPath = path.join(dataDir, `${blockFileStem}_events.jsonl`);
    const resultPath = path.join(dataDir, `${blockFileStem}_questionnaire_result.json`);
    const ecgPath = path.join(dataDir, `${blockFileStem}_ECG_PolarH10.csv`);
    for (const file of [metadataPath, eventsPath, resultPath, ecgPath]) {
      ensureFile(file, failures);
    }

    if (fs.existsSync(metadataPath)) {
      const metadata = readJson(metadataPath);
      if (!metadata.block_complete || metadata.technical_failure) {
        failures.push(`${blockFileStem} metadata not complete or technical_failure=true`);
      }
      if (metadata.participant_id !== participantId || metadata.vr_condition_id !== condition.vr_condition_id || metadata.audio_variant_id !== audio.audio_variant_id) {
        failures.push(`${blockFileStem} metadata assignment mismatch`);
      }
      if (Number(metadata.induction_dev_duration_s) !== DEV_DURATION_SECONDS) {
        failures.push(`${blockFileStem} dev duration mismatch`);
      }
    }

    const metadataRow = metadataByStem.get(blockFileStem);
    if (!metadataRow || metadataRow.block_complete !== "true") {
      failures.push(`${blockFileStem} missing/incomplete in block_metadata_long.csv`);
    }

    if (fs.existsSync(eventsPath)) {
      const eventTypes = jsonl(eventsPath).map((event) => event.event_type);
      for (const eventType of ["session_ready_prompt_shown", "session_start_confirmed", "block_assigned", "block_started", "ecg_recording_armed", "ecg_recording_started", "audio_started", "condition_started", "audio_stopped_dev_duration", "condition_ended", "ecg_recording_completed", "block_ecg_window_closed", "questionnaire_started", "questionnaire_completed", "result_write_success", "block_completed"]) {
        if (!eventTypes.includes(eventType)) {
          failures.push(`${blockFileStem} missing event ${eventType}`);
        }
      }
    }

    const blockMarkers = markers.filter((marker) => marker.block_file_stem === blockFileStem);
    const markerTypes = blockMarkers.map((marker) => marker.event_type);
    for (const eventType of ["session_ready_prompt_shown", "session_start_confirmed", "block_assigned", "block_started", "audio_started", "condition_started", "audio_stopped_dev_duration", "condition_ended", "block_ecg_window_closed", "questionnaire_started", "questionnaire_completed", "result_write_success", "block_completed"]) {
      if (!markerTypes.includes(eventType)) {
        failures.push(`${blockFileStem} missing physiology marker ${eventType}`);
      }
    }
    if (blockMarkers.filter((marker) => marker.event_type === "page_completed").length !== 4) {
      failures.push(`${blockFileStem} missing four page_completed physiology markers`);
    }
    for (const marker of blockMarkers) {
      if (marker.marker_schema !== "study6-physiology-marker-v1" || marker.participant_id !== participantId || marker.permutation_id !== participant.permutation_id || marker.block_id !== blockId || marker.vr_condition_id !== condition.vr_condition_id || marker.audio_variant_id !== audio.audio_variant_id) {
        failures.push(`${blockFileStem} physiology marker identity mismatch`);
        break;
      }
    }

    const result = fs.existsSync(resultPath) ? readJson(resultPath) : null;
    if (result && (!result.complete || result.participant_id !== participantId || result.vr_condition_id !== condition.vr_condition_id || result.block_id !== blockId)) {
      failures.push(`${blockFileStem} result metadata mismatch`);
    }

    for (const item of lookup.questionnaire_items) {
      const responseId = `${blockFileStem}_${item.item_id}`;
      expectedResponseIds.push(responseId);
      const row = rowsByResponseId.get(responseId);
      if (!row) {
        failures.push(`missing response ${responseId}`);
        continue;
      }
      if (row.participant_id !== participantId || row.block_id !== blockId || row.vr_condition_id !== condition.vr_condition_id || row.item_scale !== item.scale || row.item_value === "") {
        failures.push(`${responseId} CSV mismatch`);
      }
      if (result && (nestedValue(result, item.item_id) === undefined || nestedValue(result, item.item_id) === null)) {
        failures.push(`${responseId} result JSON nested value missing`);
      }
    }
  }

  const manualPath = path.join(dataDir, "manual_interactions.jsonl");
  const trustedEvents = [];
  if (ensureFile(manualPath, failures)) {
    for (const event of jsonl(manualPath).filter((row) => row.participant_id === participantId)) {
      const detail = event.detail || {};
      if (detail.is_trusted === true) {
        trustedEvents.push({ event_type: event.event_type, detail });
      }
    }
  }
  if (trustedEvents.length === 0) {
    failures.push(`${participantId} has no trusted manual interaction events`);
  }

  const trustedGroups = new Set(trustedEvents.map((event) => event.detail.target && event.detail.target.control_group).filter(Boolean));
  for (const group of ["language", "participant_first_name", "participant_last_name", "participant_age", "handedness", "gender", "consent", "session_ready", "next_page", "previous_page", "sam", "affect_vas", "emotion_representation_vas", "hand_embodiment"]) {
    if (!trustedGroups.has(group)) {
      failures.push(`${participantId} missing trusted manual group ${group}`);
    }
  }

  const trustedPages = new Set(trustedEvents.map((event) => event.detail.active_panel_page_id).filter(Boolean));
  for (const page of ["demographics", "session_ready", "vr_task_instructions", "self_assessment_manikin", "affect_vas", "emotion_representation_vas", "hand_embodiment"]) {
    if (!trustedPages.has(page)) {
      failures.push(`${participantId} missing trusted manual events on page ${page}`);
    }
  }

  const blockedAttempts = trustedEvents.filter((event) => event.event_type === "manual_next_blocked_attempt");
  if (blockedAttempts.length === 0) {
    failures.push(`${participantId} missing trusted blocked-required-state attempt`);
  }

  for (const block of blocks) {
    if (!trustedEvents.some((event) => Number(event.detail.active_block_position) === block.block_order && event.detail.target && event.detail.target.control_group === "session_ready")) {
      failures.push(`${participantId} ${block.block_id} missing trusted manual session_ready interaction`);
    }
    for (const group of ["sam", "affect_vas", "emotion_representation_vas", "hand_embodiment"]) {
      if (!trustedEvents.some((event) => Number(event.detail.active_block_position) === block.block_order && event.detail.target && event.detail.target.control_group === group)) {
        failures.push(`${participantId} ${block.block_id} missing trusted manual ${group} interaction`);
      }
    }
  }

  const report = {
    pass: failures.length === 0,
    failures,
    observed_root: root,
    apk_variant_id: APK_VARIANT_ID,
    participant_id: participantId,
    permutation_id: participant.permutation_id,
    expected_response_count: expectedResponseIds.length,
    observed_response_count_for_participant: responseRows.filter((row) => row.participant_id === participantId).length,
    trusted_manual_event_count: trustedEvents.length,
    trusted_control_groups: [...trustedGroups].sort(),
    trusted_pages: [...trustedPages].sort(),
    blocks
  };
  const reportPath = process.env.STUDY6_REPORT_PATH || path.join(path.dirname(root), "manual-run-expected-vs-observed.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (!report.pass) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`Study 6 manual run verification passed: ${participantId}, ${trustedEvents.length} trusted events, ${expectedResponseIds.length} responses.`);
  console.log(reportPath);
}

main();

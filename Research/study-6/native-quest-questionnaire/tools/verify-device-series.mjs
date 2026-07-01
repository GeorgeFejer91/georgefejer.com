#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..");
const STUDY_DIR = path.resolve(WORKSPACE_DIR, "..");
const LOOKUP_PATH = path.join(STUDY_DIR, "for-ai", "study6_apk_permutation_lookup.json");

const APK_VARIANT_ID = process.env.STUDY6_APK_VARIANT_ID || "BG_ENV";
const DEV_DURATION_SECONDS = Number(process.env.STUDY6_DEV_DURATION_SECONDS || 20);
const EXPECTED_PROFILES = parseExpectedProfiles(process.env.STUDY6_EXPECTED_PROFILES || "");

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

function jsonlObjects(file) {
  return fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
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

function parseExpectedProfiles(text) {
  const map = new Map();
  text.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [participantId, profile] = entry.split(":").map((value) => String(value || "").trim());
      if (participantId && profile) {
        map.set(participantId, profile.toLowerCase());
      }
    });
  return map;
}

function responseValue(itemId, blockOrder, profile = "linear") {
  const profiles = {
    linear: {
      SAM1: 4 + blockOrder,
      SAM2: Math.max(1, 8 - blockOrder),
      SAM3: 5,
      valence: 50 + blockOrder,
      arousal: 55 + blockOrder,
      Anger: 10 * blockOrder,
      Fear: 10 * blockOrder + 1,
      Sadness: 10 * blockOrder + 2,
      Disgust: 10 * blockOrder + 3,
      Happiness: 10 * blockOrder + 4,
      Surprise: 10 * blockOrder + 5,
      Ownership: Math.min(7, 3 + blockOrder),
      Agency: Math.min(7, 4 + blockOrder)
    },
    low: {
      SAM1: Math.max(1, 6 - blockOrder),
      SAM2: 1 + blockOrder,
      SAM3: Math.max(1, 5 - blockOrder),
      valence: 20 + blockOrder,
      arousal: 30 + blockOrder * 2,
      Anger: 4 * blockOrder,
      Fear: 4 * blockOrder + 1,
      Sadness: 4 * blockOrder + 2,
      Disgust: 4 * blockOrder + 3,
      Happiness: 4 * blockOrder + 4,
      Surprise: 4 * blockOrder + 5,
      Ownership: blockOrder,
      Agency: Math.max(1, 5 - blockOrder)
    },
    high: {
      SAM1: 9 - blockOrder,
      SAM2: 5 + blockOrder,
      SAM3: Math.min(9, 4 + blockOrder),
      valence: 75 + blockOrder,
      arousal: 80 - blockOrder,
      Anger: 70 + 2 * blockOrder,
      Fear: 70 + 2 * blockOrder + 1,
      Sadness: 70 + 2 * blockOrder + 2,
      Disgust: 70 + 2 * blockOrder + 3,
      Happiness: 70 + 2 * blockOrder + 4,
      Surprise: 70 + 2 * blockOrder + 5,
      Ownership: Math.min(7, 4 + blockOrder),
      Agency: Math.min(7, 3 + blockOrder)
    },
    zigzag: {
      SAM1: blockOrder % 2 === 0 ? 8 : 2,
      SAM2: blockOrder % 2 === 0 ? 3 : 7,
      SAM3: blockOrder % 2 === 0 ? 7 : 3,
      valence: blockOrder % 2 === 0 ? 68 : 32,
      arousal: blockOrder % 2 === 0 ? 36 : 72,
      Anger: blockOrder % 2 === 0 ? 16 : 62,
      Fear: blockOrder % 2 === 0 ? 18 : 64,
      Sadness: blockOrder % 2 === 0 ? 20 : 66,
      Disgust: blockOrder % 2 === 0 ? 22 : 68,
      Happiness: blockOrder % 2 === 0 ? 74 : 28,
      Surprise: blockOrder % 2 === 0 ? 48 : 84,
      Ownership: blockOrder % 2 === 0 ? 6 : 2,
      Agency: blockOrder % 2 === 0 ? 5 : 3
    }
  };
  return (profiles[profile] || profiles.linear)[itemId];
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

function nextParticipantAfter(lookup, participantId) {
  const index = lookup.participant_allocation.findIndex((row) => row.participant_id === participantId);
  if (index < 0 || index + 1 >= lookup.participant_allocation.length) {
    return null;
  }
  return lookup.participant_allocation[index + 1].participant_id;
}

function main() {
  const inputRoot = process.argv[2] || process.env.STUDY6_OBSERVED_ROOT;
  if (!inputRoot) {
    throw new Error("Usage: verify-device-series.mjs <pulled Study_particle_*_data folder>");
  }

  const canonicalLookup = readJson(LOOKUP_PATH);
  const root = normalizeObservedRoot(inputRoot, canonicalLookup);
  const lookup = readJson(path.join(root, "condition_audio_lookup.json"));
  const apk = byId(lookup.apk_variants, "apk_variant_id", APK_VARIANT_ID);
  const allocationState = readJson(path.join(root, "allocation_state.json"));
  const completedParticipants = allocationState.completed_participant_ids || [];
  const expectedParticipants = (process.env.STUDY6_EXPECTED_PARTICIPANTS || completedParticipants.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const failures = [];

  if (lookup.schema_id !== canonicalLookup.schema_id) {
    failures.push(`lookup schema mismatch: ${lookup.schema_id} != ${canonicalLookup.schema_id}`);
  }
  if (expectedParticipants.length === 0) {
    failures.push("no expected participants were provided or completed");
  }
  for (const participantId of expectedParticipants) {
    if (!completedParticipants.includes(participantId)) {
      failures.push(`allocation_state.json does not mark ${participantId} completed`);
    }
  }
  if (allocationState.active_participant_id !== null) {
    failures.push(`active_participant_id should be null after completed series, observed ${allocationState.active_participant_id}`);
  }
  const finalParticipantId = expectedParticipants[expectedParticipants.length - 1];
  const expectedNext = finalParticipantId ? nextParticipantAfter(lookup, finalParticipantId) : null;
  if (allocationState.next_participant_id !== expectedNext) {
    failures.push(`next_participant_id expected ${expectedNext} observed ${allocationState.next_participant_id}`);
  }

  const dataDir = path.join(root, "data");
  const demographicsDir = path.join(root, "demographics");
  const responseCsv = path.join(dataDir, "questionnaire_responses_long.csv");
  const metadataCsv = path.join(dataDir, "block_metadata_long.csv");
  ensureFile(responseCsv, failures);
  ensureFile(metadataCsv, failures);
  const responseRows = fs.existsSync(responseCsv) ? csvObjects(responseCsv) : [];
  const metadataRows = fs.existsSync(metadataCsv) ? csvObjects(metadataCsv) : [];
  const rowsByResponseId = new Map();
  const duplicateResponseIds = new Set();
  for (const row of responseRows) {
    if (rowsByResponseId.has(row.response_id)) {
      duplicateResponseIds.add(row.response_id);
    }
    rowsByResponseId.set(row.response_id, row);
  }
  for (const responseId of duplicateResponseIds) {
    failures.push(`duplicate response_id ${responseId}`);
  }
  const metadataByStem = new Map();
  const duplicateMetadataStems = new Set();
  for (const row of metadataRows) {
    if (metadataByStem.has(row.block_file_stem)) {
      duplicateMetadataStems.add(row.block_file_stem);
    }
    metadataByStem.set(row.block_file_stem, row);
  }
  for (const stem of duplicateMetadataStems) {
    failures.push(`duplicate block_metadata_long row ${stem}`);
  }

  const expectedResponseIds = [];
  const expectedBlockStems = [];
  const participantReports = [];

  for (const participantId of expectedParticipants) {
    const participant = byId(lookup.participant_allocation, "participant_id", participantId);
    const conditionPermutation = byId(lookup.condition_permutations, "permutation_id", participant.permutation_id);
    const audioPermutation = byId(lookup.audio_permutations, "permutation_id", participant.permutation_id);
    const responseProfile = EXPECTED_PROFILES.get(participantId) || "linear";
    const ecgMasterPath = path.join(dataDir, `${apk.apk_file_code}_${participantId}_session_ECG_PolarH10_master.csv`);
    const markerPath = path.join(dataDir, `${apk.apk_file_code}_${participantId}_session_markers.jsonl`);
    ensureFile(ecgMasterPath, failures);
    ensureFile(markerPath, failures);
    const markers = fs.existsSync(markerPath) ? jsonlObjects(markerPath) : [];
    const markerTypes = markers.map((marker) => marker.event_type);
    for (const eventType of ["session_physiology_started", "polar_connected", "polar_ecg_stream_started", "polar_ecg_stream_stopped", "session_physiology_completed"]) {
      if (!markerTypes.includes(eventType)) {
        failures.push(`${participantId} missing session physiology marker ${eventType}`);
      }
    }
    if (fs.existsSync(ecgMasterPath)) {
      const masterRows = csvObjects(ecgMasterPath);
      if (masterRows.length === 0) {
        failures.push(`${participantId} master ECG CSV has no samples`);
      }
      for (let i = 1; i < masterRows.length; i += 1) {
        if (Number(masterRows[i].host_received_elapsed_realtime_ns) < Number(masterRows[i - 1].host_received_elapsed_realtime_ns)) {
          failures.push(`${participantId} master ECG host timestamps are not monotonic`);
          break;
        }
      }
    }
    const freshnessMarkers = [];
    const participantReport = {
      participant_id: participantId,
      permutation_id: participant.permutation_id,
      response_profile: responseProfile,
      blocks: []
    };

    const demographicsPath = path.join(demographicsDir, `${participantId}_demographics.json`);
    if (ensureFile(demographicsPath, failures)) {
      const demographics = readJson(demographicsPath);
      if (!demographics.complete || !demographics.consent_confirmed) {
        failures.push(`${participantId} demographics incomplete or missing consent`);
      }
    }

    for (const conditionBlock of conditionPermutation.block_order) {
      const blockOrder = conditionBlock.block_order;
      const blockId = `B${String(blockOrder).padStart(2, "0")}`;
      const condition = byId(lookup.conditions, "vr_condition_id", conditionBlock.vr_condition_id);
      const audioBlock = audioPermutation.audio_order.find((row) => row.block_order === blockOrder);
      const audio = byId(lookup.audio_variants, "audio_variant_id", audioBlock.audio_variant_id);
      const blockFileStem = `${apk.apk_file_code}_${participantId}_${blockId}_${condition.vr_condition_id}`;
      expectedBlockStems.push(blockFileStem);
      participantReport.blocks.push({
        block_order: blockOrder,
        block_id: blockId,
        vr_condition_id: condition.vr_condition_id,
        audio_variant_id: audio.audio_variant_id,
        block_file_stem: blockFileStem
      });

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
        if (metadata.participant_id !== participantId || metadata.permutation_id !== participant.permutation_id) {
          failures.push(`${blockFileStem} metadata participant/permutation mismatch`);
        }
        if (metadata.vr_condition_id !== condition.vr_condition_id || metadata.audio_variant_id !== audio.audio_variant_id) {
          failures.push(`${blockFileStem} metadata assignment mismatch`);
        }
        if (Number(metadata.induction_dev_duration_s) !== DEV_DURATION_SECONDS) {
          failures.push(`${blockFileStem} dev duration mismatch`);
        }
      }

      const metadataRow = metadataByStem.get(blockFileStem);
      if (!metadataRow) {
        failures.push(`${blockFileStem} missing from block_metadata_long.csv`);
      } else if (metadataRow.participant_id !== participantId || metadataRow.vr_condition_id !== condition.vr_condition_id || metadataRow.audio_variant_id !== audio.audio_variant_id || metadataRow.block_complete !== "true") {
        failures.push(`${blockFileStem} block_metadata_long.csv mismatch`);
      }

      if (fs.existsSync(eventsPath)) {
        const events = jsonlObjects(eventsPath);
        const eventTypes = events.map((event) => event.event_type);
        const required = ["session_ready_prompt_shown", "session_start_confirmed", "block_assigned", "block_started", "ecg_recording_armed", "ecg_recording_started", "audio_started", "condition_started", "audio_stopped_dev_duration", "condition_ended", "ecg_recording_completed", "block_ecg_window_closed", "questionnaire_started", "questionnaire_completed", "result_write_success", "block_completed"];
        for (const eventType of required) {
          if (!eventTypes.includes(eventType)) {
            failures.push(`${blockFileStem} missing event ${eventType}`);
          }
        }
        if (events.filter((event) => event.event_type === "page_completed").length !== 4) {
          failures.push(`${blockFileStem} does not have four page_completed events`);
        }
      }

      const blockMarkers = markers.filter((marker) => marker.block_file_stem === blockFileStem);
      const blockMarkerTypes = blockMarkers.map((marker) => marker.event_type);
      for (const eventType of ["session_ready_prompt_shown", "session_start_confirmed", "block_assigned", "block_started", "audio_started", "condition_started", "audio_stopped_dev_duration", "condition_ended", "block_ecg_window_closed", "questionnaire_started", "questionnaire_completed", "result_write_success", "block_completed"]) {
        if (!blockMarkerTypes.includes(eventType)) {
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
        const expectedValue = responseValue(item.item_id, blockOrder, responseProfile);
        if (!row) {
          failures.push(`missing response ${responseId}`);
          continue;
        }
        if (row.participant_id !== participantId || row.block_id !== blockId || row.vr_condition_id !== condition.vr_condition_id || row.item_scale !== item.scale || Number(row.item_value) !== expectedValue) {
          failures.push(`${responseId} CSV mismatch`);
        }
        if (result && Number(nestedValue(result, item.item_id)) !== expectedValue) {
          failures.push(`${responseId} result JSON nested value mismatch`);
        }
        if (item.item_id === "SAM1") {
          freshnessMarkers.push({ block_id: blockId, observed_value: Number(row.item_value), expected_value: expectedValue });
        }
      }
    }

    participantReport.fresh_block_value_markers = freshnessMarkers;
    if (new Set(freshnessMarkers.map((marker) => marker.observed_value)).size <= 1) {
      failures.push(`${participantId} repeated blocks did not produce distinct SAM1 freshness markers`);
    }

    participantReports.push(participantReport);
  }

  const expectedResponseIdSet = new Set(expectedResponseIds);
  const expectedBlockStemSet = new Set(expectedBlockStems);
  const observedExpectedResponseRows = responseRows.filter((row) => expectedResponseIdSet.has(row.response_id));
  const observedExpectedMetadataRows = metadataRows.filter((row) => expectedBlockStemSet.has(row.block_file_stem));
  const preservedResponseRows = responseRows.filter((row) => !expectedResponseIdSet.has(row.response_id));
  const preservedMetadataRows = metadataRows.filter((row) => !expectedBlockStemSet.has(row.block_file_stem));
  if (observedExpectedResponseRows.length !== expectedResponseIds.length) {
    failures.push(`response row count for expected participants expected ${expectedResponseIds.length} observed ${observedExpectedResponseRows.length}`);
  }
  if (observedExpectedMetadataRows.length !== expectedBlockStems.length) {
    failures.push(`metadata row count for expected participants expected ${expectedBlockStems.length} observed ${observedExpectedMetadataRows.length}`);
  }

  const runtimeEventsPath = path.join(dataDir, "runtime_events.jsonl");
  if (ensureFile(runtimeEventsPath, failures)) {
    const runtimeEvents = fs.readFileSync(runtimeEventsPath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    for (const participantId of expectedParticipants) {
      if (!runtimeEvents.some((event) => event.event_type === "participant_allocated" && String(event.detail || "").startsWith(`${participantId} `))) {
        failures.push(`runtime_events.jsonl missing participant_allocated for ${participantId}`);
      }
      if (!runtimeEvents.some((event) => event.event_type === "participant_completed" && event.detail === participantId)) {
        failures.push(`runtime_events.jsonl missing participant_completed for ${participantId}`);
      }
    }
  }

  const report = {
    pass: failures.length === 0,
    failures,
    observed_root: root,
    apk_variant_id: APK_VARIANT_ID,
    expected_participants: expectedParticipants,
    completed_participants: completedParticipants,
    next_participant_id: allocationState.next_participant_id,
    expected_response_count: expectedResponseIds.length,
    observed_expected_response_count: observedExpectedResponseRows.length,
    preserved_response_count: preservedResponseRows.length,
    observed_total_response_count: responseRows.length,
    expected_block_metadata_rows: expectedBlockStems.length,
    observed_expected_block_metadata_rows: observedExpectedMetadataRows.length,
    preserved_block_metadata_rows: preservedMetadataRows.length,
    observed_total_block_metadata_rows: metadataRows.length,
    participants: participantReports
  };
  const reportPath = process.env.STUDY6_REPORT_PATH || path.join(path.dirname(root), "device-series-expected-vs-observed.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (!report.pass) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`Study 6 device series verification passed: ${expectedParticipants.length} participants, ${expectedResponseIds.length} responses.`);
  console.log(reportPath);
}

main();

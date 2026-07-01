#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..");
const STUDY_DIR = path.resolve(WORKSPACE_DIR, "..");

const LOOKUP_PATH = path.join(STUDY_DIR, "for-ai", "study6_apk_permutation_lookup.json");
const ITEM_LIBRARY_PATH = path.join(STUDY_DIR, "questionnaire-ui-preview", "questionnaire-item-library.js");
const AUDIO_DIR = path.join(STUDY_DIR, "neutral-hand-audio", "audio");
const OUT_DIR = path.join(WORKSPACE_DIR, "build", "verification", "dev-run-BG_ENV-P001");

const APK_VARIANT_ID = process.env.STUDY6_APK_VARIANT_ID || "BG_ENV";
const LANGUAGE_CODE = process.env.STUDY6_LANGUAGE_CODE || "en";
const DEV_DURATION_SECONDS = Number(process.env.STUDY6_DEV_DURATION_SECONDS || 20);
const SESSION_ID = "P001_BG_ENV_2026-06-30T120000Z";
const START_TIME = new Date("2026-06-30T12:00:00.000Z");

const PAGE_TO_EVENT = {
  self_assessment_manikin: "page_completed",
  affect_vas: "page_completed",
  emotion_representation_vas: "page_completed",
  hand_embodiment: "page_completed"
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(file, rows) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n", "utf8");
}

function appendJsonl(file, rows) {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
}

function secondsAfter(start, seconds) {
  return new Date(start.getTime() + seconds * 1000).toISOString();
}

function loadItemLibrary() {
  const code = fs.readFileSync(ITEM_LIBRARY_PATH, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: ITEM_LIBRARY_PATH });
  return sandbox.window.STUDY6_QUESTIONNAIRE_ITEM_LIBRARY;
}

function byId(items, field, id) {
  const found = items.find((item) => item[field] === id);
  if (!found) {
    throw new Error(`Missing ${field}=${id}`);
  }
  return found;
}

function responseValue(itemId, blockOrder) {
  const values = {
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
  };
  return values[itemId];
}

function nestedAnswers(blockOrder) {
  return {
    emotion_assessment: {
      sam: {
        valence_raw_1_9: responseValue("SAM1", blockOrder),
        arousal_raw_1_9: responseValue("SAM2", blockOrder),
        dominance_raw_1_9: responseValue("SAM3", blockOrder)
      },
      affect_vas: {
        valence_raw_0_100: responseValue("valence", blockOrder),
        arousal_raw_0_100: responseValue("arousal", blockOrder)
      },
      emotion_representation_vas: {
        anger_raw_0_100: responseValue("Anger", blockOrder),
        fear_raw_0_100: responseValue("Fear", blockOrder),
        sadness_raw_0_100: responseValue("Sadness", blockOrder),
        disgust_raw_0_100: responseValue("Disgust", blockOrder),
        happiness_raw_0_100: responseValue("Happiness", blockOrder),
        surprise_raw_0_100: responseValue("Surprise", blockOrder)
      },
      hand_embodiment: {
        ownership_raw_1_7: responseValue("Ownership", blockOrder),
        agency_raw_1_7: responseValue("Agency", blockOrder)
      }
    }
  };
}

function cleanOutput() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  ensureDir(OUT_DIR);
}

function main() {
  const lookup = readJson(LOOKUP_PATH);
  const itemLibrary = loadItemLibrary();
  const apk = byId(lookup.apk_variants, "apk_variant_id", APK_VARIANT_ID);
  const participant = lookup.participant_allocation[0];
  const conditionPermutation = byId(lookup.condition_permutations, "permutation_id", participant.permutation_id);
  const audioPermutation = byId(lookup.audio_permutations, "permutation_id", participant.permutation_id);
  const itemRows = lookup.questionnaire_items;

  cleanOutput();

  const root = path.join(OUT_DIR, apk.data_folder);
  const dataDir = path.join(root, "data");
  const demographicsDir = path.join(root, "demographics");
  const allocationDir = path.join(root, "allocation");
  ensureDir(dataDir);
  ensureDir(demographicsDir);
  ensureDir(allocationDir);

  fs.copyFileSync(LOOKUP_PATH, path.join(root, "condition_audio_lookup.json"));
  writeJson(path.join(root, "allocation_state.json"), {
    apk_variant_id: apk.apk_variant_id,
    data_folder: apk.data_folder,
    lookup_file: "condition_audio_lookup.json",
    next_participant_id: "P002",
    active_participant_id: null,
    completed_participant_ids: [participant.participant_id],
    failed_or_retest_participant_ids: [],
    last_updated_utc: secondsAfter(START_TIME, 4 * DEV_DURATION_SECONDS + 40)
  });

  writeJson(path.join(demographicsDir, `${participant.participant_id}_demographics.json`), {
    participant_id: participant.participant_id,
    session_id: SESSION_ID,
    apk_variant_id: apk.apk_variant_id,
    language_code: LANGUAGE_CODE,
    participant_first_name: "Verification",
    participant_last_name: "Participant",
    participant_name: "Verification Participant",
    age_years: 29,
    handedness: "right",
    gender: "prefer_not_to_say",
    consent_confirmed: true,
    consent_text: "I consent to participate in this study.",
    polar_validation: { ready: true, source: "debug_placeholder" },
    complete: true
  });

  writeCsv(path.join(dataDir, "questionnaire_items.csv"), [
    ["item_id", "label", "scale"],
    ...itemRows.map((item) => [item.item_id, item.label, item.scale])
  ]);

  const responseRows = [[
    "response_id",
    "apk_file_code",
    "participant_id",
    "apk_variant_id",
    "block_order",
    "block_id",
    "vr_condition_id",
    "item_id",
    "item_value",
    "item_scale",
    "recorded_at_utc"
  ]];
  const blockMetadataRows = [[
    "block_file_stem",
    "participant_id",
    "apk_variant_id",
    "block_order",
    "block_id",
    "vr_condition_id",
    "audio_variant_id",
    "technical_failure",
    "block_complete"
  ]];
  const masterEcgRows = [[
    "sample_id",
    "apk_file_code",
    "participant_id",
    "apk_variant_id",
    "session_id",
    "device_id",
    "device_name",
    "device_address",
    "session_sample_index",
    "polar_sample_timestamp_ns",
    "host_received_timestamp_utc",
    "host_received_elapsed_realtime_ns",
    "ecg_raw",
    "ecg_unit",
    "contact_quality",
    "source",
    "session_recording_started_at_utc",
    "session_recording_start_elapsed_realtime_ns",
    "active_window_id",
    "active_block_order",
    "active_block_id",
    "active_block_file_stem",
    "active_vr_condition_id",
    "active_coherence_level",
    "active_energy_noise_level",
    "active_audio_variant_id",
    "active_window_start_elapsed_realtime_ns",
    "sample_offset_from_active_window_start_ns"
  ]];
  const markerRows = [];

  const expectedResponseIds = [];
  const blockSummaries = [];
  let masterSampleIndex = 0;

  function pushMarker(eventType, block, atUtc, extra = {}) {
    markerRows.push({
      marker_schema: "study6-physiology-marker-v1",
      marker_id: `${block ? block.blockFileStem : `${apk.apk_file_code}_${participant.participant_id}_session`}_${eventType}_${String(markerRows.length + 1).padStart(4, "0")}`,
      event_type: eventType,
      recorded_at_utc: atUtc,
      elapsed_realtime_ns: extra.elapsed_realtime_ns || 5000000000 + markerRows.length * 1000000,
      participant_id: participant.participant_id,
      session_id: SESSION_ID,
      apk_variant_id: apk.apk_variant_id,
      apk_file_code: apk.apk_file_code,
      mapping_target: apk.mapping_target,
      permutation_id: participant.permutation_id,
      allocation_row: participant.allocation_row,
      ecg_master_file: `data/${apk.apk_file_code}_${participant.participant_id}_session_ECG_PolarH10_master.csv`,
      physiology_marker_file: `data/${apk.apk_file_code}_${participant.participant_id}_session_markers.jsonl`,
      ...(block ? {
        block_order: block.blockOrder,
        block_id: block.blockId,
        block_file_stem: block.blockFileStem,
        condition_id: block.condition.vr_condition_id,
        vr_condition_id: block.condition.vr_condition_id,
        coherence_level: block.condition.coherence_level,
        energy_noise_level: block.condition.energy_noise_level,
        audio_variant_id: block.audio.audio_variant_id,
        audio_instruction_id: block.audio.audio_instruction_id,
        audio_asset_file: block.audioAssetFile,
        derived_block_ecg_file: `data/${block.blockFileStem}_ECG_PolarH10.csv`
      } : {}),
      device_id: "PolarH10_SIMULATED",
      polar_device_id: "PolarH10_SIMULATED",
      ...extra
    });
  }

  pushMarker("session_physiology_started", null, START_TIME.toISOString());
  pushMarker("polar_connected", null, secondsAfter(START_TIME, 1));
  pushMarker("polar_ecg_stream_started", null, secondsAfter(START_TIME, 2));

  for (const conditionBlock of conditionPermutation.block_order) {
    const blockOrder = conditionBlock.block_order;
    const blockId = `B${String(blockOrder).padStart(2, "0")}`;
    const condition = byId(lookup.conditions, "vr_condition_id", conditionBlock.vr_condition_id);
    const audioBlock = audioPermutation.audio_order.find((candidate) => candidate.block_order === blockOrder);
    const audio = byId(lookup.audio_variants, "audio_variant_id", audioBlock.audio_variant_id);
    const audioAssetFile = audio.audio_asset_file_by_language[LANGUAGE_CODE];
    const audioAssetPath = path.join(AUDIO_DIR, audioAssetFile);
    const blockFileStem = `${apk.apk_file_code}_${participant.participant_id}_${blockId}_${condition.vr_condition_id}`;
    const blockStart = secondsAfter(START_TIME, (blockOrder - 1) * (DEV_DURATION_SECONDS + 10));
    const blockEnd = secondsAfter(START_TIME, (blockOrder - 1) * (DEV_DURATION_SECONDS + 10) + DEV_DURATION_SECONDS);
    const blockContext = { blockOrder, blockId, condition, audio, audioAssetFile, blockFileStem };
    const syncStartElapsed = 5000000000 + blockOrder * 1000000000;
    const syncEndElapsed = syncStartElapsed + DEV_DURATION_SECONDS * 1000000000;

    if (!fs.existsSync(audioAssetPath)) {
      throw new Error(`Missing development audio asset: ${audioAssetPath}`);
    }

    const metadata = {
      participant_id: participant.participant_id,
      session_id: SESSION_ID,
      apk_variant_id: apk.apk_variant_id,
      apk_file_code: apk.apk_file_code,
      mapping_target: apk.mapping_target,
      apk_package_name: "com.georgefejer.study6.quest",
      apk_build_version: "dev-host-verifier",
      apk_run_position: 1,
      global_block_position: blockOrder,
      apk_block_position: blockOrder,
      permutation_id: participant.permutation_id,
      block_order: blockOrder,
      block_id: blockId,
      block_file_stem: blockFileStem,
      block_metadata_file: `data/${blockFileStem}_block_metadata.json`,
      event_log_file: `data/${blockFileStem}_events.jsonl`,
      ecg_file: `data/${blockFileStem}_ECG_PolarH10.csv`,
      questionnaire_append_file: "data/questionnaire_responses_long.csv",
      condition_id: condition.vr_condition_id,
      vr_condition_id: condition.vr_condition_id,
      coherence_level: condition.coherence_level,
      energy_noise_level: condition.energy_noise_level,
      audio_variant_id: audio.audio_variant_id,
      audio_instruction_id: audio.audio_instruction_id,
      audio_asset_file: audioAssetFile,
      audio_asset_url: audio.audio_asset_url_by_language[LANGUAGE_CODE],
      induction_target_duration_s: 300,
      induction_dev_duration_s: DEV_DURATION_SECONDS,
      block_started_at_utc: blockStart,
      block_completed_at_utc: blockEnd,
      technical_failure: false,
      block_complete: true
    };

    const eventFile = path.join(dataDir, `${blockFileStem}_events.jsonl`);
    appendJsonl(eventFile, [
      { event_type: "session_ready_prompt_shown", block_file_stem: blockFileStem, recorded_at_utc: secondsAfter(new Date(blockStart), -2) },
      { event_type: "session_start_confirmed", block_file_stem: blockFileStem, recorded_at_utc: secondsAfter(new Date(blockStart), -1) },
      { event_type: "block_assigned", block_file_stem: blockFileStem, recorded_at_utc: blockStart },
      { event_type: "block_started", block_file_stem: blockFileStem, recorded_at_utc: blockStart },
      { event_type: "ecg_recording_armed", block_file_stem: blockFileStem, device_id: "PolarH10_SIMULATED", sample_count: 0, recorded_at_utc: blockStart },
      { event_type: "ecg_recording_started", block_file_stem: blockFileStem, device_id: "PolarH10_SIMULATED", sample_count: 0, recorded_at_utc: blockStart },
      { event_type: "audio_started", block_file_stem: blockFileStem, audio_asset_file: audioAssetFile, recorded_at_utc: blockStart },
      { event_type: "condition_started", block_file_stem: blockFileStem, audio_asset_file: audioAssetFile, recorded_at_utc: blockStart },
      { event_type: "audio_stopped_dev_duration", block_file_stem: blockFileStem, dev_duration_s: DEV_DURATION_SECONDS, recorded_at_utc: blockEnd },
      { event_type: "condition_ended", block_file_stem: blockFileStem, dev_duration_s: DEV_DURATION_SECONDS, recorded_at_utc: blockEnd },
      { event_type: "ecg_recording_completed", block_file_stem: blockFileStem, device_id: "PolarH10_SIMULATED", sample_count: 2, frame_count: 1, recorded_at_utc: blockEnd },
      { event_type: "block_ecg_window_closed", block_file_stem: blockFileStem, device_id: "PolarH10_SIMULATED", sample_count: 2, frame_count: 1, recorded_at_utc: blockEnd },
      { event_type: "questionnaire_started", block_file_stem: blockFileStem, recorded_at_utc: secondsAfter(new Date(blockEnd), 1) },
      ...Object.keys(PAGE_TO_EVENT).map((pageId, index) => ({
        event_type: PAGE_TO_EVENT[pageId],
        page_id: pageId,
        block_file_stem: blockFileStem,
        recorded_at_utc: secondsAfter(new Date(blockEnd), index + 2)
      })),
      { event_type: "questionnaire_completed", block_file_stem: blockFileStem, recorded_at_utc: secondsAfter(new Date(blockEnd), 7) },
      { event_type: "result_write_success", block_file_stem: blockFileStem, recorded_at_utc: secondsAfter(new Date(blockEnd), 8) },
      { event_type: "block_completed", block_file_stem: blockFileStem, recorded_at_utc: secondsAfter(new Date(blockEnd), 9) }
    ]);

    for (const eventType of ["session_ready_prompt_shown", "session_start_confirmed", "block_assigned", "block_started", "audio_started", "condition_started"]) {
      pushMarker(eventType, blockContext, blockStart, { elapsed_realtime_ns: syncStartElapsed });
    }
    pushMarker("audio_stopped_dev_duration", blockContext, blockEnd, { elapsed_realtime_ns: syncEndElapsed });
    pushMarker("condition_ended", blockContext, blockEnd, { elapsed_realtime_ns: syncEndElapsed });
    pushMarker("block_ecg_window_closed", blockContext, blockEnd, { elapsed_realtime_ns: syncEndElapsed, sample_count: 2, frame_count: 1 });
    pushMarker("questionnaire_started", blockContext, secondsAfter(new Date(blockEnd), 1));
    for (const pageId of Object.keys(PAGE_TO_EVENT)) {
      pushMarker("page_completed", blockContext, secondsAfter(new Date(blockEnd), 2), { page_id: pageId });
    }
    pushMarker("questionnaire_completed", blockContext, secondsAfter(new Date(blockEnd), 7));
    pushMarker("result_write_success", blockContext, secondsAfter(new Date(blockEnd), 8));
    pushMarker("block_completed", blockContext, secondsAfter(new Date(blockEnd), 9));

    const blockEcgRows = [
      ["sample_id", "apk_file_code", "participant_id", "apk_variant_id", "block_order", "block_id", "vr_condition_id", "device_id", "device_name", "device_address", "sample_index", "polar_sample_timestamp_ns", "host_received_timestamp_utc", "host_received_elapsed_realtime_ns", "ecg_raw", "ecg_unit", "contact_quality", "source", "recording_started_at_utc", "sync_start_elapsed_realtime_ns", "sample_offset_from_sync_start_ns"]
    ];
    for (let sample = 1; sample <= 2; sample++) {
      masterSampleIndex++;
      const hostElapsed = syncStartElapsed + (sample - 1) * 76923076;
      const hostUtc = sample === 1 ? blockStart : blockEnd;
      masterEcgRows.push([
        `${apk.apk_file_code}_${participant.participant_id}_session_ECG_PolarH10_${String(masterSampleIndex).padStart(8, "0")}`,
        apk.apk_file_code,
        participant.participant_id,
        apk.apk_variant_id,
        SESSION_ID,
        "PolarH10_SIMULATED",
        "PolarH10_SIMULATED",
        "simulated",
        masterSampleIndex,
        String(1000000000 + masterSampleIndex * 7692307),
        hostUtc,
        String(hostElapsed),
        0,
        "uV",
        "simulated",
        "polar_h10_android_ble_pmd_simulated",
        START_TIME.toISOString(),
        "5000000000",
        blockFileStem,
        blockOrder,
        blockId,
        blockFileStem,
        condition.vr_condition_id,
        condition.coherence_level,
        condition.energy_noise_level,
        audio.audio_variant_id,
        String(syncStartElapsed),
        String(Math.max(0, hostElapsed - syncStartElapsed))
      ]);
      blockEcgRows.push([
        `${blockFileStem}_ECG_PolarH10_${String(sample).padStart(6, "0")}`,
        apk.apk_file_code,
        participant.participant_id,
        apk.apk_variant_id,
        blockOrder,
        blockId,
        condition.vr_condition_id,
        "PolarH10_SIMULATED",
        "PolarH10_SIMULATED",
        "simulated",
        sample,
        String(1000000000 + masterSampleIndex * 7692307),
        hostUtc,
        String(hostElapsed),
        0,
        "uV",
        "simulated",
        "polar_h10_android_ble_pmd_simulated",
        blockStart,
        String(syncStartElapsed),
        String(Math.max(0, hostElapsed - syncStartElapsed))
      ]);
    }

    writeJson(path.join(dataDir, `${blockFileStem}_block_metadata.json`), metadata);
    writeCsv(path.join(dataDir, `${blockFileStem}_ECG_PolarH10.csv`), blockEcgRows);

    const result = {
      protocol_version: "quest.questionnaire.v1",
      schema_id: "study6-questionnaire-v8",
      participant_id: participant.participant_id,
      session_id: SESSION_ID,
      apk_variant_id: apk.apk_variant_id,
      apk_file_code: apk.apk_file_code,
      block_id: blockId,
      block_order: blockOrder,
      block_file_stem: blockFileStem,
      condition_id: condition.vr_condition_id,
      vr_condition_id: condition.vr_condition_id,
      coherence_level: condition.coherence_level,
      energy_noise_level: condition.energy_noise_level,
      answers: nestedAnswers(blockOrder),
      page_complete: {
        self_assessment_manikin: true,
        affect_vas: true,
        emotion_representation_vas: true,
        hand_embodiment: true
      },
      complete: true
    };
    writeJson(path.join(dataDir, `${blockFileStem}_questionnaire_result.json`), result);

    for (const item of itemRows) {
      const responseId = `${blockFileStem}_${item.item_id}`;
      expectedResponseIds.push(responseId);
      responseRows.push([
        responseId,
        apk.apk_file_code,
        participant.participant_id,
        apk.apk_variant_id,
        blockOrder,
        blockId,
        condition.vr_condition_id,
        item.item_id,
        responseValue(item.item_id, blockOrder),
        item.scale,
        secondsAfter(new Date(blockEnd), 8)
      ]);
    }

    blockMetadataRows.push([
      blockFileStem,
      participant.participant_id,
      apk.apk_variant_id,
      blockOrder,
      blockId,
      condition.vr_condition_id,
      audio.audio_variant_id,
      false,
      true
    ]);

    blockSummaries.push({ blockOrder, blockId, blockFileStem, vrConditionId: condition.vr_condition_id, audioVariantId: audio.audio_variant_id });
  }

  pushMarker("polar_ecg_stream_stopped", null, secondsAfter(START_TIME, 4 * DEV_DURATION_SECONDS + 20));
  pushMarker("session_physiology_completed", null, secondsAfter(START_TIME, 4 * DEV_DURATION_SECONDS + 21));

  writeCsv(path.join(dataDir, "questionnaire_responses_long.csv"), responseRows);
  writeCsv(path.join(dataDir, "block_metadata_long.csv"), blockMetadataRows);
  writeCsv(path.join(dataDir, `${apk.apk_file_code}_${participant.participant_id}_session_ECG_PolarH10_master.csv`), masterEcgRows);
  appendJsonl(path.join(dataDir, `${apk.apk_file_code}_${participant.participant_id}_session_markers.jsonl`), markerRows);
  appendJsonl(path.join(dataDir, "runtime_events.jsonl"), [
    { event_type: "harness_started", participant_id: participant.participant_id, apk_variant_id: apk.apk_variant_id, recorded_at_utc: START_TIME.toISOString() },
    { event_type: "participant_allocated", participant_id: participant.participant_id, apk_variant_id: apk.apk_variant_id, recorded_at_utc: secondsAfter(START_TIME, 1) },
    { event_type: "quest_auto_run_finished", participant_id: participant.participant_id, apk_variant_id: apk.apk_variant_id, recorded_at_utc: secondsAfter(START_TIME, 4 * DEV_DURATION_SECONDS + 20) },
    { event_type: "participant_completed", participant_id: participant.participant_id, apk_variant_id: apk.apk_variant_id, recorded_at_utc: secondsAfter(START_TIME, 4 * DEV_DURATION_SECONDS + 21) }
  ]);

  const observedCsv = fs.readFileSync(path.join(dataDir, "questionnaire_responses_long.csv"), "utf8").trim().split(/\r?\n/).slice(1);
  const observedRowsById = new Map(observedCsv.map((line) => {
    const cells = line.split(",");
    return [cells[0], {
      responseId: cells[0],
      blockOrder: Number(cells[4]),
      blockId: cells[5],
      vrConditionId: cells[6],
      itemId: cells[7],
      itemValue: Number(cells[8]),
      itemScale: cells[9]
    }];
  }));
  const observedResponseIds = new Set(observedRowsById.keys());
  const missingResponseIds = expectedResponseIds.filter((id) => !observedResponseIds.has(id));
  const eventFailures = [];
  const valueFailures = [];

  for (const block of blockSummaries) {
    const eventFile = path.join(dataDir, `${block.blockFileStem}_events.jsonl`);
    const eventTypes = fs.readFileSync(eventFile, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line).event_type);
    const required = ["session_ready_prompt_shown", "session_start_confirmed", "block_assigned", "block_started", "ecg_recording_armed", "ecg_recording_started", "audio_started", "condition_started", "audio_stopped_dev_duration", "condition_ended", "ecg_recording_completed", "block_ecg_window_closed", "questionnaire_started", "questionnaire_completed", "result_write_success", "block_completed"];
    for (const eventType of required) {
      if (!eventTypes.includes(eventType)) {
        eventFailures.push(`${block.blockFileStem} missing ${eventType}`);
      }
    }
    if (eventTypes.filter((type) => type === "page_completed").length !== 4) {
      eventFailures.push(`${block.blockFileStem} missing four page_completed events`);
    }

    const result = readJson(path.join(dataDir, `${block.blockFileStem}_questionnaire_result.json`));
    if (!result.complete || result.vr_condition_id !== block.vrConditionId || result.block_id !== block.blockId) {
      valueFailures.push(`${block.blockFileStem} result metadata mismatch`);
    }
    for (const item of itemRows) {
      const responseId = `${block.blockFileStem}_${item.item_id}`;
      const observedRow = observedRowsById.get(responseId);
      const expectedValue = responseValue(item.item_id, block.blockOrder);
      if (!observedRow || observedRow.itemValue !== expectedValue) {
        valueFailures.push(`${responseId} expected ${expectedValue} observed ${observedRow ? observedRow.itemValue : "missing"}`);
      }
    }
  }

  const markerFile = path.join(dataDir, `${apk.apk_file_code}_${participant.participant_id}_session_markers.jsonl`);
  const markerTypes = fs.readFileSync(markerFile, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line).event_type);
  for (const eventType of ["session_physiology_started", "polar_connected", "polar_ecg_stream_started", "polar_ecg_stream_stopped", "session_physiology_completed"]) {
    if (!markerTypes.includes(eventType)) {
      eventFailures.push(`session marker log missing ${eventType}`);
    }
  }

  const demographics = readJson(path.join(demographicsDir, `${participant.participant_id}_demographics.json`));
  const itemLibraryPageIds = new Set(itemLibrary.pages.map((page) => page.id));
  const expectedPages = ["demographics", "session_ready", "vr_task_instructions", "self_assessment_manikin", "affect_vas", "emotion_representation_vas", "hand_embodiment"];
  const missingPages = expectedPages.filter((page) => !itemLibraryPageIds.has(page));
  const failures = [
    ...missingResponseIds.map((id) => `missing response ${id}`),
    ...eventFailures,
    ...valueFailures,
    ...(demographics.complete ? [] : ["demographics did not complete"]),
    ...missingPages.map((page) => `item library missing page ${page}`)
  ];

  const report = {
    pass: failures.length === 0,
    failures,
    apk_variant_id: APK_VARIANT_ID,
    participant_id: participant.participant_id,
    permutation_id: participant.permutation_id,
    development_duration_s: DEV_DURATION_SECONDS,
    expected_response_count: expectedResponseIds.length,
    observed_response_count: observedResponseIds.size,
    blocks: blockSummaries,
    output_root: root
  };
  writeJson(path.join(OUT_DIR, "expected-vs-observed.json"), report);

  if (!report.pass) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log(`Study 6 verification passed: ${expectedResponseIds.length} responses across ${blockSummaries.length} blocks.`);
  console.log(path.join(OUT_DIR, "expected-vs-observed.json"));
}

main();

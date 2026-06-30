"use strict";

const fs = require("fs");
const path = require("path");

const conditions = [
  {
    vr_condition_id: "HC_HE",
    label: "High coherence / high energy",
    coherence_level: "high",
    energy_noise_level: "high"
  },
  {
    vr_condition_id: "LC_HE",
    label: "Low coherence / high energy",
    coherence_level: "low",
    energy_noise_level: "high"
  },
  {
    vr_condition_id: "HC_LE",
    label: "High coherence / low energy",
    coherence_level: "high",
    energy_noise_level: "low"
  },
  {
    vr_condition_id: "LC_LE",
    label: "Low coherence / low energy",
    coherence_level: "low",
    energy_noise_level: "low"
  }
];

const audioVariants = [
  {
    audio_variant_id: "V01",
    audio_instruction_id: "audio_instruction_set_1",
    en: "study6_neutral_hand_audio_V01_EN.mp3",
    de: "study6_neutral_hand_audio_V01_DE.mp3"
  },
  {
    audio_variant_id: "V02",
    audio_instruction_id: "audio_instruction_set_2",
    en: "study6_neutral_hand_audio_V02_EN.mp3",
    de: "study6_neutral_hand_audio_V02_DE.mp3"
  },
  {
    audio_variant_id: "V03",
    audio_instruction_id: "audio_instruction_set_3",
    en: "study6_neutral_hand_audio_V03_EN.mp3",
    de: "study6_neutral_hand_audio_V03_DE.mp3"
  },
  {
    audio_variant_id: "V04",
    audio_instruction_id: "audio_instruction_set_4",
    en: "study6_neutral_hand_audio_V04_EN.mp3",
    de: "study6_neutral_hand_audio_V04_DE.mp3"
  }
];

const audioAssetLocations = {
  main_audio_asset_page_url: "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/",
  direct_mp3_base_url: "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/"
};

const apkVariants = [
  {
    apk_variant_id: "BG_ENV",
    apk_file_code: "BG_ENV",
    data_folder: "Study_particle_env_data",
    mapping_target: "background_environment"
  },
  {
    apk_variant_id: "HAND_AV",
    apk_file_code: "HAND_AV",
    data_folder: "Study_particle_hands_data",
    mapping_target: "hand_avatar"
  }
];

const audioVariantCatalog = audioVariants.map((audio) => ({
  audio_variant_id: audio.audio_variant_id,
  audio_instruction_id: audio.audio_instruction_id,
  audio_asset_file_by_language: {
    en: audio.en,
    de: audio.de
  },
  audio_asset_url_by_language: {
    en: `${audioAssetLocations.direct_mp3_base_url}${audio.en}`,
    de: `${audioAssetLocations.direct_mp3_base_url}${audio.de}`
  }
}));

const questionnaireItems = [
  { item_id: "SAM1", label: "Self-Assessment Manikin pictograph valence", scale: "1-9" },
  { item_id: "SAM2", label: "Self-Assessment Manikin pictograph arousal", scale: "1-9" },
  { item_id: "SAM3", label: "Self-Assessment Manikin pictograph dominance/control", scale: "1-9" },
  { item_id: "valence", label: "Valence VAS", scale: "0-100" },
  { item_id: "arousal", label: "Arousal VAS", scale: "0-100" },
  { item_id: "Anger", label: "Anger represented by particle movement", scale: "0-100" },
  { item_id: "Fear", label: "Fear represented by particle movement", scale: "0-100" },
  { item_id: "Sadness", label: "Sadness represented by particle movement", scale: "0-100" },
  { item_id: "Disgust", label: "Disgust represented by particle movement", scale: "0-100" },
  { item_id: "Happiness", label: "Happiness represented by particle movement", scale: "0-100" },
  { item_id: "Surprise", label: "Surprise represented by particle movement", scale: "0-100" },
  { item_id: "Ownership", label: "Virtual hand ownership", scale: "1-7" },
  { item_id: "Agency", label: "Virtual hand agency", scale: "1-7" }
];

const pad = (value, width) => String(value).padStart(width, "0");
const generatedFiles = [];

function permutations(items) {
  if (items.length <= 1) {
    return [items];
  }

  const output = [];
  items.forEach((head, index) => {
    const rest = items.slice(0, index).concat(items.slice(index + 1));
    permutations(rest).forEach((tail) => output.push([head, ...tail]));
  });
  return output;
}

function csvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(fileName, rows) {
  if (rows.length === 0) {
    throw new Error(`Cannot write empty CSV: ${fileName}`);
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvValue).join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(","))
  ];
  const outputPath = path.join(__dirname, fileName);
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  generatedFiles.push(outputPath);
}

function flattenApkVariant(variant) {
  return variant;
}

function flattenConditionCatalog(condition) {
  return condition;
}

function flattenAudioVariantCatalog(audio) {
  return {
    audio_variant_id: audio.audio_variant_id,
    audio_instruction_id: audio.audio_instruction_id,
    audio_asset_file_en: audio.audio_asset_file_by_language.en,
    audio_asset_url_en: audio.audio_asset_url_by_language.en,
    audio_asset_file_de: audio.audio_asset_file_by_language.de,
    audio_asset_url_de: audio.audio_asset_url_by_language.de
  };
}

function flattenConditionPermutation(permutation) {
  const row = {
    permutation_id: permutation.permutation_id,
    condition_order: permutation.block_order.map((block) => block.vr_condition_id).join(" ")
  };
  permutation.block_order.forEach((block) => {
    const prefix = `block_${block.block_order}`;
    row[`${prefix}_vr_condition_id`] = block.vr_condition_id;
  });
  return row;
}

function flattenAudioPermutation(permutation) {
  const row = {
    permutation_id: permutation.permutation_id,
    audio_order: permutation.audio_order.map((block) => block.audio_variant_id).join(" ")
  };
  permutation.audio_order.forEach((block) => {
    const prefix = `block_${block.block_order}`;
    row[`${prefix}_audio_variant_id`] = block.audio_variant_id;
  });
  return row;
}

function flattenParticipantAllocation(row) {
  const output = {
    participant_id: row.participant_id,
    allocation_row: row.allocation_row,
    cycle: row.cycle,
    permutation_id: row.permutation_id
  };
  return output;
}

const conditionPermutations = permutations(conditions).map((order, index) => ({
  permutation_id: `perm_${pad(index + 1, 2)}`,
  block_order: order.map((condition, blockIndex) => ({
    block_order: blockIndex + 1,
    vr_condition_id: condition.vr_condition_id
  }))
}));

const audioPermutations = permutations(audioVariantCatalog).map((order, index) => ({
  permutation_id: `perm_${pad(index + 1, 2)}`,
  audio_order: order.map((audio, blockIndex) => ({
    block_order: blockIndex + 1,
    audio_variant_id: audio.audio_variant_id
  }))
}));

const participantAllocation = Array.from({ length: 100 }, (_, index) => {
  const participantNumber = index + 1;
  const participantId = `P${pad(participantNumber, 3)}`;
  const permutationIndex = index % conditionPermutations.length;
  return {
    participant_id: participantId,
    allocation_row: participantNumber,
    cycle: Math.floor(index / conditionPermutations.length) + 1,
    permutation_id: conditionPermutations[permutationIndex].permutation_id
  };
});

const lookup = {
  schema_id: "study6_apk_condition_audio_lookup_v1",
  generated_at_note: "Static planning lookup generated for Study 6 backend implementation. Copy this file into each private APK data folder as condition_audio_lookup.json.",
  participant_id_format: "P###, zero-padded to three digits for the 100-row lookup",
  apk_variants: apkVariants,
  allocation_rule: "Select the next participant_id from participant_allocation. Use its permutation_id for both condition and audio order. After all 24 permutations have complete data, continue into the next cycle.",
  data_layout_rule: "Use one flat data folder per APK data root. Do not create per-block folders. Append all questionnaire item rows to data/questionnaire_responses_long.csv. Save condition-level stream files, such as ECG, as separate files named with apk_file_code, participant_id, block_id, and vr_condition_id.",
  derivation_rules: {
    participant_join: "Use participant_allocation.permutation_id to select the matching condition_permutations row and audio_permutations row.",
    apk_catalog_join: "Use apk_variant_id to join apk_variants for apk_file_code, data_folder, and mapping_target.",
    condition_catalog_join: "Use vr_condition_id to join condition_permutations to conditions for coherence_level and energy_noise_level.",
    audio_catalog_join: "Use audio_variant_id to join audio_permutations to audio_variants for instruction IDs, filenames, and URLs.",
    block_id: "B<block_order zero-padded to two digits>",
    block_file_stem: "<apk_file_code>_<participant_id>_<block_id>_<vr_condition_id>",
    block_metadata_file: "data/<block_file_stem>_block_metadata.json",
    event_log_file: "data/<block_file_stem>_events.jsonl",
    ecg_file: "data/<block_file_stem>_ECG_PolarH10.csv",
    questionnaire_response_id: "<block_file_stem>_<item_id>",
    questionnaire_append_file: "data/questionnaire_responses_long.csv"
  },
  audio_asset_locations: audioAssetLocations,
  conditions,
  audio_variants: audioVariantCatalog,
  questionnaire_items: questionnaireItems,
  condition_permutations: conditionPermutations,
  audio_permutations: audioPermutations,
  participant_allocation: participantAllocation
};

const outputPath = path.join(__dirname, "study6_apk_permutation_lookup.json");
fs.writeFileSync(outputPath, `${JSON.stringify(lookup, null, 2)}\n`, "utf8");
generatedFiles.push(outputPath);

writeCsv(
  "study6_apk_variant_catalog.csv",
  apkVariants.map(flattenApkVariant)
);
writeCsv(
  "study6_condition_catalog.csv",
  conditions.map(flattenConditionCatalog)
);
writeCsv(
  "study6_audio_variant_catalog.csv",
  audioVariantCatalog.map(flattenAudioVariantCatalog)
);
writeCsv(
  "study6_condition_permutation_table.csv",
  conditionPermutations.map(flattenConditionPermutation)
);
writeCsv(
  "study6_audio_permutation_table.csv",
  audioPermutations.map(flattenAudioPermutation)
);
writeCsv(
  "study6_participant_lookup_table.csv",
  participantAllocation.map(flattenParticipantAllocation)
);

generatedFiles.forEach((filePath) => console.log(`Wrote ${filePath}`));

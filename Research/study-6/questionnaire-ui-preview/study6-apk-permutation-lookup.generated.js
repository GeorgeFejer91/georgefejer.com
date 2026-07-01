"use strict";

// Generated from ../for-ai/study6_apk_permutation_lookup.json by
// ../for-ai/generate_study6_apk_permutation_lookup.js.
// Do not edit manually; update the canonical lookup generator instead.
(function () {
  window.STUDY6_APK_PERMUTATION_LOOKUP = Object.freeze({
  "schema_id": "study6_apk_condition_audio_lookup_v1",
  "generated_at_note": "Static planning lookup generated for Study 6 backend implementation. Copy this file into each private APK data folder as condition_audio_lookup.json.",
  "participant_id_format": "P###, zero-padded to three digits for the 100-row lookup",
  "apk_variants": [
    {
      "apk_variant_id": "BG_ENV",
      "apk_file_code": "BG_ENV",
      "data_folder": "Study_particle_env_data",
      "mapping_target": "background_environment"
    },
    {
      "apk_variant_id": "HAND_AV",
      "apk_file_code": "HAND_AV",
      "data_folder": "Study_particle_hands_data",
      "mapping_target": "hand_avatar"
    }
  ],
  "allocation_rule": "Select the next participant_id from participant_allocation. Use its permutation_id for both condition and audio order. After all 24 permutations have complete data, continue into the next cycle.",
  "data_layout_rule": "Use one flat data folder per APK data root. Do not create per-block folders. Append all questionnaire item rows to data/questionnaire_responses_long.csv. Save condition-level stream files, such as ECG, as separate files named with apk_file_code, participant_id, block_id, and vr_condition_id.",
  "derivation_rules": {
    "participant_join": "Use participant_allocation.permutation_id to select the matching condition_permutations row and audio_permutations row.",
    "apk_catalog_join": "Use apk_variant_id to join apk_variants for apk_file_code, data_folder, and mapping_target.",
    "condition_catalog_join": "Use vr_condition_id to join condition_permutations to conditions for coherence_level and energy_noise_level.",
    "audio_catalog_join": "Use audio_variant_id to join audio_permutations to audio_variants for instruction IDs, filenames, and URLs.",
    "block_id": "B<block_order zero-padded to two digits>",
    "block_file_stem": "<apk_file_code>_<participant_id>_<block_id>_<vr_condition_id>",
    "block_metadata_file": "data/<block_file_stem>_block_metadata.json",
    "event_log_file": "data/<block_file_stem>_events.jsonl",
    "ecg_file": "data/<block_file_stem>_ECG_PolarH10.csv",
    "questionnaire_response_id": "<block_file_stem>_<item_id>",
    "questionnaire_append_file": "data/questionnaire_responses_long.csv"
  },
  "audio_asset_locations": {
    "main_audio_asset_page_url": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/",
    "direct_mp3_base_url": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/"
  },
  "conditions": [
    {
      "vr_condition_id": "HC_HE",
      "label": "High coherence / high energy",
      "coherence_level": "high",
      "energy_noise_level": "high"
    },
    {
      "vr_condition_id": "LC_HE",
      "label": "Low coherence / high energy",
      "coherence_level": "low",
      "energy_noise_level": "high"
    },
    {
      "vr_condition_id": "HC_LE",
      "label": "High coherence / low energy",
      "coherence_level": "high",
      "energy_noise_level": "low"
    },
    {
      "vr_condition_id": "LC_LE",
      "label": "Low coherence / low energy",
      "coherence_level": "low",
      "energy_noise_level": "low"
    }
  ],
  "audio_variants": [
    {
      "audio_variant_id": "V01",
      "audio_instruction_id": "audio_instruction_set_1",
      "audio_asset_file_by_language": {
        "en": "study6_neutral_hand_audio_V01_EN.mp3",
        "de": "study6_neutral_hand_audio_V01_DE.mp3"
      },
      "audio_asset_url_by_language": {
        "en": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/study6_neutral_hand_audio_V01_EN.mp3",
        "de": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/study6_neutral_hand_audio_V01_DE.mp3"
      }
    },
    {
      "audio_variant_id": "V02",
      "audio_instruction_id": "audio_instruction_set_2",
      "audio_asset_file_by_language": {
        "en": "study6_neutral_hand_audio_V02_EN.mp3",
        "de": "study6_neutral_hand_audio_V02_DE.mp3"
      },
      "audio_asset_url_by_language": {
        "en": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/study6_neutral_hand_audio_V02_EN.mp3",
        "de": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/study6_neutral_hand_audio_V02_DE.mp3"
      }
    },
    {
      "audio_variant_id": "V03",
      "audio_instruction_id": "audio_instruction_set_3",
      "audio_asset_file_by_language": {
        "en": "study6_neutral_hand_audio_V03_EN.mp3",
        "de": "study6_neutral_hand_audio_V03_DE.mp3"
      },
      "audio_asset_url_by_language": {
        "en": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/study6_neutral_hand_audio_V03_EN.mp3",
        "de": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/study6_neutral_hand_audio_V03_DE.mp3"
      }
    },
    {
      "audio_variant_id": "V04",
      "audio_instruction_id": "audio_instruction_set_4",
      "audio_asset_file_by_language": {
        "en": "study6_neutral_hand_audio_V04_EN.mp3",
        "de": "study6_neutral_hand_audio_V04_DE.mp3"
      },
      "audio_asset_url_by_language": {
        "en": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/study6_neutral_hand_audio_V04_EN.mp3",
        "de": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/study6_neutral_hand_audio_V04_DE.mp3"
      }
    }
  ],
  "questionnaire_items": [
    {
      "item_id": "SAM1",
      "label": "Retrospective Self-Assessment Manikin pictograph valence",
      "scale": "1-9"
    },
    {
      "item_id": "SAM2",
      "label": "Retrospective Self-Assessment Manikin pictograph arousal",
      "scale": "1-9"
    },
    {
      "item_id": "SAM3",
      "label": "Retrospective Self-Assessment Manikin pictograph dominance/control",
      "scale": "1-9"
    },
    {
      "item_id": "valence",
      "label": "Retrospective valence VAS",
      "scale": "0-100"
    },
    {
      "item_id": "arousal",
      "label": "Retrospective arousal VAS",
      "scale": "0-100"
    },
    {
      "item_id": "Anger",
      "label": "Anger",
      "scale": "0-100"
    },
    {
      "item_id": "Disgust",
      "label": "Disgust",
      "scale": "0-100"
    },
    {
      "item_id": "Fear",
      "label": "Fear",
      "scale": "0-100"
    },
    {
      "item_id": "Happiness",
      "label": "Happiness",
      "scale": "0-100"
    },
    {
      "item_id": "Sadness",
      "label": "Sadness",
      "scale": "0-100"
    },
    {
      "item_id": "Surprise",
      "label": "Surprise",
      "scale": "0-100"
    },
    {
      "item_id": "Ownership",
      "label": "Adapted VEQ hand ownership",
      "scale": "1-7"
    },
    {
      "item_id": "Agency",
      "label": "Adapted VEQ hand agency",
      "scale": "1-7"
    }
  ],
  "condition_permutations": [
    {
      "permutation_id": "perm_01",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_02",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_03",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_04",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_HE"
        }
      ]
    },
    {
      "permutation_id": "perm_05",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_06",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_HE"
        }
      ]
    },
    {
      "permutation_id": "perm_07",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_08",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_09",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_10",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_HE"
        }
      ]
    },
    {
      "permutation_id": "perm_11",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_12",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_HE"
        }
      ]
    },
    {
      "permutation_id": "perm_13",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_14",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_HE"
        }
      ]
    },
    {
      "permutation_id": "perm_15",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_16",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_HE"
        }
      ]
    },
    {
      "permutation_id": "perm_17",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_HE"
        }
      ]
    },
    {
      "permutation_id": "perm_18",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_HE"
        }
      ]
    },
    {
      "permutation_id": "perm_19",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_20",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_HE"
        }
      ]
    },
    {
      "permutation_id": "perm_21",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_LE"
        }
      ]
    },
    {
      "permutation_id": "perm_22",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_HE"
        }
      ]
    },
    {
      "permutation_id": "perm_23",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "HC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "LC_HE"
        }
      ]
    },
    {
      "permutation_id": "perm_24",
      "block_order": [
        {
          "block_order": 1,
          "vr_condition_id": "LC_LE"
        },
        {
          "block_order": 2,
          "vr_condition_id": "HC_LE"
        },
        {
          "block_order": 3,
          "vr_condition_id": "LC_HE"
        },
        {
          "block_order": 4,
          "vr_condition_id": "HC_HE"
        }
      ]
    }
  ],
  "audio_permutations": [
    {
      "permutation_id": "perm_01",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V04"
        }
      ]
    },
    {
      "permutation_id": "perm_02",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V03"
        }
      ]
    },
    {
      "permutation_id": "perm_03",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V04"
        }
      ]
    },
    {
      "permutation_id": "perm_04",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V02"
        }
      ]
    },
    {
      "permutation_id": "perm_05",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V03"
        }
      ]
    },
    {
      "permutation_id": "perm_06",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V02"
        }
      ]
    },
    {
      "permutation_id": "perm_07",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V04"
        }
      ]
    },
    {
      "permutation_id": "perm_08",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V03"
        }
      ]
    },
    {
      "permutation_id": "perm_09",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V04"
        }
      ]
    },
    {
      "permutation_id": "perm_10",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V01"
        }
      ]
    },
    {
      "permutation_id": "perm_11",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V03"
        }
      ]
    },
    {
      "permutation_id": "perm_12",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V01"
        }
      ]
    },
    {
      "permutation_id": "perm_13",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V04"
        }
      ]
    },
    {
      "permutation_id": "perm_14",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V02"
        }
      ]
    },
    {
      "permutation_id": "perm_15",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V04"
        }
      ]
    },
    {
      "permutation_id": "perm_16",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V01"
        }
      ]
    },
    {
      "permutation_id": "perm_17",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V02"
        }
      ]
    },
    {
      "permutation_id": "perm_18",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V01"
        }
      ]
    },
    {
      "permutation_id": "perm_19",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V03"
        }
      ]
    },
    {
      "permutation_id": "perm_20",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V02"
        }
      ]
    },
    {
      "permutation_id": "perm_21",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V03"
        }
      ]
    },
    {
      "permutation_id": "perm_22",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V01"
        }
      ]
    },
    {
      "permutation_id": "perm_23",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V01"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V02"
        }
      ]
    },
    {
      "permutation_id": "perm_24",
      "audio_order": [
        {
          "block_order": 1,
          "audio_variant_id": "V04"
        },
        {
          "block_order": 2,
          "audio_variant_id": "V03"
        },
        {
          "block_order": 3,
          "audio_variant_id": "V02"
        },
        {
          "block_order": 4,
          "audio_variant_id": "V01"
        }
      ]
    }
  ],
  "participant_allocation": [
    {
      "participant_id": "P001",
      "allocation_row": 1,
      "cycle": 1,
      "permutation_id": "perm_01"
    },
    {
      "participant_id": "P002",
      "allocation_row": 2,
      "cycle": 1,
      "permutation_id": "perm_02"
    },
    {
      "participant_id": "P003",
      "allocation_row": 3,
      "cycle": 1,
      "permutation_id": "perm_03"
    },
    {
      "participant_id": "P004",
      "allocation_row": 4,
      "cycle": 1,
      "permutation_id": "perm_04"
    },
    {
      "participant_id": "P005",
      "allocation_row": 5,
      "cycle": 1,
      "permutation_id": "perm_05"
    },
    {
      "participant_id": "P006",
      "allocation_row": 6,
      "cycle": 1,
      "permutation_id": "perm_06"
    },
    {
      "participant_id": "P007",
      "allocation_row": 7,
      "cycle": 1,
      "permutation_id": "perm_07"
    },
    {
      "participant_id": "P008",
      "allocation_row": 8,
      "cycle": 1,
      "permutation_id": "perm_08"
    },
    {
      "participant_id": "P009",
      "allocation_row": 9,
      "cycle": 1,
      "permutation_id": "perm_09"
    },
    {
      "participant_id": "P010",
      "allocation_row": 10,
      "cycle": 1,
      "permutation_id": "perm_10"
    },
    {
      "participant_id": "P011",
      "allocation_row": 11,
      "cycle": 1,
      "permutation_id": "perm_11"
    },
    {
      "participant_id": "P012",
      "allocation_row": 12,
      "cycle": 1,
      "permutation_id": "perm_12"
    },
    {
      "participant_id": "P013",
      "allocation_row": 13,
      "cycle": 1,
      "permutation_id": "perm_13"
    },
    {
      "participant_id": "P014",
      "allocation_row": 14,
      "cycle": 1,
      "permutation_id": "perm_14"
    },
    {
      "participant_id": "P015",
      "allocation_row": 15,
      "cycle": 1,
      "permutation_id": "perm_15"
    },
    {
      "participant_id": "P016",
      "allocation_row": 16,
      "cycle": 1,
      "permutation_id": "perm_16"
    },
    {
      "participant_id": "P017",
      "allocation_row": 17,
      "cycle": 1,
      "permutation_id": "perm_17"
    },
    {
      "participant_id": "P018",
      "allocation_row": 18,
      "cycle": 1,
      "permutation_id": "perm_18"
    },
    {
      "participant_id": "P019",
      "allocation_row": 19,
      "cycle": 1,
      "permutation_id": "perm_19"
    },
    {
      "participant_id": "P020",
      "allocation_row": 20,
      "cycle": 1,
      "permutation_id": "perm_20"
    },
    {
      "participant_id": "P021",
      "allocation_row": 21,
      "cycle": 1,
      "permutation_id": "perm_21"
    },
    {
      "participant_id": "P022",
      "allocation_row": 22,
      "cycle": 1,
      "permutation_id": "perm_22"
    },
    {
      "participant_id": "P023",
      "allocation_row": 23,
      "cycle": 1,
      "permutation_id": "perm_23"
    },
    {
      "participant_id": "P024",
      "allocation_row": 24,
      "cycle": 1,
      "permutation_id": "perm_24"
    },
    {
      "participant_id": "P025",
      "allocation_row": 25,
      "cycle": 2,
      "permutation_id": "perm_01"
    },
    {
      "participant_id": "P026",
      "allocation_row": 26,
      "cycle": 2,
      "permutation_id": "perm_02"
    },
    {
      "participant_id": "P027",
      "allocation_row": 27,
      "cycle": 2,
      "permutation_id": "perm_03"
    },
    {
      "participant_id": "P028",
      "allocation_row": 28,
      "cycle": 2,
      "permutation_id": "perm_04"
    },
    {
      "participant_id": "P029",
      "allocation_row": 29,
      "cycle": 2,
      "permutation_id": "perm_05"
    },
    {
      "participant_id": "P030",
      "allocation_row": 30,
      "cycle": 2,
      "permutation_id": "perm_06"
    },
    {
      "participant_id": "P031",
      "allocation_row": 31,
      "cycle": 2,
      "permutation_id": "perm_07"
    },
    {
      "participant_id": "P032",
      "allocation_row": 32,
      "cycle": 2,
      "permutation_id": "perm_08"
    },
    {
      "participant_id": "P033",
      "allocation_row": 33,
      "cycle": 2,
      "permutation_id": "perm_09"
    },
    {
      "participant_id": "P034",
      "allocation_row": 34,
      "cycle": 2,
      "permutation_id": "perm_10"
    },
    {
      "participant_id": "P035",
      "allocation_row": 35,
      "cycle": 2,
      "permutation_id": "perm_11"
    },
    {
      "participant_id": "P036",
      "allocation_row": 36,
      "cycle": 2,
      "permutation_id": "perm_12"
    },
    {
      "participant_id": "P037",
      "allocation_row": 37,
      "cycle": 2,
      "permutation_id": "perm_13"
    },
    {
      "participant_id": "P038",
      "allocation_row": 38,
      "cycle": 2,
      "permutation_id": "perm_14"
    },
    {
      "participant_id": "P039",
      "allocation_row": 39,
      "cycle": 2,
      "permutation_id": "perm_15"
    },
    {
      "participant_id": "P040",
      "allocation_row": 40,
      "cycle": 2,
      "permutation_id": "perm_16"
    },
    {
      "participant_id": "P041",
      "allocation_row": 41,
      "cycle": 2,
      "permutation_id": "perm_17"
    },
    {
      "participant_id": "P042",
      "allocation_row": 42,
      "cycle": 2,
      "permutation_id": "perm_18"
    },
    {
      "participant_id": "P043",
      "allocation_row": 43,
      "cycle": 2,
      "permutation_id": "perm_19"
    },
    {
      "participant_id": "P044",
      "allocation_row": 44,
      "cycle": 2,
      "permutation_id": "perm_20"
    },
    {
      "participant_id": "P045",
      "allocation_row": 45,
      "cycle": 2,
      "permutation_id": "perm_21"
    },
    {
      "participant_id": "P046",
      "allocation_row": 46,
      "cycle": 2,
      "permutation_id": "perm_22"
    },
    {
      "participant_id": "P047",
      "allocation_row": 47,
      "cycle": 2,
      "permutation_id": "perm_23"
    },
    {
      "participant_id": "P048",
      "allocation_row": 48,
      "cycle": 2,
      "permutation_id": "perm_24"
    },
    {
      "participant_id": "P049",
      "allocation_row": 49,
      "cycle": 3,
      "permutation_id": "perm_01"
    },
    {
      "participant_id": "P050",
      "allocation_row": 50,
      "cycle": 3,
      "permutation_id": "perm_02"
    },
    {
      "participant_id": "P051",
      "allocation_row": 51,
      "cycle": 3,
      "permutation_id": "perm_03"
    },
    {
      "participant_id": "P052",
      "allocation_row": 52,
      "cycle": 3,
      "permutation_id": "perm_04"
    },
    {
      "participant_id": "P053",
      "allocation_row": 53,
      "cycle": 3,
      "permutation_id": "perm_05"
    },
    {
      "participant_id": "P054",
      "allocation_row": 54,
      "cycle": 3,
      "permutation_id": "perm_06"
    },
    {
      "participant_id": "P055",
      "allocation_row": 55,
      "cycle": 3,
      "permutation_id": "perm_07"
    },
    {
      "participant_id": "P056",
      "allocation_row": 56,
      "cycle": 3,
      "permutation_id": "perm_08"
    },
    {
      "participant_id": "P057",
      "allocation_row": 57,
      "cycle": 3,
      "permutation_id": "perm_09"
    },
    {
      "participant_id": "P058",
      "allocation_row": 58,
      "cycle": 3,
      "permutation_id": "perm_10"
    },
    {
      "participant_id": "P059",
      "allocation_row": 59,
      "cycle": 3,
      "permutation_id": "perm_11"
    },
    {
      "participant_id": "P060",
      "allocation_row": 60,
      "cycle": 3,
      "permutation_id": "perm_12"
    },
    {
      "participant_id": "P061",
      "allocation_row": 61,
      "cycle": 3,
      "permutation_id": "perm_13"
    },
    {
      "participant_id": "P062",
      "allocation_row": 62,
      "cycle": 3,
      "permutation_id": "perm_14"
    },
    {
      "participant_id": "P063",
      "allocation_row": 63,
      "cycle": 3,
      "permutation_id": "perm_15"
    },
    {
      "participant_id": "P064",
      "allocation_row": 64,
      "cycle": 3,
      "permutation_id": "perm_16"
    },
    {
      "participant_id": "P065",
      "allocation_row": 65,
      "cycle": 3,
      "permutation_id": "perm_17"
    },
    {
      "participant_id": "P066",
      "allocation_row": 66,
      "cycle": 3,
      "permutation_id": "perm_18"
    },
    {
      "participant_id": "P067",
      "allocation_row": 67,
      "cycle": 3,
      "permutation_id": "perm_19"
    },
    {
      "participant_id": "P068",
      "allocation_row": 68,
      "cycle": 3,
      "permutation_id": "perm_20"
    },
    {
      "participant_id": "P069",
      "allocation_row": 69,
      "cycle": 3,
      "permutation_id": "perm_21"
    },
    {
      "participant_id": "P070",
      "allocation_row": 70,
      "cycle": 3,
      "permutation_id": "perm_22"
    },
    {
      "participant_id": "P071",
      "allocation_row": 71,
      "cycle": 3,
      "permutation_id": "perm_23"
    },
    {
      "participant_id": "P072",
      "allocation_row": 72,
      "cycle": 3,
      "permutation_id": "perm_24"
    },
    {
      "participant_id": "P073",
      "allocation_row": 73,
      "cycle": 4,
      "permutation_id": "perm_01"
    },
    {
      "participant_id": "P074",
      "allocation_row": 74,
      "cycle": 4,
      "permutation_id": "perm_02"
    },
    {
      "participant_id": "P075",
      "allocation_row": 75,
      "cycle": 4,
      "permutation_id": "perm_03"
    },
    {
      "participant_id": "P076",
      "allocation_row": 76,
      "cycle": 4,
      "permutation_id": "perm_04"
    },
    {
      "participant_id": "P077",
      "allocation_row": 77,
      "cycle": 4,
      "permutation_id": "perm_05"
    },
    {
      "participant_id": "P078",
      "allocation_row": 78,
      "cycle": 4,
      "permutation_id": "perm_06"
    },
    {
      "participant_id": "P079",
      "allocation_row": 79,
      "cycle": 4,
      "permutation_id": "perm_07"
    },
    {
      "participant_id": "P080",
      "allocation_row": 80,
      "cycle": 4,
      "permutation_id": "perm_08"
    },
    {
      "participant_id": "P081",
      "allocation_row": 81,
      "cycle": 4,
      "permutation_id": "perm_09"
    },
    {
      "participant_id": "P082",
      "allocation_row": 82,
      "cycle": 4,
      "permutation_id": "perm_10"
    },
    {
      "participant_id": "P083",
      "allocation_row": 83,
      "cycle": 4,
      "permutation_id": "perm_11"
    },
    {
      "participant_id": "P084",
      "allocation_row": 84,
      "cycle": 4,
      "permutation_id": "perm_12"
    },
    {
      "participant_id": "P085",
      "allocation_row": 85,
      "cycle": 4,
      "permutation_id": "perm_13"
    },
    {
      "participant_id": "P086",
      "allocation_row": 86,
      "cycle": 4,
      "permutation_id": "perm_14"
    },
    {
      "participant_id": "P087",
      "allocation_row": 87,
      "cycle": 4,
      "permutation_id": "perm_15"
    },
    {
      "participant_id": "P088",
      "allocation_row": 88,
      "cycle": 4,
      "permutation_id": "perm_16"
    },
    {
      "participant_id": "P089",
      "allocation_row": 89,
      "cycle": 4,
      "permutation_id": "perm_17"
    },
    {
      "participant_id": "P090",
      "allocation_row": 90,
      "cycle": 4,
      "permutation_id": "perm_18"
    },
    {
      "participant_id": "P091",
      "allocation_row": 91,
      "cycle": 4,
      "permutation_id": "perm_19"
    },
    {
      "participant_id": "P092",
      "allocation_row": 92,
      "cycle": 4,
      "permutation_id": "perm_20"
    },
    {
      "participant_id": "P093",
      "allocation_row": 93,
      "cycle": 4,
      "permutation_id": "perm_21"
    },
    {
      "participant_id": "P094",
      "allocation_row": 94,
      "cycle": 4,
      "permutation_id": "perm_22"
    },
    {
      "participant_id": "P095",
      "allocation_row": 95,
      "cycle": 4,
      "permutation_id": "perm_23"
    },
    {
      "participant_id": "P096",
      "allocation_row": 96,
      "cycle": 4,
      "permutation_id": "perm_24"
    },
    {
      "participant_id": "P097",
      "allocation_row": 97,
      "cycle": 5,
      "permutation_id": "perm_01"
    },
    {
      "participant_id": "P098",
      "allocation_row": 98,
      "cycle": 5,
      "permutation_id": "perm_02"
    },
    {
      "participant_id": "P099",
      "allocation_row": 99,
      "cycle": 5,
      "permutation_id": "perm_03"
    },
    {
      "participant_id": "P100",
      "allocation_row": 100,
      "cycle": 5,
      "permutation_id": "perm_04"
    }
  ]
});
}());

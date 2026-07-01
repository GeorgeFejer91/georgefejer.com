# Questionnaire Backend Operations Companion

Drafted: 2026-06-30

This file is the backend/operator companion to the Study 6 questionnaire HTML
preview. The browser UI in `../questionnaire-ui-preview/` is a visual preview
and export-contract reference. It is not the authoritative runtime. The native
Quest app, study runner, or caller-owned backend owns allocation,
randomization, audio playback, physiology capture, result writing, and private
data storage.

Read this file together with:

- `../STUDY_RUNBOOK.md`: full end-to-end study run procedure and data write
  timeline.
- `study6_apk_permutation_lookup.json`: central condition/audio permutation
  lookup template. Copy this file into each private APK data folder as
  `condition_audio_lookup.json`.
- `study6_apk_variant_catalog.csv`, `study6_condition_catalog.csv`,
  `study6_audio_variant_catalog.csv`, `study6_condition_permutation_table.csv`,
  `study6_audio_permutation_table.csv`, and
  `study6_participant_lookup_table.csv`: normalized generated companions for
  checking APK codes, condition/audio catalogs, the 24 condition orders, the 24
  audio orders, and the 100 participant allocation rows. The JSON remains the
  runtime authority.
- `../questionnaire-ui-preview/README.md`: participant-facing panel flow,
  item IDs, result JSON paths, and browser-preview behavior.
- `../questionnaire-ui-preview/questionnaire-item-library.js`: source of
  questionnaire item IDs, flat variable names, result paths, and validation
  expectations.
- `../questionnaire-ui-preview/fixtures/default-state.json`: representative
  exported preview state.

## Runtime Authority Boundary

The HTML preview owns:

- panel layout and copy preview;
- the intended page sequence;
- questionnaire item IDs and flat variable names;
- representative fixture state;
- Self-Assessment Manikin asset references;
- preview-only JSON export shape.

The native/caller backend owns:

- participant/session ID generation;
- persisted lookup-row and permutation assignment;
- VR particle-condition mapping;
- APK variant/build identity;
- APK run-order assignment when both APK variants are completed;
- lookup-based audio assignment and playback;
- Polar H10 readiness and ECG/RR capture;
- induction start/end timing;
- questionnaire request creation;
- caller-owned result URI creation;
- atomic result writing;
- private data layout;
- quality-control and exclusion logs;
- analysis export generation.

No backend operation should rely on the participant or browser preview to choose
condition order, VR condition IDs, audio variants, result paths, or private
storage locations.

## Canonical Panel Contract

Current panel constants from the preview:

| Field | Current value |
| --- | --- |
| Panel ID | `study6_questionnaire_panel_preview` |
| Protocol version | `quest.questionnaire.v1` |
| Schema ID | `study6-questionnaire-v8` |
| Schema version | `8` |
| Frame | `1080dp x 720dp` |
| Open stage | `demographics` for first launch |
| Repeated condition block pages | `session_ready`, `vr_task_instructions`, then the four assessment pages |
| Repeated assessment pages | `self_assessment_manikin`, `affect_vas`, `emotion_representation_vas`, `hand_embodiment` |

Every condition block must show `session_ready` before audio/condition timing
starts. The participant presses `Start next session`; only then should the
runtime advance to `vr_task_instructions`, start the 20-second development
audio block or 300-second production block, and write the block-start evidence.

The native app may render the same questionnaire natively. If so, it should
still preserve the IDs, response paths, validation rules, and metadata contract
documented here and in the preview README.

## Required Backend Stores

Participant data must be stored outside the public repository under a private,
access-controlled root. The runbook uses:

```text
<private-study-data-root>/
  Study_particle_env_data/
  Study_particle_hands_data/
```

The backend must be able to write:

- `condition_audio_lookup.json`, copied from
  `for-ai/study6_apk_permutation_lookup.json`;
- generated read-only lookup companions in `allocation/`, copied from
  `for-ai/study6_apk_variant_catalog.csv`,
  `for-ai/study6_condition_catalog.csv`,
  `for-ai/study6_audio_variant_catalog.csv`,
  `for-ai/study6_condition_permutation_table.csv`,
  `for-ai/study6_audio_permutation_table.csv`, and
  `for-ai/study6_participant_lookup_table.csv` when operator-facing tables are
  useful;
- `allocation_state.json`, updated atomically as participants are assigned and
  completed;
- allocation tables in `allocation/`;
- flat condition data files in `data/`;
- participant/session metadata as flat files or appended rows in `data/`;
- identifying consent material in `consent_private/`;
- one appended questionnaire response table at
  `data/questionnaire_responses_long.csv`;
- runtime events as append-only JSON Lines;
- raw timestamped ECG CSV files and block markers named with
  `<apk_file_code>_<participant_id>_<block_id>_<vr_condition_id>`;
- QC decisions and derived analysis exports.

The public `Research/study-6/` repository stores materials only. Do not write
raw participant responses, names, signatures, ECG/RR recordings, private
session logs, or analysis exports with real participant data into this repo.

For each block-specific
`data/<apk_file_code>_<participant_id>_<block_id>_<vr_condition_id>_events.jsonl`
file, the minimum event stream is:

- `session_ready_prompt_shown`;
- `session_start_confirmed`;
- `block_assigned`;
- `block_started`;
- `audio_started`;
- `audio_stopped_dev_duration` during development, or production audio/block
  completion events during the real study;
- `questionnaire_started`;
- four `page_completed` events;
- `questionnaire_completed`;
- `result_write_success`;
- `block_completed`;
- `validation_failure` or `technical_failure` when applicable.

## Study Startup Constraints

Before the backend enables real data collection, it must verify:

- the preregistration has been submitted;
- VR condition IDs are locked and mapped to coherence and energy/noise levels;
- APK variant IDs and package names are locked;
- APK run order is locked or counterbalanced if participants complete both APK
  variants;
- ECG/HRV preprocessing and artifact rules are locked;
- eligibility and stopping rules are locked;
- the private data root exists and is writable;
- the active app build/config version is recorded;
- the questionnaire schema ID and item-library version are recorded.

If any of these are missing, the runtime should mark the run as a technical
test or refuse confirmatory collection.

## Participant Allocation

Study 6 uses two matched Quest APK variants. They should share the same
questionnaire, audio, counterbalancing, result-writing, and particle-condition
contract. The implementation difference is the particle mapping target:

| APK variant ID | Particle mapping target | Backend meaning |
| --- | --- | --- |
| `BG_ENV` | Background/surrounding environment | Background/environment APK variant |
| `HAND_AV` | Virtual hand avatar | Hand-avatar APK variant |

For each participant, the backend creates:

- `participant_id`: pseudonymous, stable across a session;
- `session_id`: unique session instance;
- `language_code`: `en` or `de`;
- assigned APK variant or APK run order;
- one lookup-row/permutation assignment per APK run, unless the final protocol
  uses a different explicit scheme;
- one lookup-assigned audio-variant order per APK run;
- planned global block order.

Participant IDs are assigned automatically from the lookup. The operator should
not manually choose participant numbers. The backend reads
`condition_audio_lookup.json`, selects the next available participant row from
the 100-row `participant_allocation` array, and uses that row's
`permutation_id` to join both the condition and audio permutation tables.

The canonical condition orders are the 24 rows in
`condition_permutations` inside `condition_audio_lookup.json`. The generated
`study6_condition_permutation_table.csv` file is the human-readable companion
for those same rows. The canonical audio orders are the 24 rows in
`audio_permutations`, with `study6_audio_permutation_table.csv` as the
human-readable companion. The 100-row `participant_allocation` table maps each
participant ID to one `permutation_id`; use that ID to join the condition and
audio permutation tables. Stable APK facts, condition factor codes, and audio
asset facts live in the three catalog tables.

The backend should allocate from the persisted lookup and allocation state, not
from ephemeral memory. The 100-row lookup cycles through all 24 permutations;
when a full cycle has complete data, allocation continues into the next cycle.

The backend must treat each runtime condition ID as the neutral factor-coded VR
condition:

| VR condition ID | Abbreviation | Coherence | Energy/noise |
| --- | --- | --- | --- |
| `LC_LE` | Low coherence / low energy | Low | Low |
| `LC_HE` | Low coherence / high energy | Low | High |
| `HC_LE` | High coherence / low energy | High | Low |
| `HC_HE` | High coherence / high energy | High | High |

Each runtime block must record:

- `apk_file_code`: `BG_ENV` or `HAND_AV`;
- `block_id`: `B01`, `B02`, `B03`, or `B04`;
- `vr_condition_id`;
- `coherence_level`: `low` or `high`;
- `energy_noise_level`: `low` or `high`.

The joined participant/permutation plan should be used to name flat data files,
not folders. Example file stems for `P001` in the `BG_ENV` APK:

```text
BG_ENV_P001_B01_HC_HE
BG_ENV_P001_B02_LC_HE
BG_ENV_P001_B03_HC_LE
BG_ENV_P001_B04_LC_LE
```

## Audio Assignment

The neutral hand-task audio is a control/engagement task, not an experimental
condition. The backend must select only language-matched files and should
use the audio order already assigned in the selected participant row. Do not
reshuffle audio at runtime after a row has been allocated.

The public audio package lives at:

```text
Main audio asset page:
https://www.georgefejer.com/Research/study-6/neutral-hand-audio/

Direct MP3 base path:
https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/
```

The lookup includes these locations under `audio_asset_locations`. It also
includes language-specific MP3 filenames and full per-block MP3 URLs in the
audio and participant allocation tables.

| Audio ID | Version | English file | German file |
| --- | --- | --- | --- |
| `audio_instruction_set_1` | `V01` | `study6_neutral_hand_audio_V01_EN.mp3` | `study6_neutral_hand_audio_V01_DE.mp3` |
| `audio_instruction_set_2` | `V02` | `study6_neutral_hand_audio_V02_EN.mp3` | `study6_neutral_hand_audio_V02_DE.mp3` |
| `audio_instruction_set_3` | `V03` | `study6_neutral_hand_audio_V03_EN.mp3` | `study6_neutral_hand_audio_V03_DE.mp3` |
| `audio_instruction_set_4` | `V04` | `study6_neutral_hand_audio_V04_EN.mp3` | `study6_neutral_hand_audio_V04_DE.mp3` |

Each assigned block must record audio ID, version, language, asset path,
duration target, and an integrity value such as SHA-256 or manifest hash.

## Questionnaire Request Payload

Each questionnaire launch should be created by the backend with enough context
for the panel to render the correct stage and write a complete result. A
representative request object is:

```json
{
  "protocol_version": "quest.questionnaire.v1",
  "schema_id": "study6-questionnaire-v8",
  "panel_id": "study6_questionnaire_panel_preview",
  "result_uri": "caller-owned-private-uri",
  "participant_id": "P001",
  "session_id": "P001_2026-06-30T120000",
  "open_stage": "self_assessment_manikin",
  "language_code": "en",
  "apk_variant_id": "BG_ENV",
  "apk_file_code": "BG_ENV",
  "mapping_target": "background_environment",
  "apk_package_name": "TBD.package.name",
  "apk_build_version": "TBD-build",
  "apk_run_position": 1,
  "global_block_position": 1,
  "apk_block_position": 1,
  "counterbalance_order_id": "perm_01",
  "permutation_id": "perm_01",
  "block_id": "B01",
  "block_file_stem": "BG_ENV_P001_B01_HC_HE",
  "questionnaire_append_file": "data/questionnaire_responses_long.csv",
  "block_metadata_file": "data/BG_ENV_P001_B01_HC_HE_block_metadata.json",
  "event_log_file": "data/BG_ENV_P001_B01_HC_HE_events.jsonl",
  "ecg_file": "data/BG_ENV_P001_B01_HC_HE_ECG_PolarH10.csv",
  "condition_id": "HC_HE",
  "vr_condition_id": "HC_HE",
  "coherence_level": "high",
  "energy_noise_level": "high",
  "audio_variant_id": "V01",
  "audio_instruction_id": "audio_instruction_set_1",
  "audio_asset_page_url": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/",
  "audio_direct_mp3_base_url": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/",
  "audio_asset_file": "study6_neutral_hand_audio_V01_EN.mp3",
  "audio_asset_url": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/study6_neutral_hand_audio_V01_EN.mp3",
  "questionnaire_state": {
    "condition_index": 1,
    "open_stage": "self_assessment_manikin",
    "demographics": {
      "polar_validation": {
        "ready": true
      }
    }
  }
}
```

For demographics, `open_stage` is `demographics`, and block/APK-run fields may be
omitted or null. For repeated assessment pages, block/APK-run fields are
required.

The `result_uri` must be caller-owned, private, and unique enough to avoid
overwriting another participant, session, APK run, block, or page result.

## Questionnaire Result Payload

The backend should append questionnaire item rows to one master CSV after every
assessment block. If the runtime also keeps an internal JSON payload before
flattening, that payload must include enough metadata to produce the CSV rows:

```json
{
  "protocol_version": "quest.questionnaire.v1",
  "schema_id": "study6-questionnaire-v8",
  "participant_id": "P001",
  "session_id": "P001_2026-06-30T120000",
  "apk_variant_id": "BG_ENV",
  "apk_file_code": "BG_ENV",
  "mapping_target": "background_environment",
  "apk_package_name": "TBD.package.name",
  "apk_build_version": "TBD-build",
  "apk_run_position": 1,
  "global_block_position": 1,
  "apk_block_position": 1,
  "counterbalance_order_id": "perm_01",
  "permutation_id": "perm_01",
  "block_id": "B01",
  "block_file_stem": "BG_ENV_P001_B01_HC_HE",
  "questionnaire_append_file": "data/questionnaire_responses_long.csv",
  "condition_id": "HC_HE",
  "vr_condition_id": "HC_HE",
  "coherence_level": "high",
  "energy_noise_level": "high",
  "answers": {
    "emotion_assessment": {
      "sam": {
        "valence_raw_1_9": 5,
        "arousal_raw_1_9": 5,
        "dominance_raw_1_9": 5
      },
      "affect_vas": {
        "valence_raw_0_100": 50,
        "arousal_raw_0_100": 50
      },
      "emotion_representation_vas": {
        "anger_raw_0_100": 0,
        "disgust_raw_0_100": 0,
        "fear_raw_0_100": 0,
        "happiness_raw_0_100": 0,
        "sadness_raw_0_100": 0,
        "surprise_raw_0_100": 0
      },
      "hand_embodiment": {
        "ownership_raw_1_7": 4,
        "agency_raw_1_7": 4
      }
    }
  },
  "page_complete": {
    "self_assessment_manikin": true,
    "affect_vas": true,
    "emotion_representation_vas": true,
    "hand_embodiment": true
  },
  "complete": true
}
```

Demographics results should be written once per participant/session to
`demographics.json`. Name fields are identifying and must be kept inside the
private data root. Analysis exports should use pseudonymous IDs and
non-identifying demographic fields only.

The backend should also write questionnaire values in long CSV format using
response IDs shaped as:

```text
<apk_file_code>_<participant_id>_<block_id>_<vr_condition_id>_<item_id>
```

Examples:

```text
BG_ENV_P001_B01_HC_HE_SAM1
BG_ENV_P001_B01_HC_HE_valence
BG_ENV_P001_B01_HC_HE_Anger
```

`SAM1`, `SAM2`, and `SAM3` are reserved for Self-Assessment Manikin pictograph
rows only. Do not use `SAM` as shorthand for the complete questionnaire or any
non-manikin assessment page.

Append these rows to `data/questionnaire_responses_long.csv`. Do not create
separate per-block questionnaire CSVs; `block_order`, `block_id`, and
`vr_condition_id` preserve the condition identity in the master table. The
`response_id` must also contain the APK filename code so rows from the two APKs
can be pooled without collision.

## Validation Constraints

The backend must enforce these rules before marking a block complete:

- `participant_id`, `session_id`, `apk_variant_id`, `condition_id`, and
  `vr_condition_id` are present.
- APK run and block positions are valid integers in the planned sequence.
- Runtime condition ID maps to locked VR condition factor coding.
- Audio language matches `language_code`.
- Audio file exists and is the expected five-minute asset.
- The readiness prompt was shown and the participant confirmed start before the
  induction/audio start timestamp.
- Induction start and end timestamps exist.
- All required Self-Assessment Manikin pictograph fields are integers from 1 to 9.
- Affect VAS fields are integers from 0 to 100 and were touched at least once.
- Particle emotion representation VAS fields are integers from 0 to 100.
- Hand embodiment fields are integers from 1 to 7.
- The final result has all four assessment pages marked complete.
- The result was written to the caller-owned private URI.

Invalid blocks should be retained as raw records with a QC flag rather than
silently deleted.

## Atomic Writes And Resume Behavior

The backend should treat every result write as a data-integrity operation:

- write to a temporary file first, then atomically replace the final file;
- never overwrite a completed block without creating an audit event;
- append runtime events to `runtime_events.jsonl`;
- include app build/config version on every session;
- include questionnaire schema version on every result;
- allow a session to resume only from a well-defined stage;
- if a block is rerun after a technical failure, mark the failed block and
  record the rerun in QC metadata.

If duplicate complete sessions exist, analysis selection must follow the
preregistered duplicate-session rule rather than ad hoc outcome inspection.

## Physiology Synchronization

Polar H10 readiness is native-owned. The browser preview's readiness strip is
visual only. The backend must record readiness and streaming state before the
participant begins demographics or a condition block.

For every five-minute induction block, write:

- block start marker;
- block end marker;
- condition/VR-condition/APK-run IDs;
- audio start/end or playback-complete events;
- ECG/RR stream availability;
- sampling rate and artifact flags;
- preprocessing version for derived HRV features.

Each block must save a raw ECG CSV file named:

```text
data/<apk_file_code>_<participant_id>_<block_id>_<vr_condition_id>_ECG_PolarH10.csv
```

Every ECG sample row must include a timestamp for that sample. Save the Polar
sample timestamp when available and also save the app/host receipt timestamp in
UTC. Do not save only derived HRV values and do not rely only on nominal sample
frequency.

The confirmatory physiology export must be computed only from the locked
preprocessing window and artifact rules.

## Error And QC Constraints

The backend should distinguish participant withdrawal, missing required
answers, technical failures, physiology-only failures, and metadata failures.
Recommended QC fields include:

- `session_complete`;
- `apk_run_complete`;
- `block_complete`;
- `block_valid_for_confirmatory_self_report`;
- `block_valid_for_confirmatory_physiology`;
- `technical_failure`;
- `wrong_audio_language`;
- `invalid_condition_mapping`;
- `missing_required_answer`;
- `physiology_artifact_exclusion`;
- `exclusion_reason`;
- `qc_decided_before_outcome_inspection`.

Self-report endpoints are valid values. A 0, 100, 1, 7, or 9 should not be
excluded merely because it is an endpoint.

## Analysis Export Constraints

The backend or export script should generate `derived/block_level.csv` with one
row per valid participant x APK variant x block/VR condition. The export should use
the flat variable names from the questionnaire item library, including:

- `sam_valence_raw_1_9`
- `sam_arousal_raw_1_9`
- `sam_dominance_raw_1_9`
- `affect_vas_valence_raw_0_100`
- `affect_vas_arousal_raw_0_100`
- `emotion_representation_vas_anger_raw_0_100`
- `emotion_representation_vas_disgust_raw_0_100`
- `emotion_representation_vas_fear_raw_0_100`
- `emotion_representation_vas_happiness_raw_0_100`
- `emotion_representation_vas_sadness_raw_0_100`
- `emotion_representation_vas_surprise_raw_0_100`
- `hand_embodiment_ownership_raw_1_7`
- `hand_embodiment_agency_raw_1_7`

The export must also include design metadata: `participant_id`, `session_id`,
`apk_variant_id`, `apk_file_code`, `mapping_target`, `apk_package_name`,
`apk_build_version`, `apk_run_position`, `global_block_position`,
`apk_block_position`, `counterbalance_order_id`, `permutation_id`, `block_id`,
`block_file_stem`, `condition_id`, `vr_condition_id`, `coherence_level`,
`energy_noise_level`, audio assignment, technical-failure flags, and
physiology feature columns.

Do not include participant names or consent images in the analysis CSV.

## Backend Acceptance Checklist

Before treating the HTML/native questionnaire as ready for real data
collection, verify that the backend can:

- create a pseudonymous participant/session;
- identify the active APK variant as `BG_ENV` or `HAND_AV`;
- record package name, build version, mapping target, and APK run position;
- assign and persist the next lookup row and paired permutation IDs;
- create private write targets for demographics, the questionnaire master CSV,
  and each condition-level stream file;
- pass correct request metadata into the questionnaire;
- play the correct language-matched audio variant;
- mark induction start/end and questionnaire start/end;
- write demographics, appended questionnaire rows, block metadata, event logs,
  and condition-level ECG files to private storage;
- recover or flag partial/incomplete results;
- store ECG/RR files and block markers;
- generate a block-level CSV with no identifying fields;
- reject or flag missing runtime-to-VR-condition mappings;
- produce a dry-run session that is clearly excluded from confirmatory data.

## Open Locks

The current repository still marks these as decisions to lock:

- final runtime config confirmation that all APK variants use `LC_LE`, `LC_HE`,
  `HC_LE`, and `HC_HE` directly in request/result payloads;
- final APK run-order rule if participants complete both APK variants;
- confirmatory ECG/HRV feature and preprocessing window;
- eligibility criteria and stopping/resource limit;
- confirmatory or exploratory status of the particle emotion representation
  rating analysis.

Do not remove these open locks from backend documentation until the matching
preregistration and runtime config have been updated.

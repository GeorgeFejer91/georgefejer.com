# Study 6 End-To-End Runbook

Drafted: 2026-06-30

This document describes how each Study 6 APK should run, how participant/block
order is assigned, and exactly where data should be written. It is an
operator/backend runbook, not participant-facing wording.

For the backend/native operations behind the questionnaire HTML preview, read
this together with `for-ai/QUESTIONNAIRE_BACKEND_OPERATIONS.md`. The runbook
describes the procedure and output structure; the backend companion specifies
the operational constraints for allocation, randomization, private result
writing, physiology, validation, QC, and analysis export.

The public repository folder `Research/study-6/` stores study materials,
questionnaire previews, preregistration text, reusable assets, and lookup
templates. It must not store real participant responses, names, signatures, ECG
recordings, or private session logs. Real participant data belongs in a private,
access-controlled data root.

## APK Model

Study 6 should be built as two matched Quest APK variants. The APKs should be
identical in questionnaire flow, audio behavior, counterbalancing, data-writing
contract, and VR particle-condition logic. The only intended implementation
difference is where the particles are mapped.

| APK variant ID | Filename code | Private data folder | Particle mapping target |
| --- | --- | --- | --- |
| `BG_ENV` | `BG_ENV` | `Study_particle_env_data` | Background/surrounding environment |
| `HAND_AV` | `HAND_AV` | `Study_particle_hands_data` | Virtual hand avatar texture/material |

Do not treat these as two in-app phases. Each APK is its own run target. An APK
run shows all four VR particle conditions once, in an order assigned from the
central lookup table.

## VR Conditions

Use these neutral condition identifiers for the four particle conditions. They
are operational IDs, not outcome labels.

| VR condition ID | Meaning | Coherence | Energy/noise |
| --- | --- | --- | --- |
| `HC_HE` | High coherence / high energy | High | High |
| `LC_HE` | Low coherence / high energy | Low | High |
| `HC_LE` | High coherence / low energy | High | Low |
| `LC_LE` | Low coherence / low energy | Low | Low |

Each APK contains all four conditions. The backend decides which condition to
show at block 1, block 2, block 3, and block 4 by reading the lookup table.

## Central Lookup

The canonical lookup artifact for implementation planning is:

```text
for-ai/study6_apk_permutation_lookup.json
```

The generator also writes normalized human-readable companion tables:

```text
for-ai/study6_apk_variant_catalog.csv
for-ai/study6_condition_catalog.csv
for-ai/study6_audio_variant_catalog.csv
for-ai/study6_condition_permutation_table.csv
for-ai/study6_audio_permutation_table.csv
for-ai/study6_participant_lookup_table.csv
```

The JSON is the runtime source of truth. The CSV files are flat operator-facing
views of the same lookup. Catalog tables store stable APK, condition, and audio
facts. Permutation tables store the 24 condition orders and 24 audio orders.
The 100-row participant table stores only the participant allocation row and
the paired permutation ID; the backend derives block IDs and filenames by
joining those tables.

Each real private APK data folder should contain a copy of that file named:

```text
condition_audio_lookup.json
```

The lookup is the source of truth for:

- available participant IDs;
- which participant ID is assigned next;
- which condition permutation an APK should run;
- which audio permutation is paired with that condition permutation;
- which VR condition appears in each block position;
- which audio version plays in each block position;
- where the public neutral hand-task audio assets are hosted;
- how block IDs and flat data filenames should be derived.

The backend should not invent order at runtime. It should read the lookup,
select the next available participant row, mark it as active, and run the four
blocks in that row's order. When all permutations have complete data, allocation
continues from the next repeated cycle in the lookup.

## Permutation Rule

There are four VR conditions, so there are 24 possible condition orders. There
are also four audio variants, so there are 24 possible audio orders. Study 6
does not need a 24 x 24 cross-permutation table. Instead, condition permutation
1 is paired with audio permutation 1, condition permutation 2 is paired with
audio permutation 2, and so on.

The base order is:

```text
Conditions: HC_HE, LC_HE, HC_LE, LC_LE
Audio:      V01,   V02,   V03,   V04
```

The public audio asset locations are:

```text
Main audio asset page:
https://www.georgefejer.com/Research/study-6/neutral-hand-audio/

Direct MP3 base path:
https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/
```

The lookup stores the direct MP3 base path and the language-specific MP3 file
names so a backend can construct or record full asset URLs for each block.

The lookup contains the 24 permutations of each list and a 100-row participant
allocation schedule. Participant rows cycle through permutation IDs 1-24. After
permutation 24, the next row returns to permutation 1.

Example:

| Participant | Permutation ID | Condition order | Audio versions |
| --- | --- | --- | --- |
| `P001` | `perm_01` | `HC_HE`, `LC_HE`, `HC_LE`, `LC_LE` | `V01`, `V02`, `V03`, `V04` |
| `P002` | `perm_02` | `HC_HE`, `LC_HE`, `LC_LE`, `HC_LE` | `V01`, `V02`, `V04`, `V03` |
| `P003` | `perm_03` | `HC_HE`, `HC_LE`, `LC_HE`, `LC_LE` | `V01`, `V03`, `V02`, `V04` |

The participant ID is assigned automatically by the backend. The operator does
not choose a participant number manually.

## Private Data Roots

Each APK variant writes to its own private data folder. Use these canonical
folder names:

```text
<private-study-data-root>/
  Study_particle_env_data/
  Study_particle_hands_data/
```

`Study_particle_env_data` is used by the `BG_ENV` APK. `Study_particle_hands_data`
is used by the `HAND_AV` APK.

Each folder should have the same internal structure:

```text
Study_particle_env_data/
  condition_audio_lookup.json
  allocation_state.json
  run_manifest.jsonl
  allocation/
    study6_apk_variant_catalog.csv
    study6_condition_catalog.csv
    study6_audio_variant_catalog.csv
    study6_condition_permutation_table.csv
    study6_audio_permutation_table.csv
    study6_participant_lookup_table.csv
  demographics/
    demographics_index.csv
    P001_demographics.json
    P002_demographics.json
  data/
    questionnaire_items.csv
    questionnaire_responses_long.csv
    block_metadata_long.csv
    runtime_events.jsonl
    BG_ENV_P001_apk_run_metadata.json
    BG_ENV_P001_B01_HC_HE_block_metadata.json
    BG_ENV_P001_B01_HC_HE_ECG_PolarH10.csv
    BG_ENV_P001_B01_HC_HE_events.jsonl
    BG_ENV_P001_B02_LC_HE_block_metadata.json
    BG_ENV_P001_B02_LC_HE_ECG_PolarH10.csv
    BG_ENV_P001_B02_LC_HE_events.jsonl
    BG_ENV_P001_B03_HC_LE_block_metadata.json
    BG_ENV_P001_B03_HC_LE_ECG_PolarH10.csv
    BG_ENV_P001_B03_HC_LE_events.jsonl
    BG_ENV_P001_B04_LC_LE_block_metadata.json
    BG_ENV_P001_B04_LC_LE_ECG_PolarH10.csv
    BG_ENV_P001_B04_LC_LE_events.jsonl
```

The hand APK uses the same structure under `Study_particle_hands_data/`.

## Allocation State

`allocation_state.json` keeps the live participant allocation state for one APK
data folder. It should be updated atomically by the backend.

Minimum fields:

```json
{
  "apk_variant_id": "BG_ENV",
  "data_folder": "Study_particle_env_data",
  "lookup_file": "condition_audio_lookup.json",
  "next_participant_id": "P001",
  "active_participant_id": null,
  "completed_participant_ids": [],
  "failed_or_retest_participant_ids": [],
  "last_updated_utc": "ISO-8601 timestamp"
}
```

Allocation procedure:

1. Read `condition_audio_lookup.json`.
2. Read `allocation_state.json`.
3. Select `next_participant_id`.
4. Find that participant in the lookup's `participant_allocation` list.
5. Ensure the APK data root has `data/`, `demographics/`, and `allocation/`.
6. Mark the participant as active in `allocation_state.json`.
7. Run the four blocks specified by the participant row.
8. On a complete valid run, move the ID to `completed_participant_ids` and set
   `next_participant_id` to the next unused row.
9. If all 24 permutation IDs have complete data in the current cycle, continue
   into the next cycle in the 100-row lookup.

## Demographics

Demographic and identifying setup data should be separated from block data.
The APK should write one JSON file per participant in:

```text
demographics/<participant_id>_demographics.json
```

It should also append or update one row in:

```text
demographics/demographics_index.csv
```

The demographics JSON should contain every saved field from the first panel,
`demographics`, including:

- `participant_id`;
- `apk_variant_id`;
- `session_id`;
- `language_code`;
- `participant_first_name`;
- `participant_last_name`;
- `participant_name`;
- `age_years`;
- `handedness`;
- `gender`;
- `consent_confirmed`;
- `consent_text`;
- `signature` metadata or signature file reference;
- Polar readiness status at demographics;
- demographics start/end timestamps.

Because names and signatures are identifying, the demographics folder must stay
inside private storage and must not be committed to the public repo.

## Flat Data File Naming

Each APK data root has one `data/` folder. Do not create separate participant
or block folders for the condition data. Instead, every filename must include:

- the APK filename code: `BG_ENV` or `HAND_AV`;
- the participant ID, such as `P001`;
- the block ID, such as `B01`;
- the VR condition ID, such as `HC_HE`.

Block IDs are pure order codes:

```text
B01
B02
B03
B04
```

The block ID tells you when the block was shown. The condition ID tells you what
VR condition the block had. Both must appear in condition-level filenames.

The block file stem is:

```text
<apk_file_code>_<participant_id>_<block_id>_<vr_condition_id>
```

Example files for the background-environment APK, participant `P001`, block
`B01`, condition `HC_HE`:

```text
data/BG_ENV_P001_B01_HC_HE_block_metadata.json
data/BG_ENV_P001_B01_HC_HE_ECG_PolarH10.csv
data/BG_ENV_P001_B01_HC_HE_events.jsonl
```

The matching hand-avatar APK files use the same convention with the `HAND_AV`
prefix, for example `data/HAND_AV_P001_B01_HC_HE_ECG_PolarH10.csv`.

Questionnaire item responses should not be split into four per-block
questionnaire CSVs. Append all questionnaire item rows for all participants and
conditions to one master file:

```text
data/questionnaire_responses_long.csv
```

Block metadata can also be appended to a master file for easier analysis:

```text
data/block_metadata_long.csv
```

## Block Metadata

Every block should write a metadata JSON file before or at block start, then
update it at block completion.

Example:

```json
{
  "participant_id": "P001",
  "apk_variant_id": "BG_ENV",
  "apk_file_code": "BG_ENV",
  "data_folder": "Study_particle_env_data",
  "mapping_target": "background_environment",
  "apk_package_name": "TBD.package.name",
  "apk_build_version": "TBD-build",
  "session_id": "P001_BG_ENV_2026-06-30T120000Z",
  "permutation_id": "perm_01",
  "block_order": 1,
  "block_id": "B01",
  "block_file_stem": "BG_ENV_P001_B01_HC_HE",
  "block_metadata_file": "data/BG_ENV_P001_B01_HC_HE_block_metadata.json",
  "ecg_file": "data/BG_ENV_P001_B01_HC_HE_ECG_PolarH10.csv",
  "event_log_file": "data/BG_ENV_P001_B01_HC_HE_events.jsonl",
  "questionnaire_append_file": "data/questionnaire_responses_long.csv",
  "vr_condition_id": "HC_HE",
  "coherence_level": "high",
  "energy_noise_level": "high",
  "audio_variant_id": "V01",
  "audio_asset_page_url": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/",
  "audio_direct_mp3_base_url": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/",
  "audio_asset_file": "study6_neutral_hand_audio_V01_EN.mp3",
  "audio_asset_url": "https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/study6_neutral_hand_audio_V01_EN.mp3",
  "questionnaire_schema_id": "study6-questionnaire-v8",
  "block_started_at_utc": "ISO-8601 timestamp",
  "block_completed_at_utc": "ISO-8601 timestamp",
  "induction_target_duration_s": 300,
  "induction_actual_duration_s": 300,
  "technical_failure": false,
  "notes": ""
}
```

## Questionnaire Item IDs

The questionnaire should save raw values using stable item IDs. Use one item
dictionary in each data folder:

```text
data/questionnaire_items.csv
```

Recommended item IDs:

| Item ID | Meaning | Source scale |
| --- | --- | --- |
| `SAM1` | Self-Assessment Manikin pictograph valence | 1-9 |
| `SAM2` | Self-Assessment Manikin pictograph arousal | 1-9 |
| `SAM3` | Self-Assessment Manikin pictograph dominance/control | 1-9 |
| `valence` | Valence VAS | 0-100 |
| `arousal` | Arousal VAS | 0-100 |
| `Anger` | Anger represented by particle movement | 0-100 |
| `Fear` | Fear represented by particle movement | 0-100 |
| `Sadness` | Sadness represented by particle movement | 0-100 |
| `Disgust` | Disgust represented by particle movement | 0-100 |
| `Happiness` | Happiness represented by particle movement | 0-100 |
| `Surprise` | Surprise represented by particle movement | 0-100 |
| `Ownership` | Virtual hand ownership | 1-7 |
| `Agency` | Virtual hand agency | 1-7 |

`SAM1`, `SAM2`, and `SAM3` are reserved for the Self-Assessment Manikin
pictograph rows only. Do not use `SAM` as shorthand for the complete
questionnaire, the affect VAS page, or the whole assessment block.

## Questionnaire Output

The canonical questionnaire output is one long-format CSV per APK data root:

```text
data/questionnaire_responses_long.csv
```

Every questionnaire page completed after a VR condition should append its item
rows to this file. Do not create a separate questionnaire CSV for each block.
The `block_order`, `block_id`, and `vr_condition_id` columns preserve which
condition produced each row.

The long-format CSV should use one row per item:

```csv
response_id,apk_file_code,participant_id,apk_variant_id,block_order,block_id,vr_condition_id,item_id,item_value,item_scale,recorded_at_utc
BG_ENV_P001_B01_HC_HE_SAM1,BG_ENV,P001,BG_ENV,1,B01,HC_HE,SAM1,7,1-9,2026-06-30T12:05:30Z
BG_ENV_P001_B01_HC_HE_SAM2,BG_ENV,P001,BG_ENV,1,B01,HC_HE,SAM2,6,1-9,2026-06-30T12:05:30Z
BG_ENV_P001_B01_HC_HE_SAM3,BG_ENV,P001,BG_ENV,1,B01,HC_HE,SAM3,5,1-9,2026-06-30T12:05:30Z
BG_ENV_P001_B01_HC_HE_valence,BG_ENV,P001,BG_ENV,1,B01,HC_HE,valence,74,0-100,2026-06-30T12:05:30Z
BG_ENV_P001_B01_HC_HE_arousal,BG_ENV,P001,BG_ENV,1,B01,HC_HE,arousal,63,0-100,2026-06-30T12:05:30Z
```

The important naming rule is:

```text
<apk_file_code>_<participant_id>_<block_id>_<vr_condition_id>_<item_id>
```

Examples:

```text
BG_ENV_P001_B01_HC_HE_SAM1
BG_ENV_P001_B01_HC_HE_SAM2
BG_ENV_P001_B01_HC_HE_SAM3
BG_ENV_P001_B01_HC_HE_valence
BG_ENV_P001_B01_HC_HE_arousal
BG_ENV_P001_B01_HC_HE_Anger
BG_ENV_P001_B01_HC_HE_Fear
BG_ENV_P001_B01_HC_HE_Sadness
BG_ENV_P001_B01_HC_HE_Disgust
BG_ENV_P001_B01_HC_HE_Happiness
BG_ENV_P001_B01_HC_HE_Surprise
```

## ECG Output

Each block should save one five-minute raw Polar H10 ECG CSV. Do not save only
derived HRV values. Do not rely only on nominal sample frequency. Every ECG
sample row must include its own timestamp.

File naming rule:

```text
data/<apk_file_code>_<participant_id>_<block_id>_<vr_condition_id>_ECG_PolarH10.csv
```

Examples:

```text
data/BG_ENV_P001_B01_HC_HE_ECG_PolarH10.csv
data/BG_ENV_P001_B02_LC_HE_ECG_PolarH10.csv
data/BG_ENV_P001_B03_HC_LE_ECG_PolarH10.csv
data/BG_ENV_P001_B04_LC_LE_ECG_PolarH10.csv
```

Minimum ECG CSV columns:

```csv
sample_id,apk_file_code,participant_id,apk_variant_id,block_order,block_id,vr_condition_id,device_id,sample_index,polar_sample_timestamp_ns,host_received_timestamp_utc,ecg_raw,ecg_unit,contact_quality,source
BG_ENV_P001_B01_HC_HE_ECG_PolarH10_000001,BG_ENV,P001,BG_ENV,1,B01,HC_HE,PolarH10,1,123456789000000,2026-06-30T12:00:00.001Z,123,uV,good,PolarH10_ECG
```

Required timestamp fields:

- `polar_sample_timestamp_ns`: device/sample timestamp if available from the
  Polar stream;
- `host_received_timestamp_utc`: host or app receipt timestamp in ISO-8601 UTC;
- `sample_index`: monotonically increasing sample number inside the block.

The ECG file must contain the raw ECG signal for the whole five-minute block,
plus timestamps for every sample. If a timestamp source is unavailable, the APK
must write an explicit null/empty field and log the problem in
`data/BG_ENV_P001_B01_HC_HE_events.jsonl` and
`data/BG_ENV_P001_B01_HC_HE_block_metadata.json`.

## Runtime Event Log

Each block should write:

```text
data/<apk_file_code>_<participant_id>_<block_id>_<vr_condition_id>_events.jsonl
```

Minimum event types:

- `block_started`;
- `audio_started`;
- `audio_completed`;
- `ecg_recording_started`;
- `ecg_recording_completed`;
- `questionnaire_started`;
- `questionnaire_completed`;
- `block_completed`;
- `technical_failure` if applicable.

Every event row should include `participant_id`, `apk_variant_id`,
`block_order`, `vr_condition_id`, and an ISO-8601 UTC timestamp.

## APK Run Procedure

For each APK run:

1. Read `condition_audio_lookup.json`.
2. Read and lock `allocation_state.json`.
3. Assign the next available `participant_id`.
4. Ensure `data/`, `demographics/`, and `allocation/` exist.
5. Save demographics fields into `demographics/`.
6. Read the participant row's permutation ID and join it to the condition and
   audio permutation tables.
7. For each block, show the assigned VR condition and play the assigned audio
   variant.
8. Save block metadata, raw ECG CSV with sample timestamps, and event log as
   flat files in `data/`, named with
   `<apk_file_code>_<participant_id>_<block_id>_<vr_condition_id>`.
9. Append all questionnaire item rows to `data/questionnaire_responses_long.csv`.
10. Mark the participant complete in `allocation_state.json` only when all four
   blocks are complete and valid.

## Materials Map

Version-controlled study materials live here:

- `for-ai/study6_apk_permutation_lookup.json`: central condition/audio lookup
  template for 100 participant rows. This JSON is the backend/runtime source of
  truth.
- `for-ai/study6_apk_variant_catalog.csv`: generated flat catalog of APK
  variant IDs, filename codes, data folders, and mapping targets.
- `for-ai/study6_condition_catalog.csv`: generated flat catalog of VR condition
  IDs and their coherence/energy factor codes.
- `for-ai/study6_audio_variant_catalog.csv`: generated flat catalog of audio
  variant IDs, instruction IDs, filenames, and hosted MP3 URLs.
- `for-ai/study6_condition_permutation_table.csv`: generated flat table of the
  24 VR-condition block-order permutations.
- `for-ai/study6_audio_permutation_table.csv`: generated flat table of the 24
  audio-variant block-order permutations.
- `for-ai/study6_participant_lookup_table.csv`: generated 100-row participant
  allocation table with only participant ID, row/cycle, and permutation ID.
  Join this to the catalog and permutation tables to derive block IDs, condition
  IDs, audio assignments, and filenames.
- `for-ai/generate_study6_apk_permutation_lookup.js`: generator for rebuilding
  the lookup JSON and CSV companion tables if condition IDs, audio variants,
  questionnaire item IDs, or allocation length change.
- `for-ai/QUESTIONNAIRE_BACKEND_OPERATIONS.md`: backend/native companion to the
  questionnaire HTML preview.
- `questionnaire-ui-preview/`: browser preview and questionnaire item/export
  contract.
- `questionnaire-assets/`: Self-Assessment Manikin pictographs and participation-confirmation
  assets.
- `neutral-hand-audio/`: validated English/German five-minute hand-task audio,
  transcripts, timing libraries, and rebuild scripts. Main audio asset page:
  `https://www.georgefejer.com/Research/study-6/neutral-hand-audio/`. Direct
  MP3 base path:
  `https://www.georgefejer.com/Research/study-6/neutral-hand-audio/audio/`.

Real participant data should live only in the private APK data folders:

```text
Study_particle_env_data/
Study_particle_hands_data/
```

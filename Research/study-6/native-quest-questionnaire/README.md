# Study 6 Native Quest Questionnaire

This workspace contains the native Quest APK implementation for the Study 6
questionnaire panel system.

The APK now has two runnable shells over the same study controller:

- `Study6SpatialActivity`: the launch Activity. It is a Meta Spatial SDK
  `AppSystemActivity` with `VRFeature`, `ComposeFeature`, a 1080dp x 720dp
  `LayoutXMLPanelRegistration`, and a visible 3D panel entity.
- `Study6QuestActivity`: a direct Android/WebView fallback harness for quick
  debugging outside the Spatial shell.

Both shells use the same `Study6QuestionnairePanelController` and
`Study6RunLogger`. The deployed questionnaire preview assets are packaged as
APK assets so wording, ratios, required-state behavior, sliders, SAM choices,
name-entry behavior, and visual design stay aligned with the web source of truth.
The runtime allocation and logging authority is
`for-ai/study6_apk_permutation_lookup.json`, including the real 24-permutation
schedule. In non-auto-run launches, the APK also installs a native-only manual
audit bridge that writes trusted controller/hand/browser interaction evidence to
`data/manual_interactions.jsonl`.

## Constants

- protocol: `quest.questionnaire.v1`
- schema: `study6-questionnaire-v8`
- logical panel ID: `study6_questionnaire_panel_preview`
- native panel surface: `1080dp x 720dp`
- development induction/audio duration: `20s`
- production induction/audio duration: `300s`
- repeated block flow: `session_ready` -> `vr_task_instructions` -> four assessment pages

Every block starts on a readiness screen with a `Start next session` button.
The assigned audio and condition timer start only after that button advances the
panel to `vr_task_instructions`.

## Host Verification

From `Research/study-6/native-quest-questionnaire`:

```powershell
.\build\gradle-8.13\bin\gradle.bat :questionnaire-core:run --offline
$node = "C:\Users\gfeje\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
& $node tools\verify-study-flow.mjs
& $node tools\verify-preview-asset-alignment.mjs
& $node tools\verify-lookup-contract.mjs
& $node tools\audit-goal-readiness.mjs
```

The verifier writes evidence under:

```text
native-quest-questionnaire/build/verification/dev-run-BG_ENV-P001/
```

It checks allocation, block order, audio assignment, response IDs, nested result
JSON, long CSV rows, block metadata, event logs, and debug Polar placeholder
files.

`verify-preview-asset-alignment.mjs` compares the deployed questionnaire preview,
the local `questionnaire-ui-preview/` files, and the APK-packaged assets for
the participant-facing HTML/CSS/JS contract. Current report:

```text
native-quest-questionnaire/build/preview-asset-alignment-report.json
index.html                              deployed = local = APK
styles.css                              deployed = local = APK
questionnaire-item-library.js           deployed = local = APK
panel-preview.js                        deployed = local = APK
```

`verify-questionnaire-instance-alignment.mjs` derives the canonical response
item order and labels from the deployed preview item library, then checks the
local preview, APK-packaged preview assets, fixtures, backend lookup JSON,
lookup generator source, Gradle asset sync, and stale README wording scan.

```text
native-quest-questionnaire/build/questionnaire-instance-alignment-report.json
13 canonical response items match deployed/local/APK/backend instances
```

`verify-lookup-contract.mjs` checks the authoritative backend lookup and the
APK-packaged copy of that lookup. It verifies the 24 unique condition
permutations, 24 unique audio permutations, 100 participant allocation rows,
13 questionnaire items, local audio asset presence, and all expected block stems
and response IDs across both APK variants. Current report:

```text
native-quest-questionnaire/build/lookup-contract-report.json
24 condition/audio permutations
800 unique block stems
10400 unique response IDs
APK packaged lookup hash equals source lookup hash
```

`audit-goal-readiness.mjs` aggregates the current evidence into one completion
audit. Before the real next-participant manual pass, it is expected to report
`not_complete` with exactly one missing check:

```text
manual_headset_controller_hand_pass
```

After the supervised manual watcher has captured and verified the current
`allocation_state.json` next participant, rerun the audit; only then should it
pass.

## APK Build

This workspace uses the local Android SDK under
`native-quest-questionnaire/android-sdk` and a downloaded/cached Gradle 8.13
distribution under `native-quest-questionnaire/build/gradle-8.13`.

```powershell
cd C:\Users\gfeje\Documents\GitHub\georgefejer.com\Research\study-6\native-quest-questionnaire
.\build\gradle-8.13\bin\gradle.bat :quest-app:assembleDebug
```

Debug APK:

```text
native-quest-questionnaire/quest-app/build/outputs/apk/debug/quest-app-debug.apk
```

## Device Verification

Install and launch the Spatial Activity with a bounded auto-run:

```powershell
$adb = "C:\Users\gfeje\Documents\GitHub\georgefejer.com\Research\study-6\native-quest-questionnaire\android-sdk\platform-tools\adb.exe"
$apk = "C:\Users\gfeje\Documents\GitHub\georgefejer.com\Research\study-6\native-quest-questionnaire\quest-app\build\outputs\apk\debug\quest-app-debug.apk"
& $adb -s 3487C10J0P01ZY install -r -d -g $apk
& $adb -s 3487C10J0P01ZY shell pm clear com.georgefejer.study6.quest
& $adb -s 3487C10J0P01ZY shell am start -n com.georgefejer.study6.quest/.Study6SpatialActivity --ez study6_auto_run true --es study6_participant_id P001 --es study6_apk_variant_id BG_ENV
```

After the four 20-second dev blocks complete, pull private files with `run-as`
and verify:

```powershell
& $adb -s 3487C10J0P01ZY exec-out run-as com.georgefejer.study6.quest tar -C files/study6-dev -cf - . > study6-dev.tar
tar -xf study6-dev.tar -C pulled-study6-dev
node tools\verify-device-run.mjs pulled-study6-dev\Study_particle_env_data
```

The APK also writes a pullable analysis export to external app storage:

```powershell
& $adb -s 3487C10J0P01ZY pull /sdcard/Android/data/com.georgefejer.study6.quest/files/Study6DataExport Study6DataExport
node tools\verify-analysis-ready.mjs Study6DataExport
```

For one APK variant, `analysis_ready/` contains exactly two summary CSVs plus
four ECG CSVs per completed participant:

```text
Study6DataExport/BG_ENV/analysis_ready/study6_BG_ENV_psychometrics_wide.csv
Study6DataExport/BG_ENV/analysis_ready/demographics/study6_BG_ENV_demographics.csv
Study6DataExport/BG_ENV/analysis_ready/block_ecg/BG_ENV_P001_B01_HC_HE_ECG_PolarH10.csv
```

For allocation-series validation, clear app data once, then relaunch without
`study6_participant_id`; the APK should advance through
`allocation_state.json`. The strict series verifier checks all expected
participants, block metadata, event logs, response IDs, nested result JSON,
long CSV rows, ECG placeholders, duplicate rows, and the final next participant:

```powershell
$env:STUDY6_EXPECTED_PARTICIPANTS = "P001,P002,P003"
node tools\verify-device-series.mjs pulled-study6-dev
Remove-Item Env:\STUDY6_EXPECTED_PARTICIPANTS
```

For fresh-block validation with different emulated response behaviors, pass
`study6_auto_run_profile` on launch. Supported profiles are `linear`, `low`,
`high`, and `zigzag`. The verifier accepts the matching participant profile map:

```powershell
& $adb -s 3487C10J0P01ZY shell am start -n com.georgefejer.study6.quest/.Study6SpatialActivity --ez study6_auto_run true --es study6_apk_variant_id BG_ENV --es study6_auto_run_profile low
& $adb -s 3487C10J0P01ZY shell am start -n com.georgefejer.study6.quest/.Study6SpatialActivity --ez study6_auto_run true --es study6_apk_variant_id BG_ENV --es study6_auto_run_profile high
$env:STUDY6_EXPECTED_PARTICIPANTS = "P001,P002,P003,P004,P005,P006,P007"
$env:STUDY6_EXPECTED_PROFILES = "P004:low,P005:high,P006:zigzag"
node tools\verify-device-series.mjs pulled-study6-dev
Remove-Item Env:\STUDY6_EXPECTED_PARTICIPANTS
Remove-Item Env:\STUDY6_EXPECTED_PROFILES
```

The repeatable harness below performs that full loop in one command: optional
install, optional pre-clear private-data archive, optional `pm clear`, four
auto-run launches, bounded polling through `allocation_state.json`, private
data retrieval through `adb exec-out run-as ... tar`, external
`Study6DataExport` retrieval, extraction, strict series verification, and
analysis-ready export verification.

```powershell
$env:STUDY6_CLEAR_APP_DATA = "1"
$env:STUDY6_AUTO_PROFILES = "linear,low,high,zigzag"
node tools\run-device-auto-series.mjs
Remove-Item Env:\STUDY6_CLEAR_APP_DATA
Remove-Item Env:\STUDY6_AUTO_PROFILES
```

Current validated headset evidence:

```text
native-quest-questionnaire/build/device-validation/quest3s-spatial-auto-series-001/
native-quest-questionnaire/build/device-validation/quest3s-spatial-allocation-series-002/
native-quest-questionnaire/build/device-validation/quest3s-spatial-profile-series-001/
native-quest-questionnaire/build/device-validation/quest3s-spatial-profile-series-002/
native-quest-questionnaire/build/device-validation/quest3s-spatial-manual-audit-regression-001/
```

The latest clean auto-series run before the `session_ready` screen used the
rebuilt APK, archived the previous private dev folder, cleared only
`com.georgefejer.study6.quest`, ran P001-P004 with `linear`, `low`, `high`,
and `zigzag`, pulled
`files/study6-dev` through `adb exec-out run-as ... tar`, and passed strict
verification with 208 questionnaire responses across 16 blocks. Freshness
markers showed independent block values:

```text
P001 linear B01=5 B02=6 B03=7 B04=8
P002 low    B01=5 B02=4 B03=3 B04=2
P003 high   B01=8 B02=7 B03=6 B04=5
P004 zigzag B01=2 B02=8 B03=2 B04=8
```

Historical pre-readiness verified APK SHA-256:

```text
F865988E480BE2C9206C5D3DED28FAAA70D64122678792BD41F5B11A2F57292F
```

Current rebuilt debug APK SHA-256 with `session_ready` packaged:

```text
9C6514A13C60C451BAFF05595F6ECF7ED05AB7E68889DBE02E43E72FA294E183
```

This current build has passed host contract, simulated data-flow, lookup, and
local-preview-to-APK asset alignment checks. It still needs a fresh Quest
auto-series and the real manual headset/controller/hand pass after the updated
preview is published.

Bounded logcat for the final regression run had zero matches for
`FATAL EXCEPTION`, `AndroidRuntime`, `ANR in`,
`LaunchCheckControllerRequired`, `RequiresControllersLaunchInterceptor`, or
`technical_failure`.

## Manual Gate

The automated Quest runs verify rendering, audio timing, lookup allocation,
local app-private storage, ADB retrieval, and expected-vs-observed data. Before
calling the panel system experiment-ready, do one human headset pass with
auto-run disabled. First run the read-only readiness check:

```powershell
cd C:\Users\gfeje\Documents\GitHub\georgefejer.com\Research\study-6\native-quest-questionnaire
$node = "C:\Users\gfeje\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$env:STUDY6_MANUAL_PARTICIPANT_ID = "P005"
& $node tools\verify-manual-readiness.mjs
Remove-Item Env:\STUDY6_MANUAL_PARTICIPANT_ID
```

This checks the connected Quest, installed package, packaged questionnaire
assets, manual-audit bridge, app-private allocation file, and expected next
participant without launching or mutating the app.

Then run the supervised watcher:

```powershell
cd C:\Users\gfeje\Documents\GitHub\georgefejer.com\Research\study-6\native-quest-questionnaire
$node = "C:\Users\gfeje\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$env:STUDY6_MANUAL_PARTICIPANT_ID = "P005"
& $node tools\run-manual-validation-watch.mjs
Remove-Item Env:\STUDY6_MANUAL_PARTICIPANT_ID
```

The watcher installs the current debug APK without clearing app data, launches
`Study6SpatialActivity` without auto-run, polls app-private files through
`run-as`, captures screenshot/logcat/private data when the participant is
complete, and runs `verify-manual-run.mjs`.

During the manual pass, press the in-panel `Start next session` button on each
`session_ready` screen before the audio block starts. The manual verifier now
requires trusted interaction evidence on this page for every block.

For a manual launch without the watcher:

```powershell
& $adb -s 3487C10J0P01ZY shell am start -n com.georgefejer.study6.quest/.Study6SpatialActivity --es study6_apk_variant_id BG_ENV
```

During that pass, use real controller or hand input to cover:

- try `Continue` while demographics are incomplete and while one assessment
  page is incomplete, so required-state blocking is logged;
- switch/select language, enter first and last name with the native Quest
  keyboard, enter age, select handedness and gender, and confirm consent;
- use `Back` and `Continue`;
- complete SAM, affect VAS, emotion-representation VAS, and hand-embodiment
  controls for all four blocks after each 20-second dev audio interval.

Pull the private folder and run the manual verifier:

```powershell
& $adb -s 3487C10J0P01ZY exec-out run-as com.georgefejer.study6.quest tar -C files/study6-dev -cf - . > study6-dev-manual.tar
tar -xf study6-dev-manual.tar -C pulled-study6-dev-manual
$env:STUDY6_MANUAL_PARTICIPANT_ID = "P005"
node tools\verify-manual-run.mjs pulled-study6-dev-manual
Remove-Item Env:\STUDY6_MANUAL_PARTICIPANT_ID
```

`verify-manual-run.mjs` requires complete demographics, all four block result
files, all long CSV rows, audio/block events, and trusted manual interactions
for demographics, navigation, required-state blocking, SAM, VAS sliders, emotion
VAS sliders, and hand-embodiment controls.

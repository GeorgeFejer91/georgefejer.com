#!/usr/bin/env node
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..");
const STUDY_DIR = path.resolve(WORKSPACE_DIR, "..");
const LOOKUP_PATH = path.join(STUDY_DIR, "for-ai", "study6_apk_permutation_lookup.json");

const PACKAGE_NAME = "com.georgefejer.study6.quest";
const ACTIVITY = `${PACKAGE_NAME}/.Study6SpatialActivity`;
const DEFAULT_ADB = path.join(WORKSPACE_DIR, "android-sdk", "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
const DEFAULT_APK = path.join(WORKSPACE_DIR, "quest-app", "build", "outputs", "apk", "debug", "quest-app-debug.apk");
const RUNTIME_PERMISSIONS = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.BLUETOOTH_CONNECT"
];

const APK_VARIANT_ID = process.env.STUDY6_APK_VARIANT_ID || "BG_ENV";
const PROFILES = (process.env.STUDY6_AUTO_PROFILES || "linear,low,high,zigzag")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const POLL_SECONDS = Number(process.env.STUDY6_AUTO_POLL_SECONDS || 5);
const PARTICIPANT_TIMEOUT_SECONDS = Number(process.env.STUDY6_AUTO_PARTICIPANT_TIMEOUT_SECONDS || 180);
const INSTALL_APK = process.env.STUDY6_INSTALL_APK !== "0";
const CLEAR_APP_DATA = process.env.STUDY6_CLEAR_APP_DATA === "1";
const ARCHIVE_BEFORE_CLEAR = process.env.STUDY6_ARCHIVE_BEFORE_CLEAR !== "0";

function usage() {
  console.log(`Usage: node tools/run-device-auto-series.mjs

Environment:
  STUDY6_ADB                         adb path, default native workspace SDK
  STUDY6_DEVICE_SERIAL               Quest serial; default first connected device
  STUDY6_APK                         debug APK path
  STUDY6_APK_VARIANT_ID              default BG_ENV
  STUDY6_AUTO_PROFILES               comma list, default linear,low,high,zigzag
  STUDY6_INSTALL_APK                 1 to install before launch, default 1
  STUDY6_CLEAR_APP_DATA              1 to clear package data before series, default 0
  STUDY6_ARCHIVE_BEFORE_CLEAR        1 to pull current data before clear, default 1
  STUDY6_EVIDENCE_DIR                evidence output directory

The harness launches the Spatial APK in auto-run mode once per profile, waits
until each participant is complete in allocation_state.json, pulls app-private
files/study6-dev via adb exec-out run-as tar, and verifies the pulled data with
verify-device-series.mjs. It also pulls the external Study6DataExport folder
and verifies analysis_ready with verify-analysis-ready.mjs.`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  usage();
  process.exit(0);
}

function run(file, args, options = {}) {
  const result = childProcess.spawnSync(file, args, {
    cwd: options.cwd || STUDY_DIR,
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer || 128 * 1024 * 1024,
    timeout: options.timeout || 0,
    env: { ...process.env, ...(options.env || {}) }
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${file} ${args.join(" ")} failed with ${result.status}\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
  return result;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeText(dir, name, text) {
  fs.writeFileSync(path.join(dir, name), `${String(text || "").replace(/\s+$/, "")}\n`, "utf8");
}

function writeJson(dir, name, value) {
  fs.writeFileSync(path.join(dir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileSha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function sleep(ms) {
  childProcess.spawnSync(process.execPath, ["-e", `setTimeout(()=>{}, ${ms})`], { timeout: ms + 2000 });
}

function firstConnectedDevice(adbPath) {
  const result = run(adbPath, ["devices", "-l"]);
  const line = result.stdout.split(/\r?\n/).find((row) => /\bdevice\b/.test(row) && !row.startsWith("List of"));
  return line ? line.trim().split(/\s+/)[0] : "";
}

function nextEvidenceDir() {
  const base = path.join(WORKSPACE_DIR, "build", "device-validation");
  mkdirp(base);
  for (let index = 1; index < 1000; index += 1) {
    const dir = path.join(base, `quest3s-spatial-auto-series-${String(index).padStart(3, "0")}`);
    if (!fs.existsSync(dir)) {
      return dir;
    }
  }
  throw new Error("Unable to allocate evidence directory");
}

function byId(items, field, id) {
  const found = items.find((item) => item[field] === id);
  if (!found) {
    throw new Error(`Missing ${field}=${id}`);
  }
  return found;
}

const LOOKUP = readJson(LOOKUP_PATH);
const APK = byId(LOOKUP.apk_variants, "apk_variant_id", APK_VARIANT_ID);
const DATA_FOLDER = APK.data_folder;
const ADB = process.env.STUDY6_ADB || DEFAULT_ADB;
const SERIAL = process.env.STUDY6_DEVICE_SERIAL || firstConnectedDevice(ADB);
const APK_PATH = process.env.STUDY6_APK || DEFAULT_APK;
const EVIDENCE_DIR = process.env.STUDY6_EVIDENCE_DIR || nextEvidenceDir();

if (!SERIAL) {
  throw new Error("No connected Quest device found. Set STUDY6_DEVICE_SERIAL.");
}
if (!fs.existsSync(APK_PATH)) {
  throw new Error(`APK missing: ${APK_PATH}`);
}

function adb(args, options = {}) {
  return run(ADB, ["-s", SERIAL, ...args], options);
}

function adbText(args, options = {}) {
  return adb(args, options).stdout.trim();
}

function safeAdbText(args, options = {}) {
  const result = adb(args, { ...options, allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : "";
}

function readAllocationState() {
  const text = safeAdbText(["shell", "run-as", PACKAGE_NAME, "cat", `files/study6-dev/${DATA_FOLDER}/allocation_state.json`]);
  if (!text) {
    return null;
  }
  return JSON.parse(text);
}

function grantRuntimePermissions() {
  const lines = [];
  for (const permission of RUNTIME_PERMISSIONS) {
    const result = adb(["shell", "pm", "grant", PACKAGE_NAME, permission], { allowFailure: true });
    lines.push(`${permission}: exit=${result.status} ${String(result.stdout || result.stderr || "").trim()}`);
  }
  writeText(EVIDENCE_DIR, "runtime-permission-grants.txt", lines.join("\n"));
}

function nextOpenParticipantFromLookup(completed = []) {
  const completedSet = new Set(completed);
  const row = LOOKUP.participant_allocation.find((candidate) => !completedSet.has(candidate.participant_id));
  return row ? row.participant_id : null;
}

function inferNextParticipant() {
  const state = readAllocationState();
  if (state && state.active_participant_id) {
    return state.active_participant_id;
  }
  if (state && state.next_participant_id) {
    return state.next_participant_id;
  }
  return nextOpenParticipantFromLookup(state ? state.completed_participant_ids || [] : []);
}

function pullPrivateData(label) {
  const tarPath = path.join(EVIDENCE_DIR, `${label}.tar`);
  const tar = adb(["exec-out", "run-as", PACKAGE_NAME, "tar", "-C", "files/study6-dev", "-cf", "-", "."], {
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024
  }).stdout;
  fs.writeFileSync(tarPath, tar);
  const pullDir = path.join(EVIDENCE_DIR, label);
  mkdirp(pullDir);
  run("tar", ["-xf", tarPath, "-C", pullDir]);
  return pullDir;
}

function pullStudy6DataExport(label) {
  const pullDir = path.join(EVIDENCE_DIR, label);
  fs.rmSync(pullDir, { recursive: true, force: true });
  mkdirp(pullDir);
  const deviceRoot = `/sdcard/Android/data/${PACKAGE_NAME}/files/Study6DataExport`;
  const pull = adb(["pull", deviceRoot, pullDir], {
    allowFailure: true,
    timeout: 120000,
    maxBuffer: 128 * 1024 * 1024
  });
  writeText(EVIDENCE_DIR, `${label}-adb-pull.txt`, `${pull.stdout || ""}${pull.stderr || ""}`);
  if (pull.status === 0) {
    return pullDir;
  }

  const tarPath = path.join(EVIDENCE_DIR, `${label}.tar`);
  const tar = adb(["exec-out", "tar", "-C", deviceRoot, "-cf", "-", "."], {
    allowFailure: true,
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024
  });
  if (tar.status !== 0) {
    const stderr = Buffer.isBuffer(tar.stderr) ? tar.stderr.toString("utf8") : String(tar.stderr || "");
    throw new Error(`Unable to pull ${deviceRoot}\n${stderr}`);
  }
  fs.writeFileSync(tarPath, tar.stdout);
  const exportRoot = path.join(pullDir, "Study6DataExport");
  mkdirp(exportRoot);
  run("tar", ["-xf", tarPath, "-C", exportRoot]);
  return pullDir;
}

function waitForParticipantComplete(participantId, runDir) {
  const started = Date.now();
  let lastLine = "";
  while (Date.now() - started < PARTICIPANT_TIMEOUT_SECONDS * 1000) {
    sleep(POLL_SECONDS * 1000);
    const state = readAllocationState();
    const completed = Boolean(state && (state.completed_participant_ids || []).includes(participantId) && state.active_participant_id === null);
    const line = `${new Date().toISOString()} participant=${participantId} completed=${completed} next=${state ? state.next_participant_id : "missing"} active=${state ? state.active_participant_id : "missing"}`;
    fs.appendFileSync(path.join(runDir, "poll.log"), `${line}\n`, "utf8");
    if (line !== lastLine) {
      console.log(line);
      lastLine = line;
    }
    if (completed) {
      return state;
    }
  }
  throw new Error(`Timed out waiting for ${participantId} after ${PARTICIPANT_TIMEOUT_SECONDS}s`);
}

mkdirp(EVIDENCE_DIR);
writeText(EVIDENCE_DIR, "adb-version.txt", run(ADB, ["version"]).stdout);
writeText(EVIDENCE_DIR, "device-model.txt", adbText(["shell", "getprop", "ro.product.model"]));
writeText(EVIDENCE_DIR, "android-version.txt", adbText(["shell", "getprop", "ro.build.version.release"]));
writeText(EVIDENCE_DIR, "wm-size.txt", adbText(["shell", "wm", "size"]));
writeText(EVIDENCE_DIR, "wm-density.txt", adbText(["shell", "wm", "density"]));
writeText(EVIDENCE_DIR, "apk-sha256.txt", `${fileSha256(APK_PATH)}  ${APK_PATH}`);
writeJson(EVIDENCE_DIR, "series-request.json", {
  serial: SERIAL,
  package_name: PACKAGE_NAME,
  activity: ACTIVITY,
  apk_variant_id: APK_VARIANT_ID,
  data_folder: DATA_FOLDER,
  profiles: PROFILES,
  install_apk: INSTALL_APK,
  clear_app_data: CLEAR_APP_DATA,
  archive_before_clear: ARCHIVE_BEFORE_CLEAR,
  participant_timeout_seconds: PARTICIPANT_TIMEOUT_SECONDS
});

adb(["shell", "am", "force-stop", PACKAGE_NAME], { allowFailure: true });
if (INSTALL_APK) {
  writeText(EVIDENCE_DIR, "install.txt", adbText(["install", "-r", "-d", "-g", APK_PATH], { timeout: 120000 }));
}

if (CLEAR_APP_DATA && ARCHIVE_BEFORE_CLEAR) {
  const archiveProbe = safeAdbText(["shell", "run-as", PACKAGE_NAME, "ls", "files/study6-dev"], { maxBuffer: 1024 * 1024 });
  if (archiveProbe) {
    try {
      pullPrivateData("pre-clear-study6-dev");
    } catch (error) {
      writeText(EVIDENCE_DIR, "pre-clear-pull-error.txt", error && error.stack ? error.stack : String(error));
    }
  }
}

if (CLEAR_APP_DATA) {
  writeText(EVIDENCE_DIR, "pm-clear.txt", adbText(["shell", "pm", "clear", PACKAGE_NAME]));
}
grantRuntimePermissions();

adb(["shell", "input", "keyevent", "KEYCODE_WAKEUP"], { allowFailure: true });
adb(["logcat", "-c"], { allowFailure: true });

const participantProfiles = [];
for (let index = 0; index < PROFILES.length; index += 1) {
  const profile = PROFILES[index];
  const participantId = inferNextParticipant();
  if (!participantId) {
    throw new Error("No open participant available for auto-run series");
  }
  const runDir = path.join(EVIDENCE_DIR, `run-${String(index + 1).padStart(2, "0")}-${participantId}-${profile}`);
  mkdirp(runDir);

  console.log(`Launching ${participantId} with profile ${profile}`);
  adb(["shell", "am", "force-stop", PACKAGE_NAME], { allowFailure: true });
  adb(["logcat", "-c"], { allowFailure: true });
  const launchArgs = [
    "shell", "am", "start", "-n", ACTIVITY,
    "--ez", "study6_auto_run", "true",
    "--es", "study6_apk_variant_id", APK_VARIANT_ID,
    "--es", "study6_participant_id", participantId,
    "--es", "study6_auto_run_profile", profile
  ];
  writeText(runDir, "launch.txt", adbText(launchArgs));
  const completedState = waitForParticipantComplete(participantId, runDir);
  writeJson(runDir, "allocation-state-after-run.json", completedState);
  writeText(runDir, "logcat.txt", adbText(["logcat", "-d", "-v", "threadtime"], { maxBuffer: 128 * 1024 * 1024 }));
  try {
    fs.writeFileSync(path.join(runDir, "screenshot-after-run.png"), adb(["exec-out", "screencap", "-p"], {
      encoding: "buffer",
      maxBuffer: 32 * 1024 * 1024
    }).stdout);
  } catch (error) {
    writeText(runDir, "screenshot-error.txt", error && error.message ? error.message : String(error));
  }
  participantProfiles.push({ participant_id: participantId, profile });
}

const pulledDir = pullPrivateData("pulled-study6-dev");
const pulledExportDir = pullStudy6DataExport("pulled-Study6DataExport");
const expectedParticipants = participantProfiles.map((row) => row.participant_id).join(",");
const expectedProfiles = participantProfiles.map((row) => `${row.participant_id}:${row.profile}`).join(",");
const reportPath = path.join(pulledDir, "device-series-expected-vs-observed.json");
const verify = run(process.execPath, [path.join(WORKSPACE_DIR, "tools", "verify-device-series.mjs"), pulledDir], {
  allowFailure: true,
  env: {
    STUDY6_APK_VARIANT_ID: APK_VARIANT_ID,
    STUDY6_EXPECTED_PARTICIPANTS: expectedParticipants,
    STUDY6_EXPECTED_PROFILES: expectedProfiles,
    STUDY6_REPORT_PATH: reportPath
  },
  maxBuffer: 128 * 1024 * 1024
});
writeText(EVIDENCE_DIR, "verify-device-series.txt", `${verify.stdout || ""}${verify.stderr || ""}`);

const analysisReportPath = path.join(pulledExportDir, "analysis-ready-expected-vs-observed.json");
const analysisVerify = run(process.execPath, [path.join(WORKSPACE_DIR, "tools", "verify-analysis-ready.mjs"), pulledExportDir], {
  allowFailure: true,
  env: {
    STUDY6_APK_VARIANT_ID: APK_VARIANT_ID,
    STUDY6_EXPECTED_PARTICIPANTS: expectedParticipants,
    STUDY6_ANALYSIS_REPORT_PATH: analysisReportPath
  },
  maxBuffer: 128 * 1024 * 1024
});
writeText(EVIDENCE_DIR, "verify-analysis-ready.txt", `${analysisVerify.stdout || ""}${analysisVerify.stderr || ""}`);

const summary = {
  pass: verify.status === 0 && analysisVerify.status === 0,
  serial: SERIAL,
  apk_sha256: fileSha256(APK_PATH),
  apk_variant_id: APK_VARIANT_ID,
  participant_profiles: participantProfiles,
  expected_participants: expectedParticipants,
  expected_profiles: expectedProfiles,
  evidence_dir: EVIDENCE_DIR,
  pulled_dir: pulledDir,
  pulled_export_dir: pulledExportDir,
  report_path: reportPath,
  analysis_report_path: analysisReportPath,
  verifier_exit_code: verify.status,
  analysis_verifier_exit_code: analysisVerify.status
};
writeJson(EVIDENCE_DIR, "auto-series-summary.json", summary);

if (verify.status !== 0 || analysisVerify.status !== 0) {
  console.error(`${verify.stdout || ""}${verify.stderr || ""}`);
  console.error(`${analysisVerify.stdout || ""}${analysisVerify.stderr || ""}`);
  process.exit(verify.status || analysisVerify.status || 1);
}

console.log(verify.stdout.trim());
console.log(analysisVerify.stdout.trim());
console.log(`Auto-series evidence complete: ${EVIDENCE_DIR}`);

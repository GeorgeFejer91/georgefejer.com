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
const APK_VARIANT_ID = process.env.STUDY6_APK_VARIANT_ID || "BG_ENV";
const TIMEOUT_SECONDS = Number(process.env.STUDY6_MANUAL_TIMEOUT_SECONDS || 1800);
const POLL_SECONDS = Number(process.env.STUDY6_MANUAL_POLL_SECONDS || 10);

function usage() {
  console.log(`Usage: node tools/run-manual-validation-watch.mjs [--dry-run]

Environment:
  STUDY6_ADB                         adb path, default native workspace SDK
  STUDY6_DEVICE_SERIAL               Quest serial; default first connected device
  STUDY6_APK                         debug APK path
  STUDY6_APK_VARIANT_ID              default BG_ENV
  STUDY6_MANUAL_PARTICIPANT_ID       optional expected participant, e.g. P008
  STUDY6_MANUAL_TIMEOUT_SECONDS      default 1800
  STUDY6_INSTALL_APK                 1 to install before launch, default 1
  STUDY6_CLEAR_APP_DATA              1 to clear package data before launch, default 0
  STUDY6_EVIDENCE_DIR                evidence output directory

The watcher launches the APK without auto-run, waits for the participant to be
completed by real headset interaction, pulls app-private data with run-as/tar,
and runs verify-manual-run.mjs against the pulled files.`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  usage();
  process.exit(0);
}

const DRY_RUN = process.argv.includes("--dry-run") || process.env.STUDY6_DRY_RUN === "1";

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

function adb(args, options = {}) {
  const serialArgs = SERIAL ? ["-s", SERIAL] : [];
  return run(ADB, [...serialArgs, ...args], options);
}

function adbText(args, options = {}) {
  return adb(args, options).stdout.trim();
}

function safeAdbText(args) {
  const result = adb(args, { allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : "";
}

function sleep(ms) {
  childProcess.spawnSync(process.execPath, ["-e", `setTimeout(()=>{}, ${ms})`], { timeout: ms + 2000 });
}

function readJson(text) {
  return JSON.parse(text);
}

function fileSha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function nextEvidenceDir() {
  const base = path.join(WORKSPACE_DIR, "build", "device-validation");
  mkdirp(base);
  for (let index = 1; index < 1000; index += 1) {
    const dir = path.join(base, `quest3s-spatial-manual-watch-${String(index).padStart(3, "0")}`);
    if (!fs.existsSync(dir)) {
      return dir;
    }
  }
  throw new Error("Unable to allocate evidence directory");
}

function firstConnectedDevice(adbPath) {
  const result = run(adbPath, ["devices", "-l"]);
  const line = result.stdout.split(/\r?\n/).find((row) => /\bdevice\b/.test(row) && !row.startsWith("List of"));
  return line ? line.trim().split(/\s+/)[0] : "";
}

function allocationState() {
  const text = safeAdbText(["shell", "run-as", PACKAGE_NAME, "cat", `files/study6-dev/${DATA_FOLDER}/allocation_state.json`]);
  if (!text) {
    return null;
  }
  try {
    return readJson(text);
  } catch {
    return null;
  }
}

function manualEventSummary() {
  const text = safeAdbText(["shell", "run-as", PACKAGE_NAME, "cat", `files/study6-dev/${DATA_FOLDER}/data/manual_interactions.jsonl`]);
  if (!text) {
    return { trusted_event_count: 0, groups: [], pages: [], blocked_attempts: 0 };
  }
  const groups = new Set();
  const pages = new Set();
  let trusted = 0;
  let blocked = 0;
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      if (event.participant_id !== EXPECTED_PARTICIPANT_ID) {
        continue;
      }
      const detail = event.detail || {};
      if (detail.is_trusted !== true) {
        continue;
      }
      trusted += 1;
      if (event.event_type === "manual_next_blocked_attempt") {
        blocked += 1;
      }
      if (detail.active_panel_page_id) {
        pages.add(detail.active_panel_page_id);
      }
      if (detail.target && detail.target.control_group) {
        groups.add(detail.target.control_group);
      }
    } catch {
      // Ignore partial lines while the app is appending.
    }
  }
  return { trusted_event_count: trusted, groups: [...groups].sort(), pages: [...pages].sort(), blocked_attempts: blocked };
}

function inferParticipantFromState() {
  const state = allocationState();
  if (state && state.next_participant_id) {
    return state.next_participant_id;
  }
  if (state && state.active_participant_id) {
    return state.active_participant_id;
  }
  const completed = new Set((state && state.completed_participant_ids) || []);
  const firstOpen = LOOKUP.participant_allocation.find((row) => !completed.has(row.participant_id));
  return firstOpen ? firstOpen.participant_id : LOOKUP.participant_allocation[0].participant_id;
}

function writeText(name, text) {
  fs.writeFileSync(path.join(EVIDENCE_DIR, name), `${text.replace(/\s+$/, "")}\n`, "utf8");
}

function writeBinary(name, buffer) {
  fs.writeFileSync(path.join(EVIDENCE_DIR, name), buffer);
}

function pullPrivateData() {
  const tarPath = path.join(EVIDENCE_DIR, "study6-dev-manual.tar");
  const tar = adb(["exec-out", "run-as", PACKAGE_NAME, "tar", "-C", "files/study6-dev", "-cf", "-", "."], {
    encoding: "buffer",
    maxBuffer: 256 * 1024 * 1024
  }).stdout;
  fs.writeFileSync(tarPath, tar);
  const pullDir = path.join(EVIDENCE_DIR, "pulled-study6-dev-manual");
  mkdirp(pullDir);
  run("tar", ["-xf", tarPath, "-C", pullDir]);
  return pullDir;
}

const LOOKUP = readJson(fs.readFileSync(LOOKUP_PATH, "utf8"));
const APK = LOOKUP.apk_variants.find((row) => row.apk_variant_id === APK_VARIANT_ID);
if (!APK) {
  throw new Error(`Missing APK variant ${APK_VARIANT_ID}`);
}
const DATA_FOLDER = APK.data_folder;
const ADB = process.env.STUDY6_ADB || DEFAULT_ADB;
const SERIAL = process.env.STUDY6_DEVICE_SERIAL || firstConnectedDevice(ADB);
const APK_PATH = process.env.STUDY6_APK || DEFAULT_APK;
const EVIDENCE_DIR = process.env.STUDY6_EVIDENCE_DIR || nextEvidenceDir();
const INSTALL_APK = process.env.STUDY6_INSTALL_APK !== "0";
const CLEAR_APP_DATA = process.env.STUDY6_CLEAR_APP_DATA === "1";

if (!SERIAL) {
  throw new Error("No connected Quest device found. Set STUDY6_DEVICE_SERIAL.");
}

mkdirp(EVIDENCE_DIR);

let EXPECTED_PARTICIPANT_ID = process.env.STUDY6_MANUAL_PARTICIPANT_ID || "";
if (DRY_RUN) {
  console.log(JSON.stringify({
    dry_run: true,
    adb: ADB,
    serial: SERIAL,
    apk: APK_PATH,
    apk_variant_id: APK_VARIANT_ID,
    package_name: PACKAGE_NAME,
    activity: ACTIVITY,
    evidence_dir: EVIDENCE_DIR,
    install_apk: INSTALL_APK,
    clear_app_data: CLEAR_APP_DATA,
    timeout_seconds: TIMEOUT_SECONDS
  }, null, 2));
  process.exit(0);
}

writeText("adb-version.txt", run(ADB, ["version"]).stdout);
writeText("device-model.txt", adbText(["shell", "getprop", "ro.product.model"]));
writeText("android-version.txt", adbText(["shell", "getprop", "ro.build.version.release"]));
writeText("wm-size.txt", adbText(["shell", "wm", "size"]));
writeText("wm-density.txt", adbText(["shell", "wm", "density"]));
writeText("apk-sha256.txt", `${fileSha256(APK_PATH)}  ${APK_PATH}`);

adb(["shell", "am", "force-stop", PACKAGE_NAME], { allowFailure: true });
if (INSTALL_APK) {
  writeText("install.txt", adbText(["install", "-r", "-d", "-g", APK_PATH], { timeout: 120000 }));
}
if (CLEAR_APP_DATA) {
  writeText("pm-clear.txt", adbText(["shell", "pm", "clear", PACKAGE_NAME]));
}

EXPECTED_PARTICIPANT_ID = EXPECTED_PARTICIPANT_ID || inferParticipantFromState();
writeText("expected-participant.txt", EXPECTED_PARTICIPANT_ID);
adb(["logcat", "-c"], { allowFailure: true });

const launchArgs = ["shell", "am", "start", "-n", ACTIVITY, "--es", "study6_apk_variant_id", APK_VARIANT_ID];
if (process.env.STUDY6_MANUAL_PARTICIPANT_ID) {
  launchArgs.push("--es", "study6_participant_id", EXPECTED_PARTICIPANT_ID);
}
writeText("launch-manual.txt", adbText(launchArgs));

console.log(`Manual validation launched for ${EXPECTED_PARTICIPANT_ID}.`);
console.log("Operate the headset with real controller/hand input. The watcher will pull and verify when allocation_state marks the participant complete.");
console.log(`Evidence: ${EVIDENCE_DIR}`);

const started = Date.now();
let completed = false;
let lastPrinted = "";
while (Date.now() - started < TIMEOUT_SECONDS * 1000) {
  sleep(POLL_SECONDS * 1000);
  const state = allocationState();
  const summary = manualEventSummary();
  const completedIds = (state && state.completed_participant_ids) || [];
  completed = completedIds.includes(EXPECTED_PARTICIPANT_ID) && state && state.active_participant_id === null;
  const line = `${new Date().toISOString()} completed=${completed} trusted=${summary.trusted_event_count} blocked=${summary.blocked_attempts} groups=${summary.groups.join("|")} pages=${summary.pages.join("|")}`;
  fs.appendFileSync(path.join(EVIDENCE_DIR, "watch-progress.log"), `${line}\n`, "utf8");
  if (line !== lastPrinted) {
    console.log(line);
    lastPrinted = line;
  }
  if (completed) {
    break;
  }
}

writeText("focus-after-manual.txt", safeAdbText(["shell", "dumpsys", "window"]));
try {
  writeBinary("screenshot-after-manual.png", adb(["exec-out", "screencap", "-p"], { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 }).stdout);
} catch (error) {
  writeText("screenshot-error.txt", String(error && error.message ? error.message : error));
}

writeText("logcat.txt", adbText(["logcat", "-d", "-v", "threadtime"], { maxBuffer: 128 * 1024 * 1024 }));
const pulledDir = pullPrivateData();

const verifierEnv = {
  STUDY6_MANUAL_PARTICIPANT_ID: EXPECTED_PARTICIPANT_ID,
  STUDY6_REPORT_PATH: path.join(pulledDir, "manual-run-expected-vs-observed.json")
};
const verify = run(process.execPath, [path.join(WORKSPACE_DIR, "tools", "verify-manual-run.mjs"), pulledDir], {
  allowFailure: true,
  env: verifierEnv,
  maxBuffer: 64 * 1024 * 1024
});
writeText("verify-manual-run.txt", `${verify.stdout || ""}${verify.stderr || ""}`);

const summary = {
  pass: verify.status === 0,
  completed,
  participant_id: EXPECTED_PARTICIPANT_ID,
  evidence_dir: EVIDENCE_DIR,
  pulled_dir: pulledDir,
  verifier_exit_code: verify.status
};
fs.writeFileSync(path.join(EVIDENCE_DIR, "manual-watch-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

if (verify.status !== 0) {
  console.error(`${verify.stdout || ""}${verify.stderr || ""}`);
  process.exit(verify.status || 1);
}

console.log(verify.stdout.trim());
console.log(`Manual validation evidence complete: ${EVIDENCE_DIR}`);

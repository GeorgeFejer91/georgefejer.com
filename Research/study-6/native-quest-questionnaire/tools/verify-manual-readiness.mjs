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
const DEFAULT_ADB = path.join(WORKSPACE_DIR, "android-sdk", "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
const DEFAULT_APK = path.join(WORKSPACE_DIR, "quest-app", "build", "outputs", "apk", "debug", "quest-app-debug.apk");
const APK_VARIANT_ID = process.env.STUDY6_APK_VARIANT_ID || "BG_ENV";
const EXPECTED_PARTICIPANT_ID = process.env.STUDY6_MANUAL_PARTICIPANT_ID || "";

function run(file, args, options = {}) {
  const result = childProcess.spawnSync(file, args, {
    cwd: options.cwd || STUDY_DIR,
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
    timeout: options.timeout || 0
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function failIfBad(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label} failed with ${result.status}\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
  return result;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function firstConnectedDevice(adbPath) {
  const result = failIfBad(run(adbPath, ["devices", "-l"]), "adb devices");
  const line = result.stdout.split(/\r?\n/).find((row) => /\bdevice\b/.test(row) && !row.startsWith("List of"));
  return line ? line.trim().split(/\s+/)[0] : "";
}

function adb(args, options = {}) {
  const serialArgs = SERIAL ? ["-s", SERIAL] : [];
  return run(ADB, [...serialArgs, ...args], options);
}

function adbOkText(args) {
  const result = adb(args);
  return result.status === 0 ? result.stdout.trim() : "";
}

function byId(items, field, id) {
  const found = items.find((item) => item[field] === id);
  if (!found) {
    throw new Error(`Missing ${field}=${id}`);
  }
  return found;
}

function nextOpenParticipant(lookup, completed) {
  const completedSet = new Set(completed || []);
  const open = lookup.participant_allocation.find((row) => !completedSet.has(row.participant_id));
  return open ? open.participant_id : null;
}

function apkEntries(apkPath) {
  const result = failIfBad(run("tar", ["-tf", apkPath]), "APK listing");
  return new Set(result.stdout.split(/\r?\n/).filter(Boolean));
}

function packageInstalledVersion() {
  const text = adbOkText(["shell", "dumpsys", "package", PACKAGE_NAME]);
  const versionName = (text.match(/versionName=([^\s]+)/) || [])[1] || "";
  const versionCode = (text.match(/versionCode=(\d+)/) || [])[1] || "";
  return { installed: text.includes(`Package [${PACKAGE_NAME}]`), version_name: versionName, version_code: versionCode };
}

const LOOKUP = readJson(LOOKUP_PATH);
const APK_VARIANT = byId(LOOKUP.apk_variants, "apk_variant_id", APK_VARIANT_ID);
const DATA_FOLDER = APK_VARIANT.data_folder;
const ADB = process.env.STUDY6_ADB || DEFAULT_ADB;
const APK_PATH = process.env.STUDY6_APK || DEFAULT_APK;
const SERIAL = process.env.STUDY6_DEVICE_SERIAL || firstConnectedDevice(ADB);
const failures = [];

if (!fs.existsSync(APK_PATH)) {
  failures.push(`APK missing: ${APK_PATH}`);
}
if (!SERIAL) {
  failures.push("No connected Quest device found");
}

const entries = fs.existsSync(APK_PATH) ? apkEntries(APK_PATH) : new Set();
const requiredAssets = [
  "assets/study6-quest-authority.js",
  "assets/study6-quest-auto-run.js",
  "assets/study6-quest-manual-audit.js",
  "assets/questionnaire-ui-preview/index.html",
  "assets/questionnaire-ui-preview/styles.css",
  "assets/questionnaire-ui-preview/questionnaire-item-library.js",
  "assets/questionnaire-ui-preview/panel-preview.js",
  "assets/for-ai/study6_apk_permutation_lookup.json"
];
for (const asset of requiredAssets) {
  if (!entries.has(asset)) {
    failures.push(`APK missing asset ${asset}`);
  }
}

let device = {};
let allocationState = null;
let packageInfo = {};
if (SERIAL) {
  device = {
    serial: SERIAL,
    model: adbOkText(["shell", "getprop", "ro.product.model"]),
    android_version: adbOkText(["shell", "getprop", "ro.build.version.release"]),
    wm_size: adbOkText(["shell", "wm", "size"]),
    wm_density: adbOkText(["shell", "wm", "density"])
  };
  packageInfo = packageInstalledVersion();
  if (!packageInfo.installed) {
    failures.push(`${PACKAGE_NAME} is not installed on ${SERIAL}`);
  }
  const stateText = adbOkText(["shell", "run-as", PACKAGE_NAME, "cat", `files/study6-dev/${DATA_FOLDER}/allocation_state.json`]);
  if (stateText) {
    try {
      allocationState = JSON.parse(stateText);
    } catch {
      failures.push("allocation_state.json is unreadable JSON");
    }
  } else {
    failures.push(`Cannot read app-private allocation_state.json for ${DATA_FOLDER}`);
  }
}

let expectedNext = null;
if (allocationState) {
  expectedNext = nextOpenParticipant(LOOKUP, allocationState.completed_participant_ids || []);
  if (allocationState.active_participant_id !== null) {
    failures.push(`active_participant_id should be null before manual pass, observed ${allocationState.active_participant_id}`);
  }
  if (allocationState.next_participant_id !== expectedNext) {
    failures.push(`next_participant_id expected ${expectedNext} observed ${allocationState.next_participant_id}`);
  }
  if (EXPECTED_PARTICIPANT_ID && allocationState.next_participant_id !== EXPECTED_PARTICIPANT_ID) {
    failures.push(`manual participant expected ${EXPECTED_PARTICIPANT_ID} observed next ${allocationState.next_participant_id}`);
  }
}

const report = {
  pass: failures.length === 0,
  failures,
  apk_variant_id: APK_VARIANT_ID,
  package_name: PACKAGE_NAME,
  apk_path: APK_PATH,
  apk_sha256: fs.existsSync(APK_PATH) ? sha256(APK_PATH) : null,
  required_assets_present: requiredAssets.filter((asset) => entries.has(asset)),
  device,
  package_info: packageInfo,
  data_folder: DATA_FOLDER,
  expected_next_participant_id: expectedNext,
  requested_manual_participant_id: EXPECTED_PARTICIPANT_ID || null,
  allocation_state: allocationState
};

const reportPath = process.env.STUDY6_REPORT_PATH || path.join(WORKSPACE_DIR, "build", "manual-readiness-report.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (!report.pass) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(`Study 6 manual readiness passed: ${expectedNext || "no-open-participant"} on ${device.model || SERIAL}.`);
console.log(reportPath);

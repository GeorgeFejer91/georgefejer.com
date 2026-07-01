#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const WORKSPACE_DIR = path.resolve(SCRIPT_DIR, "..");
const APK_PATH = process.env.STUDY6_APK || path.join(WORKSPACE_DIR, "quest-app", "build", "outputs", "apk", "debug", "quest-app-debug.apk");
const BUILD_DIR = path.join(WORKSPACE_DIR, "build");

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function latestManualRunReport() {
  const validationDir = path.join(BUILD_DIR, "device-validation");
  if (!fs.existsSync(validationDir)) {
    return null;
  }
  const candidates = [];
  for (const entry of fs.readdirSync(validationDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const report = path.join(validationDir, entry.name, "pulled-study6-dev-manual", "manual-run-expected-vs-observed.json");
    const summary = path.join(validationDir, entry.name, "manual-watch-summary.json");
    if (fs.existsSync(report)) {
      candidates.push({ dir: path.join(validationDir, entry.name), report, summary, mtimeMs: fs.statSync(report).mtimeMs });
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] || null;
}

function latestDeviceSeriesReport() {
  const validationDir = path.join(BUILD_DIR, "device-validation");
  if (!fs.existsSync(validationDir)) {
    return null;
  }
  const candidates = [];
  for (const entry of fs.readdirSync(validationDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const reportPaths = [
      path.join(validationDir, entry.name, "pulled-study6-dev", "device-series-expected-vs-observed.json"),
      path.join(validationDir, entry.name, "pulled-study6-dev-manual", "device-series-expected-vs-observed.json")
    ];
    for (const report of reportPaths) {
      if (fs.existsSync(report)) {
        candidates.push({ dir: path.join(validationDir, entry.name), report, mtimeMs: fs.statSync(report).mtimeMs });
      }
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] || null;
}

function item(id, requirement, evidence, passed, notes = "") {
  return {
    id,
    requirement,
    evidence,
    status: passed ? "passed" : "missing_or_failed",
    notes
  };
}

const previewReportPath = path.join(BUILD_DIR, "preview-asset-alignment-report.json");
const questionnaireInstanceReportPath = path.join(BUILD_DIR, "questionnaire-instance-alignment-report.json");
const lookupReportPath = path.join(BUILD_DIR, "lookup-contract-report.json");
const hostReportPath = path.join(BUILD_DIR, "verification", "dev-run-BG_ENV-P001", "expected-vs-observed.json");
const readinessReportPath = path.join(BUILD_DIR, "manual-readiness-report.json");

const previewReport = readJsonIfExists(previewReportPath);
const questionnaireInstanceReport = readJsonIfExists(questionnaireInstanceReportPath);
const lookupReport = readJsonIfExists(lookupReportPath);
const hostReport = readJsonIfExists(hostReportPath);
const deviceCandidate = latestDeviceSeriesReport();
const deviceReportPath = deviceCandidate ? deviceCandidate.report : path.join(BUILD_DIR, "device-validation", "device-series-expected-vs-observed.json");
const deviceReport = readJsonIfExists(deviceReportPath);
const readinessReport = readJsonIfExists(readinessReportPath);
const manualCandidate = latestManualRunReport();
const manualReport = manualCandidate ? readJsonIfExists(manualCandidate.report) : null;
const manualSummary = manualCandidate && fs.existsSync(manualCandidate.summary) ? readJsonIfExists(manualCandidate.summary) : null;
const currentApkHash = fs.existsSync(APK_PATH) ? sha256(APK_PATH) : null;

const checks = [
  item(
    "preview_source_alignment",
    "APK participant-facing questionnaire assets match the deployed web preview source of truth.",
    previewReportPath,
    Boolean(previewReport && previewReport.pass === true),
    previewReport ? `${(previewReport.files || []).length} core assets checked` : "report missing"
  ),
  item(
    "questionnaire_instance_alignment",
    "All questionnaire instances in the repo derive item order, labels, fixtures, lookup metadata, and packaged assets from the deployed preview.",
    questionnaireInstanceReportPath,
    Boolean(questionnaireInstanceReport && questionnaireInstanceReport.pass === true && Array.isArray(questionnaireInstanceReport.canonical_questionnaire_items) && questionnaireInstanceReport.canonical_questionnaire_items.length === 13),
    questionnaireInstanceReport ? `${questionnaireInstanceReport.canonical_questionnaire_items.length} canonical response items checked` : "report missing"
  ),
  item(
    "authoritative_lookup_contract",
    "The real 24-permutation backend lookup is authoritative, valid, and packaged into the APK unchanged.",
    lookupReportPath,
    Boolean(lookupReport && lookupReport.pass === true && lookupReport.condition_permutation_count === 24 && lookupReport.audio_permutation_count === 24 && lookupReport.apk_packaged_lookup_sha256 === lookupReport.lookup_sha256),
    lookupReport ? `${lookupReport.unique_response_id_count} expected response IDs across APK variants` : "report missing"
  ),
  item(
    "host_expected_vs_observed",
    "Host-side expected-vs-observed study flow writes the expected block files, metadata, long CSV rows, and result JSON.",
    hostReportPath,
    Boolean(hostReport && hostReport.pass === true),
    hostReport ? `${hostReport.expected_response_count || 52} response rows expected in host fixture` : "report missing"
  ),
  item(
    "quest_auto_run_device_data",
    "Quest APK stores app-private data, can be retrieved via ADB/run-as, and matches backend contract across repeated participants and profiles.",
    deviceReportPath,
    Boolean(deviceReport && deviceReport.pass === true && Array.isArray(deviceReport.expected_participants) && deviceReport.expected_participants.length >= 4 && deviceReport.expected_response_count === deviceReport.observed_response_count),
    deviceReport ? `${deviceReport.expected_participants.length} participants, ${deviceReport.expected_response_count} responses, next=${deviceReport.next_participant_id}` : "report missing"
  ),
  item(
    "manual_readiness",
    "Installed APK and live Quest allocation state are ready for the next manual participant without active/incomplete allocation.",
    readinessReportPath,
    Boolean(readinessReport && readinessReport.pass === true && readinessReport.expected_next_participant_id === readinessReport.requested_manual_participant_id && readinessReport.allocation_state && readinessReport.allocation_state.active_participant_id === null),
    readinessReport ? `next=${readinessReport.expected_next_participant_id}, device=${readinessReport.device && readinessReport.device.model}` : "report missing"
  ),
  item(
    "current_apk_hash_consistency",
    "Current debug APK hash matches the APK hash in readiness and lookup reports.",
    APK_PATH,
    Boolean(currentApkHash && readinessReport && lookupReport && currentApkHash === readinessReport.apk_sha256 && currentApkHash === lookupReport.apk_sha256),
    currentApkHash || "APK missing"
  ),
  item(
    "manual_headset_controller_hand_pass",
    "A real human/controller/hand headset run completes all demographics, required-state blocking, navigation, four audio blocks, and all questionnaire pages, then passes pulled-data manual verifier.",
    manualCandidate ? manualCandidate.report : "no manual-run-expected-vs-observed.json found",
    Boolean(manualReport && manualReport.pass === true && manualSummary && manualSummary.pass === true),
    manualReport ? `${manualReport.participant_id}: ${manualReport.trusted_manual_event_count} trusted events` : "required next-participant manual pass not yet captured"
  )
];

const pass = checks.every((check) => check.status === "passed");
const report = {
  pass,
  status: pass ? "complete" : "not_complete",
  generated_at_utc: new Date().toISOString(),
  apk_path: APK_PATH,
  current_apk_sha256: currentApkHash,
  checks,
  missing_or_failed: checks.filter((check) => check.status !== "passed")
};

const reportPath = process.env.STUDY6_REPORT_PATH || path.join(BUILD_DIR, "goal-readiness-audit.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (!pass) {
  console.error(`Study 6 goal readiness: not complete (${report.missing_or_failed.length} missing/failed checks).`);
  console.error(report.missing_or_failed.map((check) => `- ${check.id}: ${check.notes}`).join("\n"));
  console.error(reportPath);
  process.exit(1);
}

console.log("Study 6 goal readiness passed: all checks complete.");
console.log(reportPath);

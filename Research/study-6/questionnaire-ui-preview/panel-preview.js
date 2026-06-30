"use strict";

const PANEL_ID = "emotion_induction_sam_preview";
const SCHEMA_VERSION = 8;
const QUEST_PANEL_FRAME = { width_dp: 1080, height_dp: 720 };
const POLAR_ECG_SAMPLE_RATE_HZ = 130;
const CONSENT_TEXT = "I consent to participate in this study.";
const AUDIO_ASSET_BASE_PATH = "../neutral-hand-audio/audio";
const SAM_ASSET_BASE_PATH = "../questionnaire-assets/sam";
const SAM_ASSET_VERSION = "20260630-valence05-armpits";
const HAND_EMBODIMENT_PROMPT = "During the previous experience, did the virtual reality hands feel like your real hands? Rate how much you agree or disagree with each statement.";
const DOMINANCE_NEUTRAL_VALENCE_SCORE = 5;
const DOMINANCE_SAM_SCALE_FACTORS = [0.825, 0.99, 1.155, 1.32, 1.54, 1.815, 2.145, 2.475, 2.805];
const QUESTIONNAIRE_ITEM_LIBRARY = window.STUDY6_QUESTIONNAIRE_ITEM_LIBRARY;

if (!QUESTIONNAIRE_ITEM_LIBRARY || !Array.isArray(QUESTIONNAIRE_ITEM_LIBRARY.items)) {
  throw new Error("Study 6 questionnaire item library is missing.");
}

const QUESTIONNAIRE_ITEMS = QUESTIONNAIRE_ITEM_LIBRARY.items;
const QUESTIONNAIRE_PAGE_GROUPS = QUESTIONNAIRE_ITEM_LIBRARY.pages || [];
const CONTROL_MODEL = QUESTIONNAIRE_ITEMS.map((item) => ({ ...item }));

const CONDITIONS = [
  { id: "induction_a", label: "Condition A" },
  { id: "induction_b", label: "Condition B" },
  { id: "induction_c", label: "Condition C" },
  { id: "induction_d", label: "Condition D" }
];

const COUNTERBALANCE_ORDERS = [
  { id: "order_01", label: "Order 01: A B D C", condition_ids: ["induction_a", "induction_b", "induction_d", "induction_c"] },
  { id: "order_02", label: "Order 02: B C A D", condition_ids: ["induction_b", "induction_c", "induction_a", "induction_d"] },
  { id: "order_03", label: "Order 03: C D B A", condition_ids: ["induction_c", "induction_d", "induction_b", "induction_a"] },
  { id: "order_04", label: "Order 04: D A C B", condition_ids: ["induction_d", "induction_a", "induction_c", "induction_b"] }
];

const AUDIO_INSTRUCTION_SETS = [
  {
    id: "audio_instruction_set_1",
    label: "Audio variant V01",
    asset_paths: {
      en: `${AUDIO_ASSET_BASE_PATH}/study6_neutral_hand_audio_V01_EN.mp3`,
      de: `${AUDIO_ASSET_BASE_PATH}/study6_neutral_hand_audio_V01_DE.mp3`
    }
  },
  {
    id: "audio_instruction_set_2",
    label: "Audio variant V02",
    asset_paths: {
      en: `${AUDIO_ASSET_BASE_PATH}/study6_neutral_hand_audio_V02_EN.mp3`,
      de: `${AUDIO_ASSET_BASE_PATH}/study6_neutral_hand_audio_V02_DE.mp3`
    }
  },
  {
    id: "audio_instruction_set_3",
    label: "Audio variant V03",
    asset_paths: {
      en: `${AUDIO_ASSET_BASE_PATH}/study6_neutral_hand_audio_V03_EN.mp3`,
      de: `${AUDIO_ASSET_BASE_PATH}/study6_neutral_hand_audio_V03_DE.mp3`
    }
  },
  {
    id: "audio_instruction_set_4",
    label: "Audio variant V04",
    asset_paths: {
      en: `${AUDIO_ASSET_BASE_PATH}/study6_neutral_hand_audio_V04_EN.mp3`,
      de: `${AUDIO_ASSET_BASE_PATH}/study6_neutral_hand_audio_V04_DE.mp3`
    }
  }
];

const ASSESSMENT_PAGES = [
  {
    id: "sam_pictographic",
    label: "1/4",
    title: "How did you feel while during the previous tasks?",
    summary: "Assessment block page 1 of 4",
    block_group: "Retrospective SAM valence, arousal, and dominance/control pictographic rating"
  },
  {
    id: "affect_vas",
    label: "2/4",
    title: "Rate the previous experience",
    summary: "Assessment block page 2 of 4",
    block_group: "Retrospective valence and arousal visual analog scales 0-100"
  },
  {
    id: "ekman_intensity",
    label: "3/4",
    title: "To what degree were the emotions represented by the way the particles were moving?",
    summary: "Assessment block page 3 of 4",
    block_group: "Perceived Ekman emotion represented by particle movement 0-100"
  },
  {
    id: "hand_embodiment",
    label: "4/4",
    title: HAND_EMBODIMENT_PROMPT,
    summary: "Assessment block page 4 of 4",
    block_group: "Adapted VEQ virtual hand ownership and agency ratings"
  }
];

const INDUCTION_PAGE = {
  id: "emotion_induction_placeholder",
  label: "Instructions",
  title: "Instructions",
  summary: "Instructions"
};

const WORKFLOW_PAGES = [
  {
    id: "onboarding",
    label: "Setup",
    title: "Participant onboarding",
    summary: "Onboarding"
  },
  INDUCTION_PAGE,
  ...ASSESSMENT_PAGES
];

const LANGUAGE_OPTIONS = [
  { id: "en", label: "English" },
  { id: "de", label: "Deutsch" }
];

const HANDEDNESS_OPTIONS = [
  { id: "right", label: "Right" },
  { id: "left", label: "Left" },
  { id: "ambidextrous", label: "Both" },
  { id: "prefer_not_to_say", label: "Prefer not to say" }
];

const GENDER_OPTIONS = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "other", label: "Other" },
  { id: "prefer_not_to_say", label: "Prefer not to say" }
];

const REQUIRED_SAM_DIMENSIONS = ["valence", "arousal", "dominance"];

function samDimensionSortIndex(scaleId) {
  const index = REQUIRED_SAM_DIMENSIONS.indexOf(scaleId);
  return index === -1 ? REQUIRED_SAM_DIMENSIONS.length : index;
}

function assertCompleteSamManikinRows(rows) {
  const rowIds = rows.map((row) => row.id);
  const missing = REQUIRED_SAM_DIMENSIONS.filter((dimension) => !rowIds.includes(dimension));
  const duplicates = [...new Set(rowIds.filter((id, index) => rowIds.indexOf(id) !== index))];
  if (missing.length > 0 || duplicates.length > 0) {
    const details = [
      missing.length > 0 ? `missing ${missing.join(", ")}` : "",
      duplicates.length > 0 ? `duplicate ${duplicates.join(", ")}` : ""
    ].filter(Boolean).join("; ");
    throw new Error(`SAM pictographic assessments must include valence, arousal, and dominance rows: ${details}.`);
  }
}

const SAM_MANIKIN_ROWS = QUESTIONNAIRE_ITEMS
  .filter((item) => item.page === "sam_pictographic" && item.type === "pictographic-choice")
  .map((item) => ({
    item_id: item.id,
    variable_name: item.variable_name,
    id: item.scale_id,
    label: item.axis_label,
    question: item.question,
    low: item.low,
    high: item.high,
    field: item.field,
    options: item.options
  }))
  .sort((a, b) => samDimensionSortIndex(a.id) - samDimensionSortIndex(b.id));

assertCompleteSamManikinRows(SAM_MANIKIN_ROWS);

const AFFECT_VAS_SLIDERS = QUESTIONNAIRE_ITEMS
  .filter((item) => item.page === "affect_vas" && item.response_namespace === "affect_vas")
  .map((item) => ({
    item_id: item.id,
    variable_name: item.variable_name,
    id: item.id,
    label: item.axis_label,
    question: item.question,
    touchLabel: item.touchLabel,
    low: item.low,
    high: item.high,
    field: item.field
  }));

const VAS_INTERACTION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown"
]);

const EKMAN_EMOTIONS = QUESTIONNAIRE_ITEMS
  .filter((item) => item.page === "ekman_intensity" && item.response_namespace === "ekman_intensity")
  .map((item) => ({
    item_id: item.id,
    variable_name: item.variable_name,
    id: item.emotion_id,
    label: item.label,
    field: item.field
  }));

const HAND_EMBODIMENT_ITEMS = QUESTIONNAIRE_ITEMS
  .filter((item) => item.page === "hand_embodiment" && item.response_namespace === "hand_embodiment")
  .map((item) => ({
    item_id: item.id,
    variable_name: item.variable_name,
    id: item.construct_id,
    label: item.label,
    question: item.question,
    field: item.field,
    options: item.options,
    option_labels: item.option_labels
  }));

function ekmanFieldId(emotionId) {
  const item = EKMAN_EMOTIONS.find((emotion) => emotion.id === emotionId);
  return item ? item.field : `${emotionId}_raw_0_100`;
}

function twoDigitScore(score) {
  return String(score).padStart(2, "0");
}

function samAssetPath(scaleId, score) {
  return `${SAM_ASSET_BASE_PATH}/${scaleId}/${scaleId}_${twoDigitScore(score)}.svg`;
}

function samAssetUrl(scaleId, score) {
  return `${samAssetPath(scaleId, score)}?v=${SAM_ASSET_VERSION}`;
}

function samManikinImagePath(scaleId, score) {
  return scaleId === "dominance"
    ? samAssetPath("valence", DOMINANCE_NEUTRAL_VALENCE_SCORE)
    : samAssetPath(scaleId, score);
}

function samManikinImageUrl(scaleId, score) {
  return scaleId === "dominance"
    ? samAssetUrl("valence", DOMINANCE_NEUTRAL_VALENCE_SCORE)
    : samAssetUrl(scaleId, score);
}

function dominanceManikinScale(score) {
  return DOMINANCE_SAM_SCALE_FACTORS[score - 1] || 1;
}

function dominanceManikinStyleAttribute(scaleId, score) {
  if (scaleId !== "dominance") {
    return "";
  }
  return ` style="--sam-dominance-scale: ${dominanceManikinScale(score)}" data-sam-display="neutral-valence-scaled"`;
}

function defaultPolarValidation() {
  return {
    source: "browser_visual_preview",
    state: "ready",
    ready: true,
    detected: true,
    connected: true,
    streaming: true,
    pmd_ready: true,
    ecg_streaming: true,
    heart_rate_bpm: 72,
    rr_interval_count: 8,
    ecg_sample_count: 180,
    pmd_frame_count: 12,
    requested_mtu: 23,
    negotiated_mtu: 23,
    ecg_sample_rate_hz: POLAR_ECG_SAMPLE_RATE_HZ,
    ecg_resolution_bits: 14,
    pmd_control_point_indications_enabled: true,
    pmd_data_notifications_enabled: true,
    pmd_settings_received: true,
    pmd_start_response_received: true,
    diagnostic: "PMD ready | ECG streaming | MTU 23/23",
    native_ready_rule: "streaming && heart_rate_bpm > 0 && rr_interval_count > 0 && pmd_ready && ecg_streaming && ecg_sample_count > 0 && ecg_sample_rate_hz == 130"
  };
}

function defaultSignature() {
  return {
    has_signature: false,
    stroke_count: 0,
    strokes: []
  };
}

function defaultOnboarding() {
  return {
    polar_validation: defaultPolarValidation(),
    language_code: "en",
    participant_first_name: "",
    participant_last_name: "",
    participant_name: "",
    age_years: null,
    handedness: "",
    gender: "",
    consent_confirmed: false,
    consent_text: CONSENT_TEXT,
    signature: defaultSignature(),
    complete: false
  };
}

function splitParticipantName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return {
    first: parts.shift() || "",
    last: parts.join(" ")
  };
}

function combinedParticipantName(firstName, lastName) {
  return [firstName, lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

function normalizeSignature(rawSignature) {
  const raw = rawSignature || {};
  const strokes = Array.isArray(raw.strokes)
    ? raw.strokes.map((stroke) => Array.isArray(stroke) ? stroke.filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y)) : [])
    : [];
  return {
    ...defaultSignature(),
    ...raw,
    strokes,
    stroke_count: Number.isInteger(raw.stroke_count) ? raw.stroke_count : strokes.length,
    has_signature: Boolean(raw.has_signature || strokes.length > 0)
  };
}

function normalizeOnboarding(rawOnboarding) {
  const base = defaultOnboarding();
  const raw = rawOnboarding || {};
  const polar = {
    ...base.polar_validation,
    ...(raw.polar_validation || {})
  };
  const age = raw.age_years === "" || raw.age_years === undefined ? null : raw.age_years;
  const legacyName = typeof raw.participant_name === "string" ? raw.participant_name : "";
  const splitName = splitParticipantName(legacyName);
  const rawFirstName = typeof raw.participant_first_name === "string" ? raw.participant_first_name : "";
  const rawLastName = typeof raw.participant_last_name === "string" ? raw.participant_last_name : "";
  const useLegacySplit = rawFirstName.trim().length === 0 && rawLastName.trim().length === 0 && legacyName.trim().length > 0;
  const firstName = useLegacySplit ? splitName.first : rawFirstName;
  const lastName = useLegacySplit ? splitName.last : rawLastName;
  return {
    ...base,
    ...raw,
    polar_validation: polar,
    language_code: LANGUAGE_OPTIONS.some((option) => option.id === raw.language_code) ? raw.language_code : base.language_code,
    participant_first_name: firstName,
    participant_last_name: lastName,
    participant_name: combinedParticipantName(firstName, lastName),
    age_years: age === null ? null : Number(age),
    handedness: typeof raw.handedness === "string" ? raw.handedness : base.handedness,
    gender: typeof raw.gender === "string" ? raw.gender : base.gender,
    consent_confirmed: Boolean(raw.consent_confirmed),
    consent_text: CONSENT_TEXT,
    signature: normalizeSignature(raw.signature),
    complete: Boolean(raw.complete)
  };
}

function defaultPageCompletion() {
  return Object.fromEntries(ASSESSMENT_PAGES.map((page) => [page.id, false]));
}

function defaultEkmanIntensity() {
  return Object.fromEntries(EKMAN_EMOTIONS.map((emotion) => [ekmanFieldId(emotion.id), 0]));
}

function defaultHandEmbodiment() {
  return Object.fromEntries(HAND_EMBODIMENT_ITEMS.map((item) => [item.field, null]));
}

function defaultAffectVasTouched() {
  return Object.fromEntries(AFFECT_VAS_SLIDERS.map((slider) => [slider.field, false]));
}

function defaultSamAssessment() {
  return Object.fromEntries(SAM_MANIKIN_ROWS.map((row) => [row.field, null]));
}

function defaultAssessment() {
  return {
    sam: defaultSamAssessment(),
    affect_vas: {
      valence_raw_0_100: 50,
      arousal_raw_0_100: 50
    },
    affect_vas_touched: defaultAffectVasTouched(),
    ekman_intensity: defaultEkmanIntensity(),
    hand_embodiment: defaultHandEmbodiment(),
    page_complete: defaultPageCompletion(),
    complete: false
  };
}

function normalizeAssessment(rawAssessment) {
  const base = defaultAssessment();
  const raw = rawAssessment || {};
  const rawPageComplete = raw.page_complete || {};
  const rawTouched = raw.affect_vas_touched || raw.vas_touched || {};
  const completedAffectVas = Boolean(raw.complete || rawPageComplete.affect_vas);
  return {
    sam: {
      ...base.sam,
      ...(raw.sam || {})
    },
    affect_vas: {
      ...base.affect_vas,
      ...(raw.affect_vas || raw.sliders || {})
    },
    affect_vas_touched: Object.fromEntries(AFFECT_VAS_SLIDERS.map((slider) => [
      slider.field,
      completedAffectVas || Boolean(rawTouched[slider.field])
    ])),
    ekman_intensity: {
      ...base.ekman_intensity,
      ...(raw.ekman_intensity || {})
    },
    hand_embodiment: {
      ...base.hand_embodiment,
      ...(raw.hand_embodiment || {})
    },
    page_complete: {
      ...base.page_complete,
      ...(raw.page_complete || {})
    },
    complete: Boolean(raw.complete)
  };
}

function exportAssessment(assessment) {
  const normalized = normalizeAssessment(assessment);
  return {
    sam: normalized.sam,
    affect_vas: normalized.affect_vas,
    ekman_intensity: normalized.ekman_intensity,
    hand_embodiment: normalized.hand_embodiment,
    page_complete: normalized.page_complete,
    complete: normalized.complete
  };
}

function makeState() {
  return {
    panel_id: PANEL_ID,
    schema_version: SCHEMA_VERSION,
    onboarding: defaultOnboarding(),
    counterbalance_order_id: "order_01",
    active_panel_page_id: "onboarding",
    active_condition_position: 1,
    active_assessment_page_id: "sam_pictographic",
    responses_by_condition: CONDITIONS.map((condition, index) => ({
      condition_id: condition.id,
      preview_condition_label: condition.label,
      assigned_position: index + 1,
      assessment: defaultAssessment()
    }))
  };
}

function makeEdgeState() {
  const state = makeState();
  state.counterbalance_order_id = "order_04";
  state.active_condition_position = 4;
  state.active_panel_page_id = "onboarding";
  state.active_assessment_page_id = "ekman_intensity";
  state.onboarding = normalizeOnboarding({
    polar_validation: {
      ...defaultPolarValidation(),
      ready: false,
      state: "ecg_streaming",
      ecg_sample_count: 0,
      diagnostic: "ECG stream waiting for samples"
    },
    language_code: "de",
    participant_first_name: "Preview",
    participant_last_name: "Participant",
    age_years: 29,
    handedness: "left",
    gender: "prefer_not_to_say",
    consent_confirmed: true,
    signature: {
      has_signature: true,
      stroke_count: 2,
      strokes: [
        [
          { x: 0.12, y: 0.62 },
          { x: 0.24, y: 0.45 },
          { x: 0.36, y: 0.58 },
          { x: 0.48, y: 0.38 }
        ],
        [
          { x: 0.54, y: 0.62 },
          { x: 0.65, y: 0.48 },
          { x: 0.78, y: 0.54 },
          { x: 0.88, y: 0.42 }
        ]
      ]
    }
  });
  state.responses_by_condition.forEach((entry, index) => {
    const assessment = entry.assessment;
    assessment.sam.valence_raw_1_9 = index === 3 ? 1 : 9;
    assessment.sam.arousal_raw_1_9 = index === 3 ? 9 : 1;
    assessment.sam.dominance_raw_1_9 = index === 3 ? 1 : 9;
    assessment.affect_vas.valence_raw_0_100 = index === 3 ? 0 : 100;
    assessment.affect_vas.arousal_raw_0_100 = index === 3 ? 100 : 0;
    EKMAN_EMOTIONS.forEach((emotion, emotionIndex) => {
      assessment.ekman_intensity[ekmanFieldId(emotion.id)] = index === 3 ? emotionIndex * 20 : 100 - emotionIndex * 12;
    });
    assessment.hand_embodiment.ownership_raw_1_7 = index === 3 ? 2 : 6;
    assessment.hand_embodiment.agency_raw_1_7 = index === 3 ? 3 : 7;
    assessment.page_complete.sam_pictographic = true;
    assessment.page_complete.affect_vas = true;
    assessment.page_complete.ekman_intensity = true;
    assessment.page_complete.hand_embodiment = index < 3;
    assessment.complete = index < 3;
  });
  return state;
}

function initialPreviewState() {
  const params = new URLSearchParams(window.location.search);
  return params.get("fixture") === "edge" ? makeEdgeState() : makeState();
}

let state = initialPreviewState();

const elements = {
  conditionStatus: document.getElementById("conditionStatus"),
  conditionLabel: document.getElementById("conditionLabel"),
  pageLabel: document.getElementById("pageLabel"),
  pageTitle: document.getElementById("pageTitle"),
  onboardingPage: document.getElementById("onboardingPage"),
  polarStatusCard: document.getElementById("polarStatusCard"),
  polarStatusTitle: document.getElementById("polarStatusTitle"),
  polarSignalDetail: document.getElementById("polarSignalDetail"),
  polarDiagnostic: document.getElementById("polarDiagnostic"),
  polarWaveform: document.getElementById("polarWaveform"),
  languageOptions: document.getElementById("languageOptions"),
  participantFirstName: document.getElementById("participantFirstName"),
  participantLastName: document.getElementById("participantLastName"),
  participantAge: document.getElementById("participantAge"),
  handednessOptions: document.getElementById("handednessOptions"),
  genderOptions: document.getElementById("genderOptions"),
  consentCheckbox: document.getElementById("consentCheckbox"),
  consentText: document.getElementById("consentText"),
  signaturePad: document.getElementById("signaturePad"),
  clearSignature: document.getElementById("clearSignature"),
  signatureSummary: document.getElementById("signatureSummary"),
  inductionPage: document.getElementById("inductionPage"),
  inductionKicker: document.getElementById("inductionKicker"),
  inductionHeading: document.getElementById("inductionHeading"),
  inductionConditionLabel: document.getElementById("inductionConditionLabel"),
  inductionAudioLabel: document.getElementById("inductionAudioLabel"),
  inductionAudioSummary: document.getElementById("inductionAudioSummary"),
  inductionRandomizationNote: document.getElementById("inductionRandomizationNote"),
  inductionAudioLinks: document.getElementById("inductionAudioLinks"),
  inductionSummary: document.getElementById("inductionSummary"),
  samPage: document.getElementById("samPage"),
  vasPage: document.getElementById("vasPage"),
  ekmanPage: document.getElementById("ekmanPage"),
  handEmbodimentPage: document.getElementById("handEmbodimentPage"),
  samRows: document.getElementById("samRows"),
  samCompletion: document.getElementById("samCompletion"),
  sliderRows: document.getElementById("sliderRows"),
  ekmanSliderRows: document.getElementById("ekmanSliderRows"),
  handEmbodimentRows: document.getElementById("handEmbodimentRows"),
  pageCounter: document.getElementById("pageCounter"),
  validationSummary: document.getElementById("validationSummary"),
  previousPage: document.getElementById("previousPage"),
  nextPage: document.getElementById("nextPage"),
  orderSelect: document.getElementById("orderSelect"),
  conditionButtons: document.getElementById("conditionButtons"),
  pageButtons: document.getElementById("pageButtons"),
  loadDefault: document.getElementById("loadDefault"),
  loadEdge: document.getElementById("loadEdge"),
  exportState: document.getElementById("exportState"),
  jsonOutput: document.getElementById("jsonOutput"),
  storyboardSection: document.querySelector(".storyboard"),
  storyboardPanels: document.getElementById("storyboardPanels")
};

const signatureDrawing = {
  active: false,
  currentStroke: []
};

function activeOrder() {
  return COUNTERBALANCE_ORDERS.find((order) => order.id === state.counterbalance_order_id) || COUNTERBALANCE_ORDERS[0];
}

function activeConditionId() {
  const order = activeOrder();
  return order.condition_ids[state.active_condition_position - 1] || order.condition_ids[0];
}

function activePanelPageId() {
  return WORKFLOW_PAGES.some((page) => page.id === state.active_panel_page_id)
    ? state.active_panel_page_id
    : state.active_assessment_page_id;
}

function isOnboardingActive() {
  return activePanelPageId() === "onboarding";
}

function isInductionActive() {
  return activePanelPageId() === INDUCTION_PAGE.id;
}

function activePageIndex() {
  const index = ASSESSMENT_PAGES.findIndex((page) => page.id === state.active_assessment_page_id);
  return index >= 0 ? index : 0;
}

function activePage() {
  return ASSESSMENT_PAGES[activePageIndex()];
}

function assessmentPageNumber(pageId) {
  const index = ASSESSMENT_PAGES.findIndex((page) => page.id === pageId);
  return index >= 0 ? index + 1 : null;
}

function conditionLabelFor(id) {
  return (CONDITIONS.find((condition) => condition.id === id) || CONDITIONS[0]).label;
}

function audioInstructionFor(conditionPosition) {
  return AUDIO_INSTRUCTION_SETS[(conditionPosition - 1) % AUDIO_INSTRUCTION_SETS.length];
}

function audioAssetPath(audio, languageCode = state.onboarding.language_code) {
  const language = languageCode === "de" ? "de" : "en";
  return audio.asset_paths[language] || audio.asset_paths.en;
}

function audioAssetLinksMarkup(languageCode = state.onboarding.language_code) {
  return AUDIO_INSTRUCTION_SETS.map((audio, index) => {
    const label = `V${String(index + 1).padStart(2, "0")}`;
    return `<a href="${escapeHtml(audioAssetPath(audio, languageCode))}" target="_blank" rel="noopener">${label}</a>`;
  }).join("");
}

function renderAudioAssetLinks(container, languageCode = state.onboarding.language_code) {
  container.replaceChildren();
  AUDIO_INSTRUCTION_SETS.forEach((audio, index) => {
    const link = document.createElement("a");
    link.href = audioAssetPath(audio, languageCode);
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = `V${String(index + 1).padStart(2, "0")}`;
    container.appendChild(link);
  });
}

function responseFor(conditionId = activeConditionId()) {
  let response = state.responses_by_condition.find((entry) => entry.condition_id === conditionId);
  if (!response) {
    response = {
      condition_id: conditionId,
      preview_condition_label: conditionLabelFor(conditionId),
      assigned_position: state.active_condition_position,
      assessment: defaultAssessment()
    };
    state.responses_by_condition.push(response);
  }
  response.assessment = normalizeAssessment(response.assessment);
  return response;
}

function activeAssessment() {
  return responseFor().assessment;
}

function setState(nextState) {
  const copy = JSON.parse(JSON.stringify(nextState));
  const assessmentPageId = ASSESSMENT_PAGES.some((page) => page.id === copy.active_assessment_page_id)
    ? copy.active_assessment_page_id
    : "sam_pictographic";
  const panelPageId = WORKFLOW_PAGES.some((page) => page.id === copy.active_panel_page_id)
    ? copy.active_panel_page_id
    : "onboarding";
  state = {
    ...makeState(),
    ...copy,
    onboarding: normalizeOnboarding(copy.onboarding),
    active_panel_page_id: panelPageId,
    active_assessment_page_id: assessmentPageId
  };
  state.responses_by_condition = (copy.responses_by_condition || []).map((entry) => ({
    ...entry,
    assessment: normalizeAssessment(entry.assessment)
  }));
  CONDITIONS.forEach((condition) => responseFor(condition.id));
  render();
}

function render() {
  renderHeader();
  renderVisiblePage();
  renderOnboarding();
  renderInductionPlaceholder();
  renderSamRows();
  renderVasSliders();
  renderEkmanSliders();
  renderHandEmbodimentItems();
  renderValidation();
  renderExport();
  renderStoryboard();
}

function renderOrderSelect() {
  if (!elements.orderSelect) {
    return;
  }
  elements.orderSelect.replaceChildren();
  COUNTERBALANCE_ORDERS.forEach((order) => {
    const option = document.createElement("option");
    option.value = order.id;
    option.textContent = order.label;
    option.selected = order.id === state.counterbalance_order_id;
    elements.orderSelect.appendChild(option);
  });
}

function renderConditionButtons() {
  if (!elements.conditionButtons) {
    return;
  }
  elements.conditionButtons.replaceChildren();
  const order = activeOrder();
  order.condition_ids.forEach((conditionId, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index + 1}. ${conditionLabelFor(conditionId).replace("Induction ", "")}`;
    button.setAttribute("aria-pressed", String(index + 1 === state.active_condition_position));
    button.addEventListener("click", () => {
      state.active_condition_position = index + 1;
      state.active_panel_page_id = INDUCTION_PAGE.id;
      state.active_assessment_page_id = "sam_pictographic";
      render();
    });
    elements.conditionButtons.appendChild(button);
  });
}

function renderPageButtons() {
  if (!elements.pageButtons) {
    return;
  }
  elements.pageButtons.replaceChildren();
  WORKFLOW_PAGES.forEach((page, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = page.id === "onboarding" ? page.label : `${index}. ${page.label}`;
    button.setAttribute("aria-pressed", String(page.id === activePanelPageId()));
    button.addEventListener("click", () => {
      state.active_panel_page_id = page.id;
      if (ASSESSMENT_PAGES.some((assessmentPage) => assessmentPage.id === page.id)) {
        state.active_assessment_page_id = page.id;
      }
      render();
    });
    elements.pageButtons.appendChild(button);
  });
}

function renderHeader() {
  elements.conditionStatus.textContent = "";
  elements.conditionStatus.hidden = true;
  if (isOnboardingActive()) {
    elements.conditionLabel.textContent = "Setup";
    elements.pageLabel.textContent = "Setup";
    elements.pageTitle.textContent = "Before we begin";
    elements.pageCounter.textContent = "";
    elements.pageCounter.hidden = true;
    return;
  }
  if (isInductionActive()) {
    elements.conditionLabel.textContent = "";
    elements.pageLabel.textContent = "Instructions";
    elements.pageTitle.textContent = "Instructions";
    elements.pageCounter.textContent = "";
    elements.pageCounter.hidden = true;
    return;
  }
  const conditionId = activeConditionId();
  const response = responseFor(conditionId);
  const page = activePage();
  response.assigned_position = state.active_condition_position;
  response.preview_condition_label = conditionLabelFor(conditionId);
  elements.conditionLabel.textContent = "";
  elements.pageLabel.textContent = "";
  elements.pageTitle.textContent = page.title;
  elements.pageCounter.textContent = "";
  elements.pageCounter.hidden = true;
}

function renderVisiblePage() {
  const pageId = activePanelPageId();
  elements.onboardingPage.hidden = pageId !== "onboarding";
  elements.inductionPage.hidden = pageId !== INDUCTION_PAGE.id;
  elements.samPage.hidden = pageId !== "sam_pictographic";
  elements.vasPage.hidden = pageId !== "affect_vas";
  elements.ekmanPage.hidden = pageId !== "ekman_intensity";
  elements.handEmbodimentPage.hidden = pageId !== "hand_embodiment";
}

function polarIsReady(polar = state.onboarding.polar_validation) {
  return Boolean(
    polar.ready &&
      polar.streaming &&
      polar.heart_rate_bpm > 0 &&
      polar.rr_interval_count > 0 &&
      polar.pmd_ready &&
      polar.ecg_streaming &&
      polar.ecg_sample_count > 0 &&
      polar.ecg_sample_rate_hz === POLAR_ECG_SAMPLE_RATE_HZ
  );
}

function renderOnboarding() {
  state.onboarding = normalizeOnboarding(state.onboarding);
  const onboarding = state.onboarding;
  const polar = onboarding.polar_validation;
  const ready = polarIsReady(polar);

  elements.polarStatusCard.classList.toggle("ready", ready);
  elements.polarStatusCard.classList.toggle("waiting", !ready);
  elements.polarStatusTitle.textContent = ready ? "Polar H10 ECG ready" : "Polar H10 pending";
  elements.polarSignalDetail.textContent =
    `HR ${polar.heart_rate_bpm} bpm | RR ${polar.rr_interval_count} | ECG ${polar.ecg_sample_count} samples @ ${polar.ecg_sample_rate_hz} Hz`;
  elements.polarDiagnostic.textContent = ready
    ? polar.diagnostic
    : (polar.diagnostic || polar.state || "Waiting for Polar H10 signal");

  renderOptionGroup(elements.languageOptions, LANGUAGE_OPTIONS, onboarding.language_code, "onboarding.language", (value) => {
    onboarding.language_code = value;
    onboarding.complete = false;
  });
  renderOptionGroup(elements.handednessOptions, HANDEDNESS_OPTIONS, onboarding.handedness, "onboarding.handedness", (value) => {
    onboarding.handedness = value;
    onboarding.complete = false;
  });
  renderOptionGroup(elements.genderOptions, GENDER_OPTIONS, onboarding.gender, "onboarding.gender", (value) => {
    onboarding.gender = value;
    onboarding.complete = false;
  });

  if (document.activeElement !== elements.participantFirstName) {
    elements.participantFirstName.value = onboarding.participant_first_name;
  }
  if (document.activeElement !== elements.participantLastName) {
    elements.participantLastName.value = onboarding.participant_last_name;
  }
  if (document.activeElement !== elements.participantAge) {
    elements.participantAge.value = onboarding.age_years === null || Number.isNaN(onboarding.age_years)
      ? ""
      : String(onboarding.age_years);
  }
  elements.consentCheckbox.checked = onboarding.consent_confirmed;
  elements.consentText.textContent = onboarding.consent_text;
  elements.signatureSummary.textContent = onboarding.signature.has_signature
    ? `${onboarding.signature.stroke_count} signature stroke${onboarding.signature.stroke_count === 1 ? "" : "s"} captured`
    : "No signature captured";

  window.requestAnimationFrame(() => {
    drawPolarWaveform();
    drawSignaturePad();
  });
}

function renderOptionGroup(container, options, selectedValue, idPrefix, onSelect) {
  container.replaceChildren();
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = `${idPrefix}.${option.id}`;
    button.textContent = option.label;
    button.setAttribute("aria-pressed", String(option.id === selectedValue));
    button.addEventListener("click", () => {
      onSelect(option.id);
      render();
    });
    container.appendChild(button);
  });
}

function renderInductionPlaceholder() {
  elements.inductionKicker.textContent = "";
  elements.inductionKicker.hidden = true;
  elements.inductionHeading.textContent = "Instructions";
  elements.inductionConditionLabel.textContent = "Instructions";
  elements.inductionAudioLabel.textContent = "Audio ready";
  elements.inductionAudioSummary.textContent = "Please follow the instructions.";
  elements.inductionRandomizationNote.textContent = "";
  elements.inductionAudioLinks.replaceChildren();
  elements.inductionSummary.textContent = "A short response section follows.";
}

function storyboardItems(order = activeOrder()) {
  return [
    {
      page_id: "onboarding",
      storyboard_title: "Onboarding",
      storyboard_subtitle: "Before we begin"
    },
    ...order.condition_ids.flatMap((conditionId, index) => {
      const conditionPosition = index + 1;
      return [
        {
          page_id: INDUCTION_PAGE.id,
          condition_id: conditionId,
          condition_position: conditionPosition,
          storyboard_title: "Instructions",
          storyboard_subtitle: "Instructions before the response pages"
        },
        ...ASSESSMENT_PAGES.map((page, pageIndex) => ({
          page_id: page.id,
          condition_id: conditionId,
          condition_position: conditionPosition,
          storyboard_title: page.title,
          storyboard_subtitle: "Response section"
        }))
      ];
    })
  ];
}

function storyboardOnboardingState() {
  return normalizeOnboarding({
    polar_validation: defaultPolarValidation(),
    language_code: "en",
    participant_first_name: "Preview",
    participant_last_name: "Participant",
    age_years: 29,
    handedness: "right",
    gender: "prefer_not_to_say",
    signature: {
      has_signature: true,
      stroke_count: 2,
      strokes: [
        [
          { x: 0.11, y: 0.64 },
          { x: 0.21, y: 0.42 },
          { x: 0.34, y: 0.58 },
          { x: 0.46, y: 0.36 }
        ],
        [
          { x: 0.52, y: 0.63 },
          { x: 0.63, y: 0.48 },
          { x: 0.77, y: 0.55 },
          { x: 0.9, y: 0.4 }
        ]
      ]
    },
    complete: false
  });
}

function storyboardAssessmentFor(conditionPosition) {
  const examples = [
    {
      sam: { valence_raw_1_9: null, arousal_raw_1_9: null, dominance_raw_1_9: null },
      affect_vas: { valence_raw_0_100: 52, arousal_raw_0_100: 48 },
      affect_vas_touched: { valence_raw_0_100: true, arousal_raw_0_100: true },
      ekman_intensity: {
        anger_raw_0_100: 12,
        disgust_raw_0_100: 8,
        fear_raw_0_100: 18,
        happiness_raw_0_100: 38,
        sadness_raw_0_100: 16,
        surprise_raw_0_100: 24
      },
      hand_embodiment: {
        ownership_raw_1_7: 5,
        agency_raw_1_7: 6
      }
    },
    {
      sam: { valence_raw_1_9: null, arousal_raw_1_9: null, dominance_raw_1_9: null },
      affect_vas: { valence_raw_0_100: 72, arousal_raw_0_100: 64 },
      affect_vas_touched: { valence_raw_0_100: true, arousal_raw_0_100: true },
      ekman_intensity: {
        anger_raw_0_100: 10,
        disgust_raw_0_100: 14,
        fear_raw_0_100: 26,
        happiness_raw_0_100: 68,
        sadness_raw_0_100: 12,
        surprise_raw_0_100: 46
      },
      hand_embodiment: {
        ownership_raw_1_7: 6,
        agency_raw_1_7: 7
      }
    },
    {
      sam: { valence_raw_1_9: null, arousal_raw_1_9: null, dominance_raw_1_9: null },
      affect_vas: { valence_raw_0_100: 24, arousal_raw_0_100: 82 },
      affect_vas_touched: { valence_raw_0_100: true, arousal_raw_0_100: true },
      ekman_intensity: {
        anger_raw_0_100: 34,
        disgust_raw_0_100: 28,
        fear_raw_0_100: 74,
        happiness_raw_0_100: 8,
        sadness_raw_0_100: 42,
        surprise_raw_0_100: 58
      },
      hand_embodiment: {
        ownership_raw_1_7: 3,
        agency_raw_1_7: 5
      }
    },
    {
      sam: { valence_raw_1_9: null, arousal_raw_1_9: null, dominance_raw_1_9: null },
      affect_vas: { valence_raw_0_100: 84, arousal_raw_0_100: 28 },
      affect_vas_touched: { valence_raw_0_100: true, arousal_raw_0_100: true },
      ekman_intensity: {
        anger_raw_0_100: 6,
        disgust_raw_0_100: 10,
        fear_raw_0_100: 12,
        happiness_raw_0_100: 78,
        sadness_raw_0_100: 8,
        surprise_raw_0_100: 36
      },
      hand_embodiment: {
        ownership_raw_1_7: 7,
        agency_raw_1_7: 6
      }
    }
  ];
  const index = Math.max(0, Math.min(examples.length - 1, conditionPosition - 1));
  return normalizeAssessment(examples[index]);
}

function renderStoryboard() {
  if (!elements.storyboardPanels || !elements.storyboardSection || elements.storyboardSection.hidden) {
    return;
  }
  const items = storyboardItems();
  elements.storyboardPanels.replaceChildren();
  items.forEach((item, index) => {
    const wrapper = document.createElement("article");
    wrapper.className = "storyboard-item";
    wrapper.dataset.pageId = item.page_id;
    wrapper.innerHTML = `
      <div class="storyboard-card-label">
        <span>Panel ${String(index + 1).padStart(2, "0")} of ${String(items.length).padStart(2, "0")}</span>
        <strong>${escapeHtml(item.storyboard_title)}</strong>
        <em>${escapeHtml(item.storyboard_subtitle)}</em>
      </div>
    `;
    wrapper.appendChild(createStoryboardPanel(item));
    elements.storyboardPanels.appendChild(wrapper);
  });
  window.requestAnimationFrame(drawStoryboardCanvases);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function localizedText(value, languageCode = state.onboarding.language_code) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value[languageCode] || value.en || Object.values(value).find(Boolean) || "";
  }
  return String(value ?? "");
}

function likertLabelFor(item, score, languageCode = state.onboarding.language_code) {
  const option = (item.option_labels || []).find((candidate) => candidate.value === score);
  return localizedText(option ? option.label : "", languageCode);
}

function stackedLabelMarkup(label) {
  return String(label)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `<span>${escapeHtml(word)}</span>`)
    .join("");
}

function appendStackedLabel(element, label) {
  element.replaceChildren();
  element.setAttribute("aria-label", label);
  String(label)
    .split(/\s+/)
    .filter(Boolean)
    .forEach((word) => {
      const span = document.createElement("span");
      span.textContent = word;
      element.appendChild(span);
    });
}

function createStoryboardPanel(item) {
  const meta = storyboardPanelMeta(item);
  const panel = document.createElement("section");
  panel.className = "panel-frame storyboard-panel-frame";
  panel.setAttribute("aria-label", `${item.storyboard_title} panel`);
  panel.innerHTML = `
    <header class="panel-header">
      <div>
        ${meta.conditionStatus ? `<p class="eyebrow">${escapeHtml(meta.conditionStatus)}</p>` : ""}
        <h1>${escapeHtml(meta.pageTitle)}</h1>
      </div>
      <div class="header-chips" hidden aria-hidden="true">
        <div class="stage-chip">${escapeHtml(meta.conditionLabel)}</div>
        <div class="page-chip">${escapeHtml(meta.pageLabel)}</div>
      </div>
    </header>
    ${storyboardContentMarkup(item)}
    <footer class="panel-footer">
      <div>
        ${meta.pageCounter ? `<p class="footer-label">${escapeHtml(meta.pageCounter)}</p>` : ""}
        ${meta.footerStatus ? `<p class="footer-status${meta.footerError ? " error" : ""}">${escapeHtml(meta.footerStatus)}</p>` : ""}
      </div>
      <div class="footer-actions">
        <button class="secondary-button" type="button"${meta.backDisabled ? " disabled" : ""}>Back</button>
        <button class="primary-button" type="button"${meta.nextDisabled ? " disabled" : ""}>${escapeHtml(meta.nextText)}</button>
      </div>
    </footer>
  `;
  const shell = document.createElement("div");
  shell.className = "panel-scale-shell storyboard-scale-shell";
  shell.appendChild(panel);
  return shell;
}

function storyboardPanelMeta(item) {
  if (item.page_id === "onboarding") {
    const onboarding = storyboardOnboardingState();
    const errors = onboardingValidationErrors(onboarding);
    return {
      conditionStatus: "",
      conditionLabel: "Setup",
      pageLabel: "Setup",
      pageTitle: "Before we begin",
      pageCounter: "",
      footerStatus: errors.length > 0 ? errors[0] : "Ready to begin",
      footerError: errors.length > 0,
      backDisabled: true,
      nextDisabled: errors.length > 0,
      nextText: "Begin"
    };
  }

  if (item.page_id === INDUCTION_PAGE.id) {
    return {
      conditionStatus: "",
      conditionLabel: "",
      pageLabel: "Instructions",
      pageTitle: "Instructions",
      pageCounter: "",
      footerStatus: "Ready to continue",
      footerError: false,
      backDisabled: false,
      nextDisabled: false,
      nextText: "Continue"
    };
  }

  const page = ASSESSMENT_PAGES.find((candidate) => candidate.id === item.page_id) || ASSESSMENT_PAGES[0];
  const assessment = storyboardAssessmentFor(item.condition_position);
  const errors = validationErrors(assessment, page.id);
  const isFinalAssessmentPage = page.id === ASSESSMENT_PAGES[ASSESSMENT_PAGES.length - 1].id;
  return {
    conditionStatus: "",
    conditionLabel: "",
    pageLabel: page.label,
    pageTitle: page.title,
    pageCounter: "",
    footerStatus: "",
    footerError: false,
    backDisabled: false,
    nextDisabled: errors.length > 0,
    nextText: isFinalAssessmentPage
      ? item.condition_position < CONDITIONS.length
        ? "Continue"
        : (assessment.complete ? "Workflow marked complete" : "Mark workflow complete")
      : "Continue"
  };
}

function storyboardContentMarkup(item) {
  if (item.page_id === "onboarding") {
    return onboardingStoryboardMarkup();
  }
  if (item.page_id === INDUCTION_PAGE.id) {
    return inductionStoryboardMarkup(item);
  }
  const assessment = storyboardAssessmentFor(item.condition_position);
  if (item.page_id === "sam_pictographic") {
    return samStoryboardMarkup(assessment);
  }
  if (item.page_id === "affect_vas") {
    return vasStoryboardMarkup(assessment);
  }
  if (item.page_id === "ekman_intensity") {
    return ekmanStoryboardMarkup(assessment);
  }
  return handEmbodimentStoryboardMarkup(assessment);
}

function onboardingStoryboardMarkup() {
  const onboarding = storyboardOnboardingState();
  const polar = onboarding.polar_validation;
  const ready = polarIsReady(polar);
  const age = onboarding.age_years === null || Number.isNaN(onboarding.age_years) ? "" : String(onboarding.age_years);
  return `
    <section class="assessment-page onboarding-section storyboard-onboarding-page">
      <div class="polar-status ${ready ? "ready" : "waiting"}">
        <div class="polar-status-main">
          <span class="status-lamp" aria-hidden="true"></span>
          <div>
            <p class="story-polar-title">${ready ? "Polar H10 ECG ready" : "Polar H10 pending"}</p>
            <p class="story-polar-detail">HR ${escapeHtml(polar.heart_rate_bpm)} bpm | RR ${escapeHtml(polar.rr_interval_count)} | ECG ${escapeHtml(polar.ecg_sample_count)} samples @ ${escapeHtml(polar.ecg_sample_rate_hz)} Hz</p>
            <p class="story-polar-diagnostic">${escapeHtml(ready ? polar.diagnostic : (polar.diagnostic || polar.state || "Waiting for Polar H10 signal"))}</p>
          </div>
        </div>
        <canvas class="polar-waveform storyboard-polar-waveform" width="300" height="48" data-ready="${ready ? "true" : "false"}" aria-label="ECG waveform preview"></canvas>
      </div>

      <div class="section-title onboarding-title">
        <h2>Before we begin</h2>
        <span>Required before we begin</span>
      </div>

      <div class="onboarding-grid">
        <div class="onboarding-column">
          <div class="field-group">
            <label>Language</label>
            <div class="option-group two-options">${optionButtonsMarkup(LANGUAGE_OPTIONS, onboarding.language_code)}</div>
          </div>
          <div class="split-field-row">
            <div class="field-row">
              <label>First name</label>
              <input type="text" autocomplete="given-name" inputmode="text" value="${escapeHtml(onboarding.participant_first_name)}" readonly>
            </div>
            <div class="field-row">
              <label>Last name</label>
              <input type="text" autocomplete="family-name" inputmode="text" value="${escapeHtml(onboarding.participant_last_name)}" readonly>
            </div>
          </div>
          <div class="field-row compact">
            <label>Age</label>
            <input type="number" min="0" max="120" step="1" inputmode="numeric" value="${escapeHtml(age)}" readonly>
          </div>
          <div class="field-group">
            <label>Handedness</label>
            <div class="option-group four-options">${optionButtonsMarkup(HANDEDNESS_OPTIONS, onboarding.handedness)}</div>
          </div>
          <div class="field-group">
            <label>Gender</label>
            <div class="option-group four-options">${optionButtonsMarkup(GENDER_OPTIONS, onboarding.gender)}</div>
          </div>
        </div>

        <div class="onboarding-column consent-column">
          <label class="consent-check">
            <input type="checkbox" ${onboarding.consent_confirmed ? "checked" : ""} aria-label="Study consent">
            <span>${escapeHtml(onboarding.consent_text)}</span>
          </label>
          <div class="signature-header">
            <label>Signature</label>
            <button class="secondary-button small-button" type="button">Clear</button>
          </div>
          <canvas class="signature-pad storyboard-signature-pad" width="440" height="160" aria-label="Consent signature pad"></canvas>
          <p class="signature-summary">${onboarding.signature.has_signature ? `${onboarding.signature.stroke_count} signature stroke${onboarding.signature.stroke_count === 1 ? "" : "s"} captured` : "No signature captured"}</p>
        </div>
      </div>
    </section>
  `;
}

function inductionStoryboardMarkup(item) {
  return `
    <section class="assessment-page induction-section">
      <div class="induction-shell">
        <p class="induction-kicker" hidden></p>
        <h2>Instructions</h2>
        <div class="induction-placeholder">
          <span>Instructions</span>
          <strong>Instruction placeholder</strong>
          <div class="induction-audio">
            <small>Instructions</small>
            <b>Audio ready</b>
            <em>Please follow the instructions.</em>
          </div>
        </div>
        <p class="induction-summary">A short response section follows.</p>
      </div>
    </section>
  `;
}

function samStoryboardMarkup(assessment) {
  return `
    <section class="assessment-page sam-section" aria-label="How did you feel while during the previous tasks?">
      <p class="page-instruction">For each row, choose the picture that best matches how you felt during the previous session.</p>
      <div class="sam-rows">
        ${SAM_MANIKIN_ROWS.map((row) => `
          <div class="sam-row">
            <div class="row-label">
              <strong class="sam-row-question">${escapeHtml(row.question)}</strong>
            </div>
            <div class="sam-scale-row">
              <span class="sam-row-anchor sam-row-anchor-low" aria-label="${escapeHtml(row.low)}">${stackedLabelMarkup(row.low)}</span>
              <div class="sam-options">
                ${(row.options || Array.from({ length: 9 }, (_, index) => index + 1)).map((score) => {
                  return `
                    <button type="button" class="sam-choice" aria-label="${escapeHtml(`${row.question} ${score}`)}" aria-pressed="${assessment.sam[row.field] === score ? "true" : "false"}">
                      <img src="${samManikinImageUrl(row.id, score)}" alt="" draggable="false" data-sam-scale="${escapeHtml(row.id)}"${dominanceManikinStyleAttribute(row.id, score)}>
                      <span>${score}</span>
                    </button>
                  `;
                }).join("")}
              </div>
              <span class="sam-row-anchor sam-row-anchor-high" aria-label="${escapeHtml(row.high)}">${stackedLabelMarkup(row.high)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function vasStoryboardMarkup(assessment) {
  return `
    <section class="assessment-page slider-section" aria-label="Rate the previous experience">
      <p class="page-instruction">Touch both sliders, even if neutral</p>
      <div class="vas-slider-rows">
        ${AFFECT_VAS_SLIDERS.map((slider) => `
          <div class="slider-row vas-slider-row">
            <header class="vas-slider-header">
              <span class="vas-header-anchor vas-header-anchor-low">${slider.low}</span>
              <strong class="vas-question">${slider.question}</strong>
              <span class="vas-header-anchor vas-header-anchor-high">${slider.high}</span>
            </header>
            <div class="vas-scale">
              <div class="vas-range-shell">
                <input type="range" min="0" max="100" step="1" value="${assessment.affect_vas[slider.field]}" tabindex="-1" aria-label="${slider.question}">
                <span class="axis-midpoint" aria-hidden="true"></span>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function ekmanStoryboardMarkup(assessment) {
  return `
    <section class="assessment-page ekman-section">
      <div class="section-title">
        <h2>Which emotions did the particle motion remind you of? If it felt like a mix, rate how strongly each was represented.</h2>
      </div>
      <div class="ekman-slider-grid">
        ${EKMAN_EMOTIONS.map((emotion) => {
          const field = ekmanFieldId(emotion.id);
          return `
            <div class="slider-row ekman-slider-row">
              <header>
                <strong>${emotion.label}</strong>
                <span class="slider-value">${assessment.ekman_intensity[field]}</span>
              </header>
              <input type="range" min="0" max="100" step="1" value="${assessment.ekman_intensity[field]}" tabindex="-1">
              <div class="slider-axis"><span>Not represented</span><span>Clearly represented</span></div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function handEmbodimentStoryboardMarkup(assessment) {
  const languageCode = state.onboarding.language_code;
  return `
    <section class="assessment-page hand-embodiment-section" aria-label="${escapeHtml(HAND_EMBODIMENT_PROMPT)}">
      <div class="hand-likert-rows">
        ${HAND_EMBODIMENT_ITEMS.map((item) => `
          <div class="hand-likert-row">
            <strong class="hand-likert-question">${escapeHtml(localizedText(item.question, languageCode))}</strong>
            <div class="hand-likert-options">
              ${(item.options || Array.from({ length: 7 }, (_, index) => index + 1)).map((score) => `
                <button type="button" class="hand-likert-choice" aria-label="${escapeHtml(`${localizedText(item.question, languageCode)} ${score}`)}" aria-pressed="${assessment.hand_embodiment[item.field] === score ? "true" : "false"}">
                  <span class="likert-number">${score}</span>
                  <span class="likert-label">${escapeHtml(likertLabelFor(item, score, languageCode))}</span>
                </button>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function optionButtonsMarkup(options, selectedValue) {
  return options.map((option) => `
    <button type="button" aria-pressed="${option.id === selectedValue ? "true" : "false"}">${escapeHtml(option.label)}</button>
  `).join("");
}

function drawStoryboardCanvases() {
  document.querySelectorAll(".storyboard-polar-waveform").forEach((canvas) => {
    drawPolarWaveformCanvas(canvas, canvas.dataset.ready === "true");
  });
  document.querySelectorAll(".storyboard-signature-pad").forEach((canvas) => {
    drawSignatureCanvas(canvas, normalizeOnboarding(state.onboarding).signature.strokes || []);
  });
}

function markPageDirty(pageId) {
  const assessment = activeAssessment();
  assessment.page_complete[pageId] = false;
  assessment.complete = false;
}

function markAffectVasTouched(assessment, field) {
  assessment.affect_vas_touched = {
    ...defaultAffectVasTouched(),
    ...(assessment.affect_vas_touched || {}),
    [field]: true
  };
}

function markAffectVasTouchedAndRefresh(field) {
  const assessment = activeAssessment();
  markAffectVasTouched(assessment, field);
  renderValidation();
  renderExport();
}

function rangeValueFromPointer(input, event) {
  const rect = input.getBoundingClientRect();
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const step = Number(input.step || 1);
  const clampedX = Math.min(Math.max(event.clientX, rect.left), rect.right);
  const proportion = rect.width > 0 ? (clampedX - rect.left) / rect.width : 0;
  const rawValue = min + proportion * (max - min);
  const steppedValue = Number.isFinite(step) && step > 0
    ? min + Math.round((rawValue - min) / step) * step
    : rawValue;
  return Math.min(Math.max(Math.round(steppedValue), min), max);
}

function updateSliderValueDisplay(input) {
  const valueElement = document.getElementById(`${input.id}.value`);
  if (valueElement) {
    valueElement.textContent = input.value;
  }
}

function bindSmoothRangeDrag(input, applyValue) {
  const dragTarget = input.closest(".vas-range-shell") || input;
  let activePointerId = null;

  const updateFromPointer = (event) => {
    input.value = String(rangeValueFromPointer(input, event));
    applyValue();
  };

  dragTarget.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    event.preventDefault();
    activePointerId = event.pointerId;
    input.focus({ preventScroll: true });
    if (dragTarget.setPointerCapture) {
      dragTarget.setPointerCapture(activePointerId);
    }
    updateFromPointer(event);
  });

  dragTarget.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) {
      return;
    }
    event.preventDefault();
    updateFromPointer(event);
  });

  const finishDrag = (event) => {
    if (event.pointerId !== activePointerId) {
      return;
    }
    if (dragTarget.releasePointerCapture) {
      dragTarget.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
  };

  dragTarget.addEventListener("pointerup", finishDrag);
  dragTarget.addEventListener("pointercancel", finishDrag);
}

function renderSamRows() {
  const assessment = activeAssessment();
  elements.samRows.replaceChildren();
  SAM_MANIKIN_ROWS.forEach((row) => {
    const container = document.createElement("div");
    container.className = "sam-row";

    const label = document.createElement("div");
    label.className = "row-label";
    const question = document.createElement("strong");
    question.className = "sam-row-question";
    question.textContent = row.question;
    label.appendChild(question);
    container.appendChild(label);

    const scaleRow = document.createElement("div");
    scaleRow.className = "sam-scale-row";

    const lowAnchor = document.createElement("span");
    lowAnchor.className = "sam-row-anchor sam-row-anchor-low";
    appendStackedLabel(lowAnchor, row.low);
    scaleRow.appendChild(lowAnchor);

    const options = document.createElement("div");
    options.className = "sam-options";
    (row.options || Array.from({ length: 9 }, (_, index) => index + 1)).forEach((score) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sam-choice";
      button.id = `sam.${row.id}_${twoDigitScore(score)}`;
      button.dataset.itemId = row.item_id;
      button.dataset.variableName = row.variable_name;
      button.dataset.samField = row.field;
      button.dataset.samScore = String(score);
      button.setAttribute("aria-label", `${row.question} ${score}`);
      button.setAttribute("aria-pressed", String(assessment.sam[row.field] === score));

      const img = document.createElement("img");
      img.src = samManikinImageUrl(row.id, score);
      img.alt = "";
      img.draggable = false;
      img.dataset.samScale = row.id;
      if (row.id === "dominance") {
        img.dataset.samDisplay = "neutral-valence-scaled";
        img.style.setProperty("--sam-dominance-scale", dominanceManikinScale(score));
      }

      const number = document.createElement("span");
      number.textContent = String(score);

      button.appendChild(img);
      button.appendChild(number);
      options.appendChild(button);
    });
    scaleRow.appendChild(options);

    const highAnchor = document.createElement("span");
    highAnchor.className = "sam-row-anchor sam-row-anchor-high";
    appendStackedLabel(highAnchor, row.high);
    scaleRow.appendChild(highAnchor);

    container.appendChild(scaleRow);
    elements.samRows.appendChild(container);
  });
}

function renderVasSliders() {
  const assessment = activeAssessment();
  elements.sliderRows.replaceChildren();
  AFFECT_VAS_SLIDERS.forEach((slider) => {
    const row = document.createElement("div");
    row.className = "slider-row vas-slider-row";
    row.innerHTML = `
      <header class="vas-slider-header">
        <span class="vas-header-anchor vas-header-anchor-low">${slider.low}</span>
        <strong class="vas-question">${slider.question}</strong>
        <span class="vas-header-anchor vas-header-anchor-high">${slider.high}</span>
      </header>
      <div class="vas-scale">
        <div class="vas-range-shell">
          <input id="${slider.id}" type="range" min="0" max="100" step="1" value="${assessment.affect_vas[slider.field]}" aria-label="${slider.question}">
          <span class="axis-midpoint" aria-hidden="true"></span>
        </div>
      </div>
    `;
    const input = row.querySelector("input");
    const applyValue = () => {
      const currentAssessment = activeAssessment();
      markAffectVasTouched(currentAssessment, slider.field);
      currentAssessment.affect_vas[slider.field] = Number(input.value);
      updateSliderValueDisplay(input);
      markPageDirty("affect_vas");
      renderValidation();
      renderExport();
    };
    bindSmoothRangeDrag(input, applyValue);
    input.addEventListener("keydown", (event) => {
      if (VAS_INTERACTION_KEYS.has(event.key)) {
        markAffectVasTouchedAndRefresh(slider.field);
      }
    });
    input.addEventListener("input", applyValue);
    elements.sliderRows.appendChild(row);
  });
}

function renderEkmanSliders() {
  const assessment = activeAssessment();
  elements.ekmanSliderRows.replaceChildren();
  EKMAN_EMOTIONS.forEach((emotion) => {
    const field = ekmanFieldId(emotion.id);
    const row = document.createElement("div");
    row.className = "slider-row ekman-slider-row";
    row.innerHTML = `
      <header>
        <strong>${emotion.label}</strong>
        <span class="slider-value" id="ekman_intensity.${field}.value">${assessment.ekman_intensity[field]}</span>
      </header>
      <input id="ekman_intensity.${field}" type="range" min="0" max="100" step="1" value="${assessment.ekman_intensity[field]}" aria-label="${emotion.label}">
      <div class="slider-axis"><span>Not represented</span><span>Clearly represented</span></div>
    `;
    const input = row.querySelector("input");
    const applyValue = () => {
      const currentAssessment = activeAssessment();
      currentAssessment.ekman_intensity[field] = Number(input.value);
      updateSliderValueDisplay(input);
      markPageDirty("ekman_intensity");
      renderValidation();
      renderExport();
    };
    bindSmoothRangeDrag(input, applyValue);
    input.addEventListener("input", applyValue);
    elements.ekmanSliderRows.appendChild(row);
  });
}

function renderHandEmbodimentItems() {
  const assessment = activeAssessment();
  const languageCode = state.onboarding.language_code;
  elements.handEmbodimentRows.replaceChildren();
  HAND_EMBODIMENT_ITEMS.forEach((item) => {
    const row = document.createElement("div");
    row.className = "hand-likert-row";

    const question = document.createElement("strong");
    question.className = "hand-likert-question";
    question.textContent = localizedText(item.question, languageCode);
    row.appendChild(question);

    const options = document.createElement("div");
    options.className = "hand-likert-options";
    (item.options || Array.from({ length: 7 }, (_, index) => index + 1)).forEach((score) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hand-likert-choice";
      button.id = `${item.item_id}_${score}`;
      button.dataset.itemId = item.item_id;
      button.dataset.variableName = item.variable_name;
      button.dataset.handEmbodimentField = item.field;
      button.dataset.handEmbodimentScore = String(score);
      button.setAttribute("aria-label", `${localizedText(item.question, languageCode)} ${score}`);
      button.setAttribute("aria-pressed", String(assessment.hand_embodiment[item.field] === score));

      const number = document.createElement("span");
      number.className = "likert-number";
      number.textContent = String(score);

      const label = document.createElement("span");
      label.className = "likert-label";
      label.textContent = likertLabelFor(item, score, languageCode);

      button.appendChild(number);
      button.appendChild(label);
      options.appendChild(button);
    });
    row.appendChild(options);
    elements.handEmbodimentRows.appendChild(row);
  });
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  return { context, width: rect.width, height: rect.height };
}

function drawPolarWaveform() {
  drawPolarWaveformCanvas(elements.polarWaveform, polarIsReady(state.onboarding.polar_validation));
}

function drawPolarWaveformCanvas(canvas, ready) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) {
    return;
  }
  const { context, width, height } = prepared;
  const traceColor = ready ? "#127a3a" : "#a06a00";
  context.fillStyle = "rgba(255, 255, 255, 0.7)";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(71, 85, 105, 0.14)";
  context.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach((ratio) => {
    const y = height * ratio;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  });

  const count = 180;
  const baseline = height * 0.52;
  context.strokeStyle = traceColor;
  context.lineWidth = 2.2;
  context.lineCap = "round";
  context.beginPath();
  for (let index = 0; index < count; index += 1) {
    const phase = index % 45;
    const spike =
      phase === 12 ? -0.42 :
      phase === 13 ? 0.86 :
      phase === 14 ? -0.32 :
      phase > 25 && phase < 34 ? 0.18 * Math.sin((phase - 25) / 9 * Math.PI) :
      0;
    const wave = Math.sin(index * 0.22) * 0.08 + spike;
    const x = (index / (count - 1)) * width;
    const y = Math.max(4, Math.min(height - 4, baseline - wave * height * 0.42));
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
}

function drawSignaturePad() {
  drawSignatureCanvas(elements.signaturePad, [
    ...(state.onboarding.signature.strokes || []),
    ...(signatureDrawing.currentStroke.length > 0 ? [signatureDrawing.currentStroke] : [])
  ]);
}

function drawSignatureCanvas(canvas, strokes) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) {
    return;
  }
  const { context, width, height } = prepared;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#d9e2ec";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(18, height - 30);
  context.lineTo(width - 18, height - 30);
  context.stroke();

  context.strokeStyle = "#111827";
  context.lineWidth = 2.4;
  context.lineJoin = "round";
  context.lineCap = "round";
  strokes.forEach((stroke) => {
    if (!Array.isArray(stroke) || stroke.length === 0) {
      return;
    }
    context.beginPath();
    stroke.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
  });
}

function signaturePointFromEvent(event) {
  const rect = elements.signaturePad.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4))
  };
}

function commitSignatureStroke() {
  if (signatureDrawing.currentStroke.length === 0) {
    return;
  }
  const signature = normalizeSignature(state.onboarding.signature);
  signature.strokes.push(signatureDrawing.currentStroke);
  signature.stroke_count = signature.strokes.length;
  signature.has_signature = signature.stroke_count > 0;
  state.onboarding.signature = signature;
  state.onboarding.complete = false;
  signatureDrawing.currentStroke = [];
  render();
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function onboardingValidationErrors(onboarding = state.onboarding) {
  const normalized = normalizeOnboarding(onboarding);
  const errors = [];
  if (!polarIsReady(normalized.polar_validation)) {
    errors.push("Polar H10 ECG is not ready.");
  }
  if (!LANGUAGE_OPTIONS.some((option) => option.id === normalized.language_code)) {
    errors.push("Select language.");
  }
  if (normalized.participant_first_name.trim().length === 0) {
    errors.push("Enter first name.");
  }
  if (normalized.participant_last_name.trim().length === 0) {
    errors.push("Enter last name.");
  }
  if (!isIntegerInRange(normalized.age_years, 0, 120)) {
    errors.push("Enter age.");
  }
  if (!HANDEDNESS_OPTIONS.some((option) => option.id === normalized.handedness)) {
    errors.push("Select handedness.");
  }
  if (!GENDER_OPTIONS.some((option) => option.id === normalized.gender)) {
    errors.push("Select gender.");
  }
  if (!normalized.consent_confirmed) {
    errors.push("Confirm study consent.");
  }
  if (!normalized.signature.has_signature || normalized.signature.stroke_count <= 0) {
    errors.push("Draw consent signature.");
  }
  return errors;
}

function validationErrors(assessment = activeAssessment(), pageId = activePage().id) {
  const normalized = normalizeAssessment(assessment);
  const errors = [];
  if (pageId === "sam_pictographic") {
    SAM_MANIKIN_ROWS.forEach((row) => {
      if (!isIntegerInRange(normalized.sam[row.field], 1, 9)) {
        errors.push(`Select a picture for ${row.id}.`);
      }
    });
  }
  if (pageId === "affect_vas") {
    AFFECT_VAS_SLIDERS.forEach((slider) => {
      if (!isIntegerInRange(normalized.affect_vas[slider.field], 0, 100)) {
        errors.push(`VAS ${slider.field} must be 0..100.`);
      } else if (!normalized.affect_vas_touched[slider.field]) {
        errors.push(`Touch the ${slider.touchLabel} slider once.`);
      }
    });
  }
  if (pageId === "ekman_intensity") {
    EKMAN_EMOTIONS.forEach((emotion) => {
      const field = ekmanFieldId(emotion.id);
      if (!isIntegerInRange(normalized.ekman_intensity[field], 0, 100)) {
        errors.push(`${emotion.label} representation rating must be 0..100.`);
      }
    });
  }
  if (pageId === "hand_embodiment") {
    HAND_EMBODIMENT_ITEMS.forEach((item) => {
      if (!isIntegerInRange(normalized.hand_embodiment[item.field], 1, 7)) {
        errors.push(`Select a response for ${item.id}.`);
      }
    });
  }
  return errors;
}

function conditionValidationErrors(assessment = activeAssessment()) {
  return ASSESSMENT_PAGES.flatMap((page) => validationErrors(assessment, page.id));
}

function renderValidation() {
  const skipRequired = previewSkipRequiredEnabled();
  if (isOnboardingActive()) {
    const errors = onboardingValidationErrors();
    const hasBlockingErrors = errors.length > 0 && !skipRequired;
    elements.validationSummary.hidden = false;
    elements.validationSummary.classList.toggle("error", hasBlockingErrors);
    elements.validationSummary.textContent = hasBlockingErrors
      ? errors[0]
      : state.onboarding.complete
        ? "Onboarding marked complete"
        : "Ready to begin";
    elements.previousPage.disabled = true;
    elements.nextPage.disabled = hasBlockingErrors;
    elements.nextPage.textContent = "Begin";
    return;
  }
  if (isInductionActive()) {
    elements.validationSummary.hidden = false;
    elements.validationSummary.classList.remove("error");
    elements.validationSummary.textContent = "Ready to continue";
    elements.previousPage.disabled = false;
    elements.nextPage.disabled = false;
    elements.nextPage.textContent = "Continue";
    return;
  }
  const page = activePage();
  const assessment = activeAssessment();
  const errors = validationErrors(assessment, page.id);
  elements.validationSummary.hidden = true;
  elements.validationSummary.classList.remove("error");
  elements.validationSummary.textContent = "";
  elements.previousPage.disabled = false;
  elements.nextPage.disabled = errors.length > 0 && !skipRequired;
  elements.nextPage.textContent = activePageIndex() === ASSESSMENT_PAGES.length - 1
    ? state.active_condition_position < CONDITIONS.length
      ? "Continue"
      : (assessment.complete ? "Workflow marked complete" : "Mark workflow complete")
    : "Continue";
}

function pageGroups() {
  return QUESTIONNAIRE_PAGE_GROUPS.map((page) => ({
    ...page,
    groups: page.groups.map((group) => ({
      ...group,
      fields: [...group.fields]
    }))
  }));
}

function conditionBlockSequence() {
  return [INDUCTION_PAGE.id, ...ASSESSMENT_PAGES.map((page) => page.id)];
}

function expandedPreviewSequence(order = activeOrder()) {
  return [
    {
      stage: "onboarding",
      page_id: "onboarding",
      assessment_block_id: null,
      assessment_block_page: null,
      assessment_block_page_count: null,
      assessment_block_group: null
    },
    ...order.condition_ids.flatMap((conditionId, index) => {
      const conditionPosition = index + 1;
      return conditionBlockSequence().map((pageId) => {
        const pageNumber = assessmentPageNumber(pageId);
        const page = ASSESSMENT_PAGES.find((candidate) => candidate.id === pageId);
        return {
          block_position: conditionPosition,
          condition_position: conditionPosition,
          counterbalanced_condition_id: conditionId,
          condition_id: conditionId,
          audio_instruction_id: audioInstructionFor(conditionPosition).id,
          page_id: pageId,
          assessment_block_id: pageNumber ? `block_${conditionPosition}_assessment_block` : null,
          assessment_block_page: pageNumber,
          assessment_block_page_count: pageNumber ? ASSESSMENT_PAGES.length : null,
          assessment_block_group: page ? page.block_group : null
        };
      });
    })
  ];
}

function samSvgAssetPaths() {
  return [...new Set(SAM_MANIKIN_ROWS.flatMap((row) =>
    (row.options || Array.from({ length: 9 }, (_, index) => index + 1)).map((score) => samManikinImagePath(row.id, score))
  ))];
}

function audioInstructionAssetPaths() {
  return AUDIO_INSTRUCTION_SETS.flatMap((audio) => Object.values(audio.asset_paths));
}

function visualStoryboardExport(order = activeOrder()) {
  const items = storyboardItems(order);
  return {
    panel_count: items.length,
    frame: QUEST_PANEL_FRAME,
    interaction_states_visible: [
      "segmented selections",
      "consent checkbox",
      "signature strokes",
      "SAM pictographic choices",
      "VAS slider positions",
      "Ekman slider positions",
      "hand embodiment Likert selections",
      "footer navigation enabled/disabled states"
    ],
    panels: items.map((item, index) => ({
      panel_index: index + 1,
      page_id: item.page_id,
      block_position: item.condition_position || null,
      condition_position: item.condition_position || null,
      counterbalanced_condition_id: item.condition_id || null,
      condition_id: item.condition_id || null,
      audio_instruction_id: item.condition_position ? audioInstructionFor(item.condition_position).id : null,
      assessment_block_page: assessmentPageNumber(item.page_id),
      assessment_block_page_count: assessmentPageNumber(item.page_id) ? ASSESSMENT_PAGES.length : null,
      title: item.storyboard_title
    }))
  };
}

function previewAudioAssignments(order = activeOrder()) {
  return order.condition_ids.map((conditionId, index) => {
    const conditionPosition = index + 1;
    const audio = audioInstructionFor(conditionPosition);
    return {
      block_position: conditionPosition,
      condition_position: conditionPosition,
      counterbalanced_condition_id: conditionId,
      condition_id: conditionId,
      preview_audio_instruction_id: audio.id,
      preview_audio_instruction_label: audio.label,
      preview_audio_asset_paths: audio.asset_paths,
      assignment_mode: "runtime-randomized across the four blocks; preview shows a representative variant"
    };
  });
}

function updateResponsivePreviewScale() {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || QUEST_PANEL_FRAME.width_dp;
  const mobileViewport = viewportWidth <= 1140;
  const horizontalInset = viewportWidth <= 520 ? 20 : 24;
  const availableWidth = Math.max(280, viewportWidth - horizontalInset);
  const scale = mobileViewport
    ? Math.min(1, availableWidth / QUEST_PANEL_FRAME.width_dp)
    : 1;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--preview-scale", scale.toFixed(4));
  rootStyle.setProperty("--scaled-panel-width", `${Math.round(QUEST_PANEL_FRAME.width_dp * scale)}px`);
  rootStyle.setProperty("--scaled-panel-height", `${Math.round(QUEST_PANEL_FRAME.height_dp * scale)}px`);
}

function urlFlagEnabled(name) {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  return value === "1" || value === "true";
}

function previewControlsEnabled() {
  return urlFlagEnabled("previewControls");
}

function previewSkipRequiredEnabled() {
  return urlFlagEnabled("previewSkipRequired");
}

function applyPreviewControlsVisibility() {
  const showStoryboard = previewControlsEnabled();
  if (elements.storyboardSection) {
    elements.storyboardSection.hidden = !showStoryboard;
    elements.storyboardSection.setAttribute("aria-hidden", String(!showStoryboard));
  }
  if (!showStoryboard && elements.storyboardPanels) {
    elements.storyboardPanels.replaceChildren();
  }
}

function exportObject() {
  const order = activeOrder();
  return {
    panel_id: PANEL_ID,
    schema_version: SCHEMA_VERSION,
    quest_panel_frame: QUEST_PANEL_FRAME,
    terminology: {
      block_position: "presentation order position shown to the participant",
      condition_id: "counterbalanced condition assigned to a block",
      counterbalance_order_id: "mapping from block positions to counterbalanced conditions"
    },
    native_contract_authority: {
      protocol_version: "quest.questionnaire.v1",
      schema_id: `emotion-induction-sam-v${SCHEMA_VERSION}`,
      open_stage: activePanelPageId(),
      screen_sequence: WORKFLOW_PAGES.map((page) => page.id),
      onboarding_required_once: true,
      condition_block_sequence: conditionBlockSequence(),
      condition_assessment_sequence: ASSESSMENT_PAGES.map((page) => page.id),
      repeated_after_each_condition: true,
      result_owner: "caller-owned content URI"
    },
    preview_transfer_note: "Browser preview state is a layout and fixture artifact only. The Polar strip is a visual/native-state preview; native Android/Compose request parsing, H10 validation, result writing, focus, and headset validation remain authoritative.",
    questionnaire_item_library: QUESTIONNAIRE_ITEM_LIBRARY,
    control_model: CONTROL_MODEL,
    pages: pageGroups(),
    onboarding: normalizeOnboarding(state.onboarding),
    visual_storyboard: visualStoryboardExport(order),
    asset_manifest: {
      questionnaire_asset_catalog_path: "../questionnaire-assets/asset-catalog.json",
      sam_asset_catalog_path: `${SAM_ASSET_BASE_PATH}/asset-catalog.json`,
      sam_svg_paths: samSvgAssetPaths(),
      audio_instruction_asset_base_path: AUDIO_ASSET_BASE_PATH,
      audio_instruction_asset_paths: audioInstructionAssetPaths(),
      license_path: `${SAM_ASSET_BASE_PATH}/LICENSE-BSD-2-Clause.txt`
    },
    expanded_preview_sequence: expandedPreviewSequence(order),
    counterbalance: {
      order_id: order.id,
      condition_ids: order.condition_ids,
      block_condition_map: order.condition_ids.map((conditionId, index) => ({
        block_position: index + 1,
        condition_id: conditionId
      })),
      assignment_policy: "study runner/data logging assigns each participant to the least-filled counterbalance order from accumulated allocation counts; each order maps counterbalanced conditions onto block positions",
      equal_participant_allocation: true,
      visible_in_questionnaire_panel: false,
      editable_in_preview: false,
      editable_in_native_panel: false,
      participant_input_required: false
    },
    audio_instruction_randomization: {
      condition_order_policy: "counterbalance emotion scenario order through counterbalance.order_id",
      assignment_policy: "randomly shuffle the four audio instruction variants so each runtime block receives one variant",
      options: AUDIO_INSTRUCTION_SETS,
      preview_assignments: previewAudioAssignments(order)
    },
    active_panel_page_id: activePanelPageId(),
    active_block_position: state.active_condition_position,
    active_condition_position: state.active_condition_position,
    active_condition_id: activeConditionId(),
    active_assessment_page_id: activePage().id,
    responses_by_condition: order.condition_ids.map((conditionId, index) => {
      const response = responseFor(conditionId);
      return {
        block_position: index + 1,
        condition_position: index + 1,
        condition_id: conditionId,
        assessment: exportAssessment(response.assessment)
      };
    })
  };
}

function renderExport() {
  const text = JSON.stringify(exportObject(), null, 2);
  let exportNode = document.getElementById("previewExportJson");
  if (!exportNode) {
    exportNode = document.createElement("script");
    exportNode.type = "application/json";
    exportNode.id = "previewExportJson";
    document.body.appendChild(exportNode);
  }
  exportNode.textContent = text;
  if (!elements.jsonOutput) {
    return;
  }
  elements.jsonOutput.textContent = text;
}

window.STUDY6_QUESTIONNAIRE_PREVIEW = {
  exportObject,
  makeState,
  makeEdgeState,
  setState
};

if (elements.orderSelect) {
  elements.orderSelect.addEventListener("change", () => {
    state.counterbalance_order_id = elements.orderSelect.value;
    state.active_condition_position = 1;
    state.active_panel_page_id = "onboarding";
    state.active_assessment_page_id = "sam_pictographic";
    render();
  });
}

elements.previousPage.addEventListener("click", () => {
  if (isOnboardingActive()) {
    return;
  }
  if (isInductionActive()) {
    if (state.active_condition_position > 1) {
      const previousAssessmentPageId = ASSESSMENT_PAGES[ASSESSMENT_PAGES.length - 1].id;
      state.active_condition_position -= 1;
      state.active_panel_page_id = previousAssessmentPageId;
      state.active_assessment_page_id = previousAssessmentPageId;
    } else {
      state.active_panel_page_id = "onboarding";
    }
    render();
    return;
  }
  const index = activePageIndex();
  if (index > 0) {
    state.active_panel_page_id = ASSESSMENT_PAGES[index - 1].id;
    state.active_assessment_page_id = ASSESSMENT_PAGES[index - 1].id;
    render();
  } else {
    state.active_panel_page_id = "onboarding";
    render();
  }
});

elements.nextPage.addEventListener("click", () => {
  const skipRequired = previewSkipRequiredEnabled();
  if (isOnboardingActive()) {
    if (!skipRequired && onboardingValidationErrors().length > 0) {
      return;
    }
    state.onboarding.complete = true;
    state.active_panel_page_id = INDUCTION_PAGE.id;
    state.active_assessment_page_id = "sam_pictographic";
    render();
    return;
  }
  if (isInductionActive()) {
    state.active_panel_page_id = "sam_pictographic";
    state.active_assessment_page_id = "sam_pictographic";
    render();
    return;
  }
  const assessment = activeAssessment();
  const page = activePage();
  if (!skipRequired && validationErrors(assessment, page.id).length > 0) {
    return;
  }
  assessment.page_complete[page.id] = true;
  const index = activePageIndex();
  if (index < ASSESSMENT_PAGES.length - 1) {
    state.active_panel_page_id = ASSESSMENT_PAGES[index + 1].id;
    state.active_assessment_page_id = ASSESSMENT_PAGES[index + 1].id;
  } else {
    assessment.complete = skipRequired || conditionValidationErrors(assessment).length === 0 &&
      ASSESSMENT_PAGES.every((item) => assessment.page_complete[item.id]);
    if (assessment.complete && state.active_condition_position < CONDITIONS.length) {
      state.active_condition_position += 1;
      state.active_panel_page_id = INDUCTION_PAGE.id;
      state.active_assessment_page_id = "sam_pictographic";
    }
  }
  render();
});

function updateParticipantNameField(field, value) {
  state.onboarding[field] = value;
  state.onboarding.participant_name = combinedParticipantName(
    state.onboarding.participant_first_name,
    state.onboarding.participant_last_name
  );
  state.onboarding.complete = false;
  renderValidation();
  renderExport();
}

elements.participantFirstName.addEventListener("input", () => {
  updateParticipantNameField("participant_first_name", elements.participantFirstName.value);
});

elements.participantLastName.addEventListener("input", () => {
  updateParticipantNameField("participant_last_name", elements.participantLastName.value);
});

elements.participantAge.addEventListener("input", () => {
  const value = elements.participantAge.value.trim();
  state.onboarding.age_years = value === "" ? null : Number(value);
  state.onboarding.complete = false;
  renderValidation();
  renderExport();
});

elements.consentCheckbox.addEventListener("change", () => {
  state.onboarding.consent_confirmed = elements.consentCheckbox.checked;
  state.onboarding.complete = false;
  renderValidation();
  renderExport();
});

elements.samRows.addEventListener("click", (event) => {
  const button = event.target.closest(".sam-choice");
  if (!button || !elements.samRows.contains(button)) {
    return;
  }
  const field = button.dataset.samField;
  const score = Number.parseInt(button.dataset.samScore || "", 10);
  if (!field || !isIntegerInRange(score, 1, 9)) {
    return;
  }
  const assessment = activeAssessment();
  assessment.sam[field] = score;
  markPageDirty("sam_pictographic");
  render();
});

elements.handEmbodimentRows.addEventListener("click", (event) => {
  const button = event.target.closest(".hand-likert-choice");
  if (!button || !elements.handEmbodimentRows.contains(button)) {
    return;
  }
  const field = button.dataset.handEmbodimentField;
  const score = Number.parseInt(button.dataset.handEmbodimentScore || "", 10);
  if (!field || !isIntegerInRange(score, 1, 7)) {
    return;
  }
  const assessment = activeAssessment();
  assessment.hand_embodiment[field] = score;
  markPageDirty("hand_embodiment");
  render();
});

elements.signaturePad.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  elements.signaturePad.setPointerCapture(event.pointerId);
  signatureDrawing.active = true;
  signatureDrawing.currentStroke = [signaturePointFromEvent(event)];
  drawSignaturePad();
});

elements.signaturePad.addEventListener("pointermove", (event) => {
  if (!signatureDrawing.active) {
    return;
  }
  event.preventDefault();
  signatureDrawing.currentStroke.push(signaturePointFromEvent(event));
  drawSignaturePad();
});

function finishSignaturePointer(event) {
  if (!signatureDrawing.active) {
    return;
  }
  event.preventDefault();
  signatureDrawing.active = false;
  commitSignatureStroke();
}

elements.signaturePad.addEventListener("pointerup", finishSignaturePointer);
elements.signaturePad.addEventListener("pointercancel", finishSignaturePointer);

elements.clearSignature.addEventListener("click", () => {
  state.onboarding.signature = defaultSignature();
  state.onboarding.complete = false;
  signatureDrawing.currentStroke = [];
  render();
});

if (elements.loadDefault) {
  elements.loadDefault.addEventListener("click", () => setState(makeState()));
}

if (elements.loadEdge) {
  elements.loadEdge.addEventListener("click", () => setState(makeEdgeState()));
}

if (elements.exportState) {
  elements.exportState.addEventListener("click", async () => {
    const text = JSON.stringify(exportObject(), null, 2);
    if (elements.jsonOutput) {
      elements.jsonOutput.textContent = text;
    }
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {
        // Clipboard support varies for file:// previews; the JSON remains available to the caller.
      }
    }
  });
}

window.addEventListener("resize", updateResponsivePreviewScale);
window.addEventListener("orientationchange", updateResponsivePreviewScale);

updateResponsivePreviewScale();
applyPreviewControlsVisibility();
render();

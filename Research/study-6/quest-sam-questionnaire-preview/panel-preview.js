"use strict";

const PANEL_ID = "emotion_induction_sam_preview";
const SCHEMA_VERSION = 6;
const QUEST_PANEL_FRAME = { width_dp: 1080, height_dp: 720 };
const POLAR_ECG_SAMPLE_RATE_HZ = 130;
const CONSENT_TEXT = "I consent to participate in this study.";
const AUDIO_RANDOMIZATION_NOTE = "Emotion scenario order is counterbalanced; audio instruction variant is randomized at runtime.";
const AUDIO_ASSET_BASE_PATH = "../kuramoto-mesh-lab/audio-assets";

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
    label: "1/3",
    title: "How did you feel during the block?",
    summary: "Assessment block page 1 of 3",
    block_group: "Retrospective SAM valence and arousal pictographic rating"
  },
  {
    id: "affect_vas",
    label: "2/3",
    title: "Rate how you felt during the block",
    summary: "Assessment block page 2 of 3",
    block_group: "Retrospective valence and arousal visual analog scales 0-100"
  },
  {
    id: "ekman_intensity",
    label: "3/3",
    title: "To what degree were the emotions represented by the way the particles were moving?",
    summary: "Assessment block page 3 of 3",
    block_group: "Perceived Ekman emotion represented by particle movement 0-100"
  }
];

const INDUCTION_PAGE = {
  id: "emotion_induction_placeholder",
  label: "Instructions",
  title: "Block instructions",
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

const AFFECT_VAS_SLIDERS = [
  {
    id: "vas.valence_raw_0_100",
    label: "Negative - positive",
    question: "How positive or negative did you feel during the last session?",
    touchLabel: "valence",
    low: "Very negative",
    high: "Very positive",
    field: "valence_raw_0_100"
  },
  {
    id: "vas.arousal_raw_0_100",
    label: "Inactive - active",
    question: "How active or inactive did you feel during the last session?",
    touchLabel: "arousal",
    low: "Very inactive",
    high: "Very active",
    field: "arousal_raw_0_100"
  }
];

const SAM_MANIKIN_ROWS = [
  {
    id: "valence",
    label: "Negative - positive",
    low: "Very negative",
    high: "Very positive",
    field: "valence_raw_1_9"
  },
  {
    id: "arousal",
    label: "Inactive - active",
    low: "Very inactive",
    high: "Very active",
    field: "arousal_raw_1_9"
  }
];

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

const EKMAN_EMOTIONS = [
  { id: "anger", label: "Anger" },
  { id: "disgust", label: "Disgust" },
  { id: "fear", label: "Fear" },
  { id: "happiness", label: "Happiness" },
  { id: "sadness", label: "Sadness" },
  { id: "surprise", label: "Surprise" }
];

function ekmanFieldId(emotionId) {
  return `${emotionId}_raw_0_100`;
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

const CONTROL_MODEL = [
  {
    id: "onboarding.polar_validation.ready",
    label: "Polar H10 ECG validation",
    page: "onboarding",
    type: "readonly-status-strip",
    default: true,
    editable: "native-owned",
    validation: "native ready only when HR/RR stream, PMD, ECG stream, samples, and 130 Hz are present",
    native_state_field: "questionnaire_state.onboarding.polar_validation.ready",
    result_json_field: "answers.onboarding.polar_validation"
  },
  {
    id: "onboarding.language_code",
    label: "Language",
    page: "onboarding",
    type: "segmented",
    default: "en",
    options: LANGUAGE_OPTIONS.map((option) => option.id),
    editable: "editable",
    validation: "required; must be en or de",
    result_json_field: "answers.onboarding.language_code"
  },
  {
    id: "onboarding.participant_first_name",
    label: "First name",
    page: "onboarding",
    type: "text",
    default: "",
    editable: "editable",
    validation: "required non-empty text",
    result_json_field: "answers.onboarding.participant_first_name"
  },
  {
    id: "onboarding.participant_last_name",
    label: "Last name",
    page: "onboarding",
    type: "text",
    default: "",
    editable: "editable",
    validation: "required non-empty text",
    result_json_field: "answers.onboarding.participant_last_name"
  },
  {
    id: "onboarding.participant_name",
    label: "Full name",
    page: "onboarding",
    type: "readonly-derived",
    default: "",
    editable: "derived",
    validation: "derived from first and last name",
    result_json_field: "answers.onboarding.participant_name"
  },
  {
    id: "onboarding.age_years",
    label: "Age",
    page: "onboarding",
    type: "number",
    default: null,
    min: 0,
    max: 120,
    step: 1,
    editable: "editable",
    validation: "required integer 0..120",
    result_json_field: "answers.onboarding.age_years"
  },
  {
    id: "onboarding.handedness",
    label: "Handedness",
    page: "onboarding",
    type: "segmented",
    default: "",
    options: HANDEDNESS_OPTIONS.map((option) => option.id),
    editable: "editable",
    validation: "required; must be one handedness option id",
    result_json_field: "answers.onboarding.handedness"
  },
  {
    id: "onboarding.gender",
    label: "Gender",
    page: "onboarding",
    type: "segmented",
    default: "",
    options: GENDER_OPTIONS.map((option) => option.id),
    editable: "editable",
    validation: "required; must be one gender option id",
    result_json_field: "answers.onboarding.gender"
  },
  {
    id: "onboarding.consent_confirmed",
    label: "Study consent",
    page: "onboarding",
    type: "checkbox",
    default: false,
    editable: "editable",
    validation: "required; must be checked",
    result_json_field: "answers.onboarding.consent_confirmed"
  },
  {
    id: "onboarding.signature",
    label: "Consent signature",
    page: "onboarding",
    type: "signature-pad",
    default: { has_signature: false, stroke_count: 0 },
    editable: "editable",
    validation: "required signature stroke data",
    result_json_field: "answers.onboarding.signature"
  },
  {
    id: "counterbalance.order_id",
    label: "Counterbalance order",
    type: "select",
    default: "order_01",
    options: COUNTERBALANCE_ORDERS.map((order) => order.id),
    editable: "preview-only",
    validation: "must be one of counterbalance order ids",
    native_state_field: "questionnaire_state.counterbalance_order_id"
  },
  {
    id: "condition.active_index",
    label: "Active condition index",
    type: "segmented-preview-navigation",
    default: 1,
    min: 1,
    max: 4,
    step: 1,
    editable: "preview-only",
    validation: "must be 1..4",
    native_state_field: "questionnaire_state.condition_index"
  },
  {
    id: "condition.induction_placeholder",
    label: "Emotion induction placeholder",
    page: "emotion_induction_placeholder",
    type: "placeholder-stage",
    default: "condition-specific native induction",
    editable: "caller-owned",
    validation: "native app/caller owns induction timing, media, task state, completion, counterbalanced condition order, and randomized audio variant",
    native_state_field: "questionnaire_state.condition_induction_stage"
  },
  {
    id: "assessment.active_page_id",
    label: "Active assessment page",
    type: "segmented-preview-navigation",
    default: "sam_pictographic",
    options: ASSESSMENT_PAGES.map((page) => page.id),
    editable: "preview-only",
    validation: "must be one of assessment page ids",
    native_state_field: "questionnaire_state.open_stage"
  },
  {
    id: "sam.valence_raw_1_9",
    label: "Retrospective SAM valence",
    page: "sam_pictographic",
    type: "pictographic-choice",
    default: null,
    min: 1,
    max: 9,
    step: 1,
    options: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    editable: "editable",
    validation: "required integer 1..9",
    result_json_field: "answers.emotion_assessment.sam.valence_raw_1_9"
  },
  {
    id: "sam.arousal_raw_1_9",
    label: "Retrospective SAM arousal",
    page: "sam_pictographic",
    type: "pictographic-choice",
    default: null,
    min: 1,
    max: 9,
    step: 1,
    options: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    editable: "editable",
    validation: "required integer 1..9",
    result_json_field: "answers.emotion_assessment.sam.arousal_raw_1_9"
  },
  {
    id: "vas.valence_raw_0_100",
    label: "Retrospective valence VAS",
    page: "affect_vas",
    type: "range",
    default: 50,
    min: 0,
    max: 100,
    step: 1,
    center_marker: 50,
    question: "How positive or negative did you feel during the last session?",
    anchors: [
      { value: 0, label: "Very negative" },
      { value: 100, label: "Very positive" }
    ],
    editable: "editable",
    validation: "required integer 0..100; slider must be touched once before page completion",
    result_json_field: "answers.emotion_assessment.affect_vas.valence_raw_0_100"
  },
  {
    id: "vas.arousal_raw_0_100",
    label: "Retrospective arousal VAS",
    page: "affect_vas",
    type: "range",
    default: 50,
    min: 0,
    max: 100,
    step: 1,
    center_marker: 50,
    question: "How active or inactive did you feel during the last session?",
    anchors: [
      { value: 0, label: "Very inactive" },
      { value: 100, label: "Very active" }
    ],
    editable: "editable",
    validation: "required integer 0..100; slider must be touched once before page completion",
    result_json_field: "answers.emotion_assessment.affect_vas.arousal_raw_0_100"
  },
  ...EKMAN_EMOTIONS.map((emotion) => ({
    id: `ekman_intensity.${ekmanFieldId(emotion.id)}`,
    label: emotion.label,
    page: "ekman_intensity",
    type: "range",
    default: 0,
    min: 0,
    max: 100,
    step: 1,
    editable: "editable",
    validation: "required integer 0..100",
    result_json_field: `answers.emotion_assessment.ekman_intensity.${ekmanFieldId(emotion.id)}`
  }))
];

function defaultPageCompletion() {
  return Object.fromEntries(ASSESSMENT_PAGES.map((page) => [page.id, false]));
}

function defaultEkmanIntensity() {
  return Object.fromEntries(EKMAN_EMOTIONS.map((emotion) => [ekmanFieldId(emotion.id), 0]));
}

function defaultAffectVasTouched() {
  return Object.fromEntries(AFFECT_VAS_SLIDERS.map((slider) => [slider.field, false]));
}

function defaultAssessment() {
  return {
    sam: {
      valence_raw_1_9: null,
      arousal_raw_1_9: null
    },
    affect_vas: {
      valence_raw_0_100: 50,
      arousal_raw_0_100: 50
    },
    affect_vas_touched: defaultAffectVasTouched(),
    ekman_intensity: defaultEkmanIntensity(),
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
    assessment.affect_vas.valence_raw_0_100 = index === 3 ? 0 : 100;
    assessment.affect_vas.arousal_raw_0_100 = index === 3 ? 100 : 0;
    EKMAN_EMOTIONS.forEach((emotion, emotionIndex) => {
      assessment.ekman_intensity[ekmanFieldId(emotion.id)] = index === 3 ? emotionIndex * 20 : 100 - emotionIndex * 12;
    });
    assessment.page_complete.sam_pictographic = true;
    assessment.page_complete.affect_vas = true;
    assessment.page_complete.ekman_intensity = index < 3;
    assessment.complete = index < 3;
  });
  return state;
}

let state = makeState();

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
  samRows: document.getElementById("samRows"),
  samCompletion: document.getElementById("samCompletion"),
  sliderRows: document.getElementById("sliderRows"),
  ekmanSliderRows: document.getElementById("ekmanSliderRows"),
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
  inspector: document.querySelector(".inspector"),
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
  renderOrderSelect();
  renderConditionButtons();
  renderPageButtons();
  renderHeader();
  renderVisiblePage();
  renderOnboarding();
  renderInductionPlaceholder();
  renderSamRows();
  renderVasSliders();
  renderEkmanSliders();
  renderValidation();
  renderExport();
  renderStoryboard();
}

function renderOrderSelect() {
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
  if (isOnboardingActive()) {
    elements.conditionStatus.textContent = "Before block 1";
    elements.conditionLabel.textContent = "Setup";
    elements.pageLabel.textContent = "Setup";
    elements.pageTitle.textContent = "Before we begin";
    elements.pageCounter.textContent = "Onboarding";
    return;
  }
  if (isInductionActive()) {
    elements.conditionStatus.textContent = `Block ${state.active_condition_position} of 4`;
    elements.conditionLabel.textContent = `Block ${state.active_condition_position}`;
    elements.pageLabel.textContent = "Instructions";
    elements.pageTitle.textContent = `Block ${state.active_condition_position} instructions`;
    elements.pageCounter.textContent = `Block ${state.active_condition_position}`;
    return;
  }
  const conditionId = activeConditionId();
  const response = responseFor(conditionId);
  const page = activePage();
  response.assigned_position = state.active_condition_position;
  response.preview_condition_label = conditionLabelFor(conditionId);
  elements.conditionStatus.textContent = `Block ${state.active_condition_position} of 4 - ${page.summary}`;
  elements.conditionLabel.textContent = `Block ${state.active_condition_position}`;
  elements.pageLabel.textContent = page.label;
  elements.pageTitle.textContent = page.title;
  elements.pageCounter.textContent = page.summary;
}

function renderVisiblePage() {
  const pageId = activePanelPageId();
  elements.onboardingPage.hidden = pageId !== "onboarding";
  elements.inductionPage.hidden = pageId !== INDUCTION_PAGE.id;
  elements.samPage.hidden = pageId !== "sam_pictographic";
  elements.vasPage.hidden = pageId !== "affect_vas";
  elements.ekmanPage.hidden = pageId !== "ekman_intensity";
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
  const audio = audioInstructionFor(state.active_condition_position);
  elements.inductionKicker.textContent = `Block ${state.active_condition_position} of 4`;
  elements.inductionHeading.textContent = `Block ${state.active_condition_position} instructions`;
  elements.inductionConditionLabel.textContent = `Block ${state.active_condition_position}`;
  elements.inductionAudioLabel.textContent = `${audio.label} preview`;
  elements.inductionAudioSummary.textContent = "Runtime randomly selects one of the four instruction variants.";
  elements.inductionRandomizationNote.textContent = AUDIO_RANDOMIZATION_NOTE;
  renderAudioAssetLinks(elements.inductionAudioLinks, state.onboarding.language_code);
  elements.inductionSummary.textContent = "A short response section follows.";
}

function storyboardItems(order = activeOrder()) {
  return [
    {
      page_id: "onboarding",
      storyboard_title: "Onboarding",
      storyboard_subtitle: "Before block 1"
    },
    ...order.condition_ids.flatMap((conditionId, index) => {
      const conditionPosition = index + 1;
      return [
        {
          page_id: INDUCTION_PAGE.id,
          condition_id: conditionId,
          condition_position: conditionPosition,
          storyboard_title: `Block ${conditionPosition}: instructions`,
          storyboard_subtitle: "Emotion order counterbalanced; audio randomized"
        },
        ...ASSESSMENT_PAGES.map((page, pageIndex) => ({
          page_id: page.id,
          condition_id: conditionId,
          condition_position: conditionPosition,
          storyboard_title: `Block ${conditionPosition}: page ${pageIndex + 1} of 3`,
          storyboard_subtitle: `Response section page ${pageIndex + 1} of 3`
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
      sam: { valence_raw_1_9: null, arousal_raw_1_9: null },
      affect_vas: { valence_raw_0_100: 52, arousal_raw_0_100: 48 },
      affect_vas_touched: { valence_raw_0_100: true, arousal_raw_0_100: true },
      ekman_intensity: {
        anger_raw_0_100: 12,
        disgust_raw_0_100: 8,
        fear_raw_0_100: 18,
        happiness_raw_0_100: 38,
        sadness_raw_0_100: 16,
        surprise_raw_0_100: 24
      }
    },
    {
      sam: { valence_raw_1_9: null, arousal_raw_1_9: null },
      affect_vas: { valence_raw_0_100: 72, arousal_raw_0_100: 64 },
      affect_vas_touched: { valence_raw_0_100: true, arousal_raw_0_100: true },
      ekman_intensity: {
        anger_raw_0_100: 10,
        disgust_raw_0_100: 14,
        fear_raw_0_100: 26,
        happiness_raw_0_100: 68,
        sadness_raw_0_100: 12,
        surprise_raw_0_100: 46
      }
    },
    {
      sam: { valence_raw_1_9: null, arousal_raw_1_9: null },
      affect_vas: { valence_raw_0_100: 24, arousal_raw_0_100: 82 },
      affect_vas_touched: { valence_raw_0_100: true, arousal_raw_0_100: true },
      ekman_intensity: {
        anger_raw_0_100: 34,
        disgust_raw_0_100: 28,
        fear_raw_0_100: 74,
        happiness_raw_0_100: 8,
        sadness_raw_0_100: 42,
        surprise_raw_0_100: 58
      }
    },
    {
      sam: { valence_raw_1_9: null, arousal_raw_1_9: null },
      affect_vas: { valence_raw_0_100: 84, arousal_raw_0_100: 28 },
      affect_vas_touched: { valence_raw_0_100: true, arousal_raw_0_100: true },
      ekman_intensity: {
        anger_raw_0_100: 6,
        disgust_raw_0_100: 10,
        fear_raw_0_100: 12,
        happiness_raw_0_100: 78,
        sadness_raw_0_100: 8,
        surprise_raw_0_100: 36
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

function createStoryboardPanel(item) {
  const meta = storyboardPanelMeta(item);
  const panel = document.createElement("section");
  panel.className = "panel-frame storyboard-panel-frame";
  panel.setAttribute("aria-label", `${item.storyboard_title} panel`);
  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <p class="eyebrow">${escapeHtml(meta.conditionStatus)}</p>
        <h1>${escapeHtml(meta.pageTitle)}</h1>
      </div>
      <div class="header-chips">
        <div class="stage-chip">${escapeHtml(meta.conditionLabel)}</div>
        <div class="page-chip">${escapeHtml(meta.pageLabel)}</div>
      </div>
    </header>
    ${storyboardContentMarkup(item)}
    <footer class="panel-footer">
      <div>
        <p class="footer-label">${escapeHtml(meta.pageCounter)}</p>
        <p class="footer-status${meta.footerError ? " error" : ""}">${escapeHtml(meta.footerStatus)}</p>
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
      conditionStatus: "Before block 1",
      conditionLabel: "Setup",
      pageLabel: "Setup",
      pageTitle: "Before we begin",
      pageCounter: "Onboarding",
      footerStatus: errors.length > 0 ? errors[0] : "Ready to begin",
      footerError: errors.length > 0,
      backDisabled: true,
      nextDisabled: errors.length > 0,
      nextText: "Begin condition 1"
    };
  }

  if (item.page_id === INDUCTION_PAGE.id) {
    return {
      conditionStatus: `Block ${item.condition_position} of 4`,
      conditionLabel: `Block ${item.condition_position}`,
      pageLabel: "Instructions",
      pageTitle: `Block ${item.condition_position} instructions`,
      pageCounter: `Block ${item.condition_position}`,
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
  const pageIsComplete = assessment.page_complete[page.id];
  const isFinalAssessmentPage = page.id === "ekman_intensity";
  return {
    conditionStatus: `Block ${item.condition_position} of 4 - ${page.summary}`,
    conditionLabel: `Block ${item.condition_position}`,
    pageLabel: page.label,
    pageTitle: page.title,
    pageCounter: page.summary,
    footerStatus: errors.length > 0
      ? errors[0]
      : pageIsComplete
        ? "Page marked complete"
        : "Ready to continue",
    footerError: errors.length > 0,
    backDisabled: false,
    nextDisabled: errors.length > 0,
    nextText: isFinalAssessmentPage
      ? item.condition_position < CONDITIONS.length
        ? `Continue to condition ${item.condition_position + 1}`
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
  return ekmanStoryboardMarkup(assessment);
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
        <span>Required before block 1</span>
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
  const audio = audioInstructionFor(item.condition_position);
  const languageCode = normalizeOnboarding(state.onboarding).language_code;
  return `
    <section class="assessment-page induction-section">
      <div class="induction-shell">
        <p class="induction-kicker">Block ${item.condition_position} of 4</p>
        <h2>Block ${item.condition_position} instructions</h2>
        <div class="induction-placeholder">
          <span>Block ${item.condition_position}</span>
          <strong>Instruction placeholder</strong>
          <div class="induction-audio">
            <small>Instructions</small>
            <b>${escapeHtml(audio.label)} preview</b>
            <em>Runtime randomly selects one of the four instruction variants.</em>
            <p class="induction-randomization-note">${escapeHtml(AUDIO_RANDOMIZATION_NOTE)}</p>
            <div class="audio-asset-links" aria-label="Audio instruction assets">${audioAssetLinksMarkup(languageCode)}</div>
          </div>
        </div>
        <p class="induction-summary">A short response section follows.</p>
      </div>
    </section>
  `;
}

function samStoryboardMarkup(assessment) {
  return `
    <section class="assessment-page sam-section">
      <div class="section-title">
        <h2>Choose the pictures for how you felt</h2>
        <span>Think back to the condition just completed</span>
      </div>
      <p class="page-instruction">Select the SAM pictures that best match how you felt during the condition you just experienced.</p>
      <div class="sam-rows">
        ${SAM_MANIKIN_ROWS.map((row) => `
          <div class="sam-row">
            <div class="row-label"><strong>${row.label}</strong></div>
            <div class="sam-scale-row">
              <span class="sam-row-anchor sam-row-anchor-low">${row.low}</span>
              <div class="sam-options">
                ${Array.from({ length: 9 }, (_, index) => {
                  const score = index + 1;
                  return `
                    <button type="button" class="sam-choice" aria-label="${row.label} ${score}" aria-pressed="${assessment.sam[row.field] === score ? "true" : "false"}">
                      <img src="assets/sam/${row.id}/${row.id}-${score}.svg" alt="" draggable="false">
                      <span>${score}</span>
                    </button>
                  `;
                }).join("")}
              </div>
              <span class="sam-row-anchor sam-row-anchor-high">${row.high}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function vasStoryboardMarkup(assessment) {
  return `
    <section class="assessment-page slider-section">
      <div class="section-title">
        <h2>Rate how you felt during the condition</h2>
        <span>Touch both sliders, even if neutral</span>
      </div>
      <p class="page-instruction">Think back to the session you just completed, then answer both questions.</p>
      <div class="vas-slider-rows">
        ${AFFECT_VAS_SLIDERS.map((slider) => `
          <div class="slider-row vas-slider-row">
            <header class="vas-slider-header">
              <strong class="vas-question">${slider.question}</strong>
              <span class="slider-value">${assessment.affect_vas[slider.field]}</span>
            </header>
            <div class="vas-scale">
              <div class="vas-range-shell">
                <input type="range" min="0" max="100" step="1" value="${assessment.affect_vas[slider.field]}" tabindex="-1" aria-label="${slider.question}">
                <span class="axis-midpoint" aria-hidden="true"></span>
              </div>
              <div class="vas-axis-labels">
                <span class="vas-anchor vas-anchor-low">${slider.low}</span>
                <span aria-hidden="true"></span>
                <span class="vas-anchor vas-anchor-high">${slider.high}</span>
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
        <h2>Rate each emotion</h2>
        <span>Multiple emotions can apply</span>
      </div>
      <p class="page-instruction">If the movement felt like a mix, rate more than one emotion.</p>
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

function renderSamRows() {
  const assessment = activeAssessment();
  elements.samRows.replaceChildren();
  SAM_MANIKIN_ROWS.forEach((row) => {
    const container = document.createElement("div");
    container.className = "sam-row";

    const label = document.createElement("div");
    label.className = "row-label";
    label.innerHTML = `<strong>${row.label}</strong>`;
    container.appendChild(label);

    const scaleRow = document.createElement("div");
    scaleRow.className = "sam-scale-row";

    const lowAnchor = document.createElement("span");
    lowAnchor.className = "sam-row-anchor sam-row-anchor-low";
    lowAnchor.textContent = row.low;
    scaleRow.appendChild(lowAnchor);

    const options = document.createElement("div");
    options.className = "sam-options";
    for (let score = 1; score <= 9; score += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sam-choice";
      button.id = `sam.${row.id}.${score}`;
      button.dataset.samField = row.field;
      button.dataset.samScore = String(score);
      button.setAttribute("aria-label", `${row.label} ${score}`);
      button.setAttribute("aria-pressed", String(assessment.sam[row.field] === score));

      const img = document.createElement("img");
      img.src = `assets/sam/${row.id}/${row.id}-${score}.svg`;
      img.alt = "";
      img.draggable = false;

      const number = document.createElement("span");
      number.textContent = String(score);

      button.appendChild(img);
      button.appendChild(number);
      options.appendChild(button);
    }
    scaleRow.appendChild(options);

    const highAnchor = document.createElement("span");
    highAnchor.className = "sam-row-anchor sam-row-anchor-high";
    highAnchor.textContent = row.high;
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
        <strong class="vas-question">${slider.question}</strong>
        <span class="slider-value" id="${slider.id}.value">${assessment.affect_vas[slider.field]}</span>
      </header>
      <div class="vas-scale">
        <div class="vas-range-shell">
          <input id="${slider.id}" type="range" min="0" max="100" step="1" value="${assessment.affect_vas[slider.field]}" aria-label="${slider.question}">
          <span class="axis-midpoint" aria-hidden="true"></span>
        </div>
        <div class="vas-axis-labels">
          <span class="vas-anchor vas-anchor-low">${slider.low}</span>
          <span aria-hidden="true"></span>
          <span class="vas-anchor vas-anchor-high">${slider.high}</span>
        </div>
      </div>
    `;
    const input = row.querySelector("input");
    ["pointerdown", "mousedown", "touchstart", "click"].forEach((eventName) => {
      input.addEventListener(eventName, () => markAffectVasTouchedAndRefresh(slider.field));
    });
    input.addEventListener("keydown", (event) => {
      if (VAS_INTERACTION_KEYS.has(event.key)) {
        markAffectVasTouchedAndRefresh(slider.field);
      }
    });
    input.addEventListener("input", () => {
      const currentAssessment = activeAssessment();
      markAffectVasTouched(currentAssessment, slider.field);
      currentAssessment.affect_vas[slider.field] = Number(input.value);
      markPageDirty("affect_vas");
      render();
    });
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
    input.addEventListener("input", () => {
      const currentAssessment = activeAssessment();
      currentAssessment.ekman_intensity[field] = Number(input.value);
      markPageDirty("ekman_intensity");
      render();
    });
    elements.ekmanSliderRows.appendChild(row);
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
    if (!isIntegerInRange(normalized.sam.valence_raw_1_9, 1, 9)) {
      errors.push("Select SAM valence.");
    }
    if (!isIntegerInRange(normalized.sam.arousal_raw_1_9, 1, 9)) {
      errors.push("Select SAM arousal.");
    }
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
  return errors;
}

function conditionValidationErrors(assessment = activeAssessment()) {
  return ASSESSMENT_PAGES.flatMap((page) => validationErrors(assessment, page.id));
}

function renderValidation() {
  if (isOnboardingActive()) {
    const errors = onboardingValidationErrors();
    elements.validationSummary.classList.toggle("error", errors.length > 0);
    elements.validationSummary.textContent = errors.length > 0
      ? errors[0]
      : state.onboarding.complete
        ? "Onboarding marked complete"
        : "Ready to begin";
    elements.previousPage.disabled = true;
    elements.nextPage.disabled = errors.length > 0;
    elements.nextPage.textContent = "Begin condition 1";
    return;
  }
  if (isInductionActive()) {
    elements.validationSummary.classList.remove("error");
    elements.validationSummary.textContent = "Ready to begin assessment block";
    elements.previousPage.disabled = false;
    elements.nextPage.disabled = false;
    elements.nextPage.textContent = "Begin assessment block";
    return;
  }
  const page = activePage();
  const assessment = activeAssessment();
  const errors = validationErrors(assessment, page.id);
  const pageIsComplete = assessment.page_complete[page.id];
  elements.validationSummary.classList.toggle("error", errors.length > 0);
  elements.validationSummary.textContent = errors.length > 0
    ? errors[0]
    : pageIsComplete
      ? "Page marked complete"
      : "Ready to continue";
  elements.previousPage.disabled = false;
  elements.nextPage.disabled = errors.length > 0;
  elements.nextPage.textContent = activePageIndex() === ASSESSMENT_PAGES.length - 1
    ? state.active_condition_position < CONDITIONS.length
      ? `Continue to condition ${state.active_condition_position + 1}`
      : (assessment.complete ? "Workflow marked complete" : "Mark workflow complete")
    : "Continue";
}

function pageGroups() {
  return [
    {
      id: "onboarding",
      title: "Participant onboarding",
      groups: [
        { id: "polar_validation", fields: ["onboarding.polar_validation.ready"] },
        { id: "language", fields: ["onboarding.language_code"] },
        { id: "demographics", fields: ["onboarding.participant_first_name", "onboarding.participant_last_name", "onboarding.participant_name", "onboarding.age_years", "onboarding.handedness", "onboarding.gender"] },
        { id: "consent", fields: ["onboarding.consent_confirmed", "onboarding.consent_text", "onboarding.signature"] }
      ]
    },
    {
      id: "emotion_induction_placeholder",
      title: "Emotion induction placeholder",
      groups: [
        { id: "condition_induction", fields: ["condition.induction_placeholder"] }
      ]
    },
    {
      id: "sam_pictographic",
      title: "SAM: feelings during the condition",
      groups: [
        { id: "sam", fields: ["sam.valence_raw_1_9", "sam.arousal_raw_1_9"] }
      ]
    },
    {
      id: "affect_vas",
      title: "Retrospective valence and arousal VAS",
      groups: [
        { id: "affect_vas", fields: ["vas.valence_raw_0_100", "vas.arousal_raw_0_100"] }
      ]
    },
    {
      id: "ekman_intensity",
      title: "Particle movement emotion VAS",
      groups: [
        { id: "ekman_intensity", fields: EKMAN_EMOTIONS.map((emotion) => `ekman_intensity.${ekmanFieldId(emotion.id)}`) }
      ]
    }
  ];
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
  return ["valence", "arousal"].flatMap((dimension) =>
    Array.from({ length: 9 }, (_, index) => `assets/sam/${dimension}/${dimension}-${index + 1}.svg`)
  );
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
      assignment_mode: "runtime-randomized; preview shows a representative variant"
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

function previewControlsEnabled() {
  const params = new URLSearchParams(window.location.search);
  return params.get("previewControls") === "1";
}

function applyPreviewControlsVisibility() {
  const showControls = previewControlsEnabled();
  if (elements.inspector) {
    elements.inspector.hidden = !showControls;
    elements.inspector.setAttribute("aria-hidden", String(!showControls));
  }
  if (elements.storyboardSection) {
    elements.storyboardSection.hidden = !showControls;
    elements.storyboardSection.setAttribute("aria-hidden", String(!showControls));
  }
  if (!showControls && elements.storyboardPanels) {
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
    control_model: CONTROL_MODEL,
    pages: pageGroups(),
    onboarding: normalizeOnboarding(state.onboarding),
    visual_storyboard: visualStoryboardExport(order),
    asset_manifest: {
      sam_svg_paths: samSvgAssetPaths(),
      audio_instruction_asset_base_path: AUDIO_ASSET_BASE_PATH,
      audio_instruction_asset_paths: audioInstructionAssetPaths(),
      license_path: "assets/sam/LICENSE-BSD-2-Clause.txt"
    },
    expanded_preview_sequence: expandedPreviewSequence(order),
    counterbalance: {
      order_id: order.id,
      condition_ids: order.condition_ids,
      block_condition_map: order.condition_ids.map((conditionId, index) => ({
        block_position: index + 1,
        condition_id: conditionId
      })),
      assignment_policy: "assign participants evenly across counterbalance orders; each order maps counterbalanced conditions onto block positions",
      equal_participant_allocation: true,
      editable_in_preview: true,
      editable_in_native_panel: false
    },
    audio_instruction_randomization: {
      condition_order_policy: "counterbalance emotion scenario order through counterbalance.order_id",
      assignment_policy: "randomly assign one audio instruction variant per condition at runtime",
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
  elements.jsonOutput.textContent = JSON.stringify(exportObject(), null, 2);
}

elements.orderSelect.addEventListener("change", () => {
  state.counterbalance_order_id = elements.orderSelect.value;
  state.active_condition_position = 1;
  state.active_panel_page_id = "onboarding";
  state.active_assessment_page_id = "sam_pictographic";
  render();
});

elements.previousPage.addEventListener("click", () => {
  if (isOnboardingActive()) {
    return;
  }
  if (isInductionActive()) {
    if (state.active_condition_position > 1) {
      state.active_condition_position -= 1;
      state.active_panel_page_id = "ekman_intensity";
      state.active_assessment_page_id = "ekman_intensity";
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
  if (isOnboardingActive()) {
    if (onboardingValidationErrors().length > 0) {
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
  if (validationErrors(assessment, page.id).length > 0) {
    return;
  }
  assessment.page_complete[page.id] = true;
  const index = activePageIndex();
  if (index < ASSESSMENT_PAGES.length - 1) {
    state.active_panel_page_id = ASSESSMENT_PAGES[index + 1].id;
    state.active_assessment_page_id = ASSESSMENT_PAGES[index + 1].id;
  } else {
    assessment.complete = conditionValidationErrors(assessment).length === 0 &&
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

elements.loadDefault.addEventListener("click", () => setState(makeState()));
elements.loadEdge.addEventListener("click", () => setState(makeEdgeState()));
elements.exportState.addEventListener("click", async () => {
  const text = JSON.stringify(exportObject(), null, 2);
  elements.jsonOutput.textContent = text;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      // Clipboard support varies for file:// previews; the JSON remains visible.
    }
  }
});

window.addEventListener("resize", updateResponsivePreviewScale);
window.addEventListener("orientationchange", updateResponsivePreviewScale);

updateResponsivePreviewScale();
applyPreviewControlsVisibility();
render();

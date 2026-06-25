"use strict";

const PANEL_ID = "emotion_induction_sam_preview";
const SCHEMA_VERSION = 3;
const QUEST_PANEL_FRAME = { width_dp: 1080, height_dp: 720 };
const POLAR_ECG_SAMPLE_RATE_HZ = 130;
const CONSENT_TEXT = "I consent to participate in this study.";

const CONDITIONS = [
  { id: "induction_a", label: "Induction A" },
  { id: "induction_b", label: "Induction B" },
  { id: "induction_c", label: "Induction C" },
  { id: "induction_d", label: "Induction D" }
];

const COUNTERBALANCE_ORDERS = [
  { id: "order_01", label: "Order 01: A B D C", condition_ids: ["induction_a", "induction_b", "induction_d", "induction_c"] },
  { id: "order_02", label: "Order 02: B C A D", condition_ids: ["induction_b", "induction_c", "induction_a", "induction_d"] },
  { id: "order_03", label: "Order 03: C D B A", condition_ids: ["induction_c", "induction_d", "induction_b", "induction_a"] },
  { id: "order_04", label: "Order 04: D A C B", condition_ids: ["induction_d", "induction_a", "induction_c", "induction_b"] }
];

const AUDIO_INSTRUCTION_SETS = [
  { id: "audio_instruction_set_1", label: "Audio instruction set 1" },
  { id: "audio_instruction_set_2", label: "Audio instruction set 2" },
  { id: "audio_instruction_set_3", label: "Audio instruction set 3" },
  { id: "audio_instruction_set_4", label: "Audio instruction set 4" }
];

const ASSESSMENT_PAGES = [
  {
    id: "sam_pictographic",
    label: "SAM",
    title: "SAM: valence and arousal",
    summary: "Assessment block page 1 of 3",
    block_group: "SAM valence and arousal pictographic rating"
  },
  {
    id: "affect_vas",
    label: "VAS",
    title: "Valence and arousal VAS",
    summary: "Assessment block page 2 of 3",
    block_group: "Valence and arousal visual analog scales 0-100"
  },
  {
    id: "ekman_intensity",
    label: "Ekman",
    title: "Ekman emotion VAS",
    summary: "Assessment block page 3 of 3",
    block_group: "Ekman emotion intensity visual analog scales 0-100"
  }
];

const INDUCTION_PAGE = {
  id: "emotion_induction_placeholder",
  label: "Induct",
  title: "Emotion induction",
  summary: "Induction placeholder"
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
    participant_name: "",
    age_years: null,
    handedness: "",
    gender: "",
    consent_text: CONSENT_TEXT,
    signature: defaultSignature(),
    complete: false
  };
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
  return {
    ...base,
    ...raw,
    polar_validation: polar,
    language_code: LANGUAGE_OPTIONS.some((option) => option.id === raw.language_code) ? raw.language_code : base.language_code,
    participant_name: typeof raw.participant_name === "string" ? raw.participant_name : base.participant_name,
    age_years: age === null ? null : Number(age),
    handedness: typeof raw.handedness === "string" ? raw.handedness : base.handedness,
    gender: typeof raw.gender === "string" ? raw.gender : base.gender,
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
    id: "onboarding.participant_name",
    label: "Name",
    page: "onboarding",
    type: "text",
    default: "",
    editable: "editable",
    validation: "required non-empty text",
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
    validation: "native app/caller owns induction timing, media, task state, and completion",
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
    label: "SAM valence",
    page: "sam_pictographic",
    type: "pictographic-choice",
    default: 5,
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
    label: "SAM arousal",
    page: "sam_pictographic",
    type: "pictographic-choice",
    default: 5,
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
    label: "Valence VAS",
    page: "affect_vas",
    type: "range",
    default: 50,
    min: 0,
    max: 100,
    step: 1,
    editable: "editable",
    validation: "required integer 0..100",
    result_json_field: "answers.emotion_assessment.affect_vas.valence_raw_0_100"
  },
  {
    id: "vas.arousal_raw_0_100",
    label: "Arousal VAS",
    page: "affect_vas",
    type: "range",
    default: 50,
    min: 0,
    max: 100,
    step: 1,
    editable: "editable",
    validation: "required integer 0..100",
    result_json_field: "answers.emotion_assessment.affect_vas.arousal_raw_0_100"
  },
  ...EKMAN_EMOTIONS.map((emotion) => ({
    id: `ekman_intensity.${ekmanFieldId(emotion.id)}`,
    label: `${emotion.label} intensity`,
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

function defaultAssessment() {
  return {
    sam: {
      valence_raw_1_9: 5,
      arousal_raw_1_9: 5
    },
    affect_vas: {
      valence_raw_0_100: 50,
      arousal_raw_0_100: 50
    },
    ekman_intensity: defaultEkmanIntensity(),
    page_complete: defaultPageCompletion(),
    complete: false
  };
}

function normalizeAssessment(rawAssessment) {
  const base = defaultAssessment();
  const raw = rawAssessment || {};
  return {
    sam: {
      ...base.sam,
      ...(raw.sam || {})
    },
    affect_vas: {
      ...base.affect_vas,
      ...(raw.affect_vas || raw.sliders || {})
    },
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
    participant_name: "Preview Participant",
    age_years: 29,
    handedness: "left",
    gender: "prefer_not_to_say",
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
  participantName: document.getElementById("participantName"),
  participantAge: document.getElementById("participantAge"),
  handednessOptions: document.getElementById("handednessOptions"),
  genderOptions: document.getElementById("genderOptions"),
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
    elements.conditionStatus.textContent = "Before condition 1 - onboarding";
    elements.conditionLabel.textContent = "Study setup";
    elements.pageLabel.textContent = "Setup";
    elements.pageTitle.textContent = "Participant onboarding";
    elements.pageCounter.textContent = "Onboarding";
    return;
  }
  if (isInductionActive()) {
    const conditionId = activeConditionId();
    const label = conditionLabelFor(conditionId);
    elements.conditionStatus.textContent = `Condition ${state.active_condition_position} of 4 - induction`;
    elements.conditionLabel.textContent = label;
    elements.pageLabel.textContent = "Induct";
    elements.pageTitle.textContent = `Emotion induction technique ${state.active_condition_position}`;
    elements.pageCounter.textContent = `Condition ${state.active_condition_position} induction`;
    return;
  }
  const conditionId = activeConditionId();
  const response = responseFor(conditionId);
  const page = activePage();
  response.assigned_position = state.active_condition_position;
  response.preview_condition_label = conditionLabelFor(conditionId);
  elements.conditionStatus.textContent = `Condition ${state.active_condition_position} of 4 - ${page.summary}`;
  elements.conditionLabel.textContent = conditionLabelFor(conditionId);
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

  if (document.activeElement !== elements.participantName) {
    elements.participantName.value = onboarding.participant_name;
  }
  if (document.activeElement !== elements.participantAge) {
    elements.participantAge.value = onboarding.age_years === null || Number.isNaN(onboarding.age_years)
      ? ""
      : String(onboarding.age_years);
  }
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
  const conditionId = activeConditionId();
  const label = conditionLabelFor(conditionId);
  const audio = audioInstructionFor(state.active_condition_position);
  elements.inductionKicker.textContent = `Condition ${state.active_condition_position} of 4`;
  elements.inductionHeading.textContent = `Emotion induction technique ${state.active_condition_position}`;
  elements.inductionConditionLabel.textContent = label;
  elements.inductionAudioLabel.textContent = audio.label;
  elements.inductionAudioSummary.textContent = "Assigned at runtime for this condition.";
  elements.inductionSummary.textContent = "The SAM, valence/arousal VAS, and Ekman intensity block follows this condition.";
}

function storyboardItems(order = activeOrder()) {
  return [
    {
      page_id: "onboarding",
      storyboard_title: "Onboarding",
      storyboard_subtitle: "Study setup before condition 1"
    },
    ...order.condition_ids.flatMap((conditionId, index) => {
      const conditionPosition = index + 1;
      return [
        {
          page_id: INDUCTION_PAGE.id,
          condition_id: conditionId,
          condition_position: conditionPosition,
          storyboard_title: `Technique ${conditionPosition}: induction`,
          storyboard_subtitle: `${conditionLabelFor(conditionId)} - randomized audio instruction`
        },
        ...ASSESSMENT_PAGES.map((page, pageIndex) => ({
          page_id: page.id,
          condition_id: conditionId,
          condition_position: conditionPosition,
          storyboard_title: `Condition ${conditionPosition}: ${page.label}`,
          storyboard_subtitle: `${conditionLabelFor(conditionId)} - assessment block page ${pageIndex + 1} of 3`
        }))
      ];
    })
  ];
}

function storyboardOnboardingState() {
  return normalizeOnboarding({
    polar_validation: defaultPolarValidation(),
    language_code: "en",
    participant_name: "Preview Participant",
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
      sam: { valence_raw_1_9: 5, arousal_raw_1_9: 5 },
      affect_vas: { valence_raw_0_100: 52, arousal_raw_0_100: 48 },
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
      sam: { valence_raw_1_9: 7, arousal_raw_1_9: 6 },
      affect_vas: { valence_raw_0_100: 72, arousal_raw_0_100: 64 },
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
      sam: { valence_raw_1_9: 3, arousal_raw_1_9: 8 },
      affect_vas: { valence_raw_0_100: 24, arousal_raw_0_100: 82 },
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
      sam: { valence_raw_1_9: 8, arousal_raw_1_9: 3 },
      affect_vas: { valence_raw_0_100: 84, arousal_raw_0_100: 28 },
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
  if (!elements.storyboardPanels) {
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
      conditionStatus: "Before condition 1 - onboarding",
      conditionLabel: "Study setup",
      pageLabel: "Setup",
      pageTitle: "Participant onboarding",
      pageCounter: "Onboarding",
      footerStatus: errors.length > 0 ? errors[0] : "Ready to begin",
      footerError: errors.length > 0,
      backDisabled: true,
      nextDisabled: errors.length > 0,
      nextText: "Begin condition 1"
    };
  }

  const conditionLabel = conditionLabelFor(item.condition_id);
  if (item.page_id === INDUCTION_PAGE.id) {
    return {
      conditionStatus: `Condition ${item.condition_position} of 4 - induction`,
      conditionLabel,
      pageLabel: "Induct",
      pageTitle: `Emotion induction technique ${item.condition_position}`,
      pageCounter: `Condition ${item.condition_position} induction`,
      footerStatus: "Ready to begin assessment block",
      footerError: false,
      backDisabled: false,
      nextDisabled: false,
      nextText: "Begin assessment block"
    };
  }

  const page = ASSESSMENT_PAGES.find((candidate) => candidate.id === item.page_id) || ASSESSMENT_PAGES[0];
  const assessment = storyboardAssessmentFor(item.condition_position);
  const errors = validationErrors(assessment, page.id);
  const pageIsComplete = assessment.page_complete[page.id];
  const isFinalAssessmentPage = page.id === "ekman_intensity";
  return {
    conditionStatus: `Condition ${item.condition_position} of 4 - ${page.summary}`,
    conditionLabel,
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
        <h2>Participant onboarding</h2>
        <span>Required before condition 1</span>
      </div>

      <div class="onboarding-grid">
        <div class="onboarding-column">
          <div class="field-group">
            <label>Language</label>
            <div class="option-group two-options">${optionButtonsMarkup(LANGUAGE_OPTIONS, onboarding.language_code)}</div>
          </div>
          <div class="field-row">
            <label>Name</label>
            <input type="text" autocomplete="off" inputmode="text" value="${escapeHtml(onboarding.participant_name)}" readonly>
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
          <div class="consent-text">${escapeHtml(onboarding.consent_text)}</div>
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
  return `
    <section class="assessment-page induction-section">
      <div class="induction-shell">
        <p class="induction-kicker">Condition ${item.condition_position} of 4</p>
        <h2>Emotion induction technique ${item.condition_position}</h2>
        <div class="induction-placeholder">
          <span>${escapeHtml(conditionLabelFor(item.condition_id))}</span>
          <strong>Emotion induction placeholder</strong>
          <div class="induction-audio">
            <small>Randomized audio instructions</small>
            <b>${escapeHtml(audio.label)}</b>
            <em>Assigned at runtime for this condition.</em>
          </div>
        </div>
        <p class="induction-summary">The SAM, valence/arousal VAS, and Ekman intensity block follows this condition.</p>
      </div>
    </section>
  `;
}

function samStoryboardMarkup(assessment) {
  const rows = [
    { id: "valence", label: "Valence", low: "Unpleasant", high: "Pleasant", field: "valence_raw_1_9" },
    { id: "arousal", label: "Arousal", low: "Calm", high: "Excited", field: "arousal_raw_1_9" }
  ];
  return `
    <section class="assessment-page sam-section">
      <div class="section-title">
        <h2>SAM: valence and arousal</h2>
        <span>9-point pictographic</span>
      </div>
      <div class="sam-rows">
        ${rows.map((row) => `
          <div class="sam-row">
            <div class="row-label"><strong>${row.label}</strong><span>${row.low}</span><span>${row.high}</span></div>
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
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function vasStoryboardMarkup(assessment) {
  const sliders = [
    { id: "vas.valence_raw_0_100", label: "Valence", low: "Very unpleasant", high: "Very pleasant", field: "valence_raw_0_100" },
    { id: "vas.arousal_raw_0_100", label: "Arousal", low: "Very calm", high: "Very excited", field: "arousal_raw_0_100" }
  ];
  return `
    <section class="assessment-page slider-section">
      <div class="section-title">
        <h2>Valence and arousal VAS</h2>
        <span>0-100 visual analog scale</span>
      </div>
      <div class="vas-slider-rows">
        ${sliders.map((slider) => `
          <div class="slider-row vas-slider-row">
            <header>
              <strong>${slider.label}</strong>
              <span class="slider-value">${assessment.affect_vas[slider.field]}</span>
            </header>
            <input type="range" min="0" max="100" step="1" value="${assessment.affect_vas[slider.field]}" tabindex="-1">
            <div class="slider-axis"><span>${slider.low}</span><span>${slider.high}</span></div>
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
        <h2>Ekman emotion VAS</h2>
        <span>0-100 visual analog scale</span>
      </div>
      <p class="page-instruction">Rate the degree to which each emotion was felt during the previous experience.</p>
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
              <div class="slider-axis"><span>Not at all</span><span>Extremely</span></div>
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

function renderSamRows() {
  const assessment = activeAssessment();
  const rows = [
    {
      id: "valence",
      label: "Valence",
      low: "Unpleasant",
      high: "Pleasant",
      field: "valence_raw_1_9"
    },
    {
      id: "arousal",
      label: "Arousal",
      low: "Calm",
      high: "Excited",
      field: "arousal_raw_1_9"
    }
  ];
  elements.samRows.replaceChildren();
  rows.forEach((row) => {
    const container = document.createElement("div");
    container.className = "sam-row";

    const label = document.createElement("div");
    label.className = "row-label";
    label.innerHTML = `<strong>${row.label}</strong><span>${row.low}</span><span>${row.high}</span>`;
    container.appendChild(label);

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
    container.appendChild(options);
    elements.samRows.appendChild(container);
  });
}

function renderVasSliders() {
  const assessment = activeAssessment();
  const sliders = [
    {
      id: "vas.valence_raw_0_100",
      label: "Valence",
      low: "Very unpleasant",
      high: "Very pleasant",
      field: "valence_raw_0_100"
    },
    {
      id: "vas.arousal_raw_0_100",
      label: "Arousal",
      low: "Very calm",
      high: "Very excited",
      field: "arousal_raw_0_100"
    }
  ];
  elements.sliderRows.replaceChildren();
  sliders.forEach((slider) => {
    const row = document.createElement("div");
    row.className = "slider-row vas-slider-row";
    row.innerHTML = `
      <header>
        <strong>${slider.label}</strong>
        <span class="slider-value" id="${slider.id}.value">${assessment.affect_vas[slider.field]}</span>
      </header>
      <input id="${slider.id}" type="range" min="0" max="100" step="1" value="${assessment.affect_vas[slider.field]}">
      <div class="slider-axis"><span>${slider.low}</span><span>${slider.high}</span></div>
    `;
    const input = row.querySelector("input");
    input.addEventListener("input", () => {
      assessment.affect_vas[slider.field] = Number(input.value);
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
      <input id="ekman_intensity.${field}" type="range" min="0" max="100" step="1" value="${assessment.ekman_intensity[field]}">
      <div class="slider-axis"><span>Not at all</span><span>Extremely</span></div>
    `;
    const input = row.querySelector("input");
    input.addEventListener("input", () => {
      assessment.ekman_intensity[field] = Number(input.value);
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
  if (normalized.participant_name.trim().length === 0) {
    errors.push("Enter name.");
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
  if (!normalized.signature.has_signature || normalized.signature.stroke_count <= 0) {
    errors.push("Draw consent signature.");
  }
  return errors;
}

function validationErrors(assessment = activeAssessment(), pageId = activePage().id) {
  const errors = [];
  if (pageId === "sam_pictographic") {
    if (!isIntegerInRange(assessment.sam.valence_raw_1_9, 1, 9)) {
      errors.push("Select SAM valence.");
    }
    if (!isIntegerInRange(assessment.sam.arousal_raw_1_9, 1, 9)) {
      errors.push("Select SAM arousal.");
    }
  }
  if (pageId === "affect_vas") {
    ["valence_raw_0_100", "arousal_raw_0_100"].forEach((field) => {
      if (!isIntegerInRange(assessment.affect_vas[field], 0, 100)) {
        errors.push(`VAS ${field} must be 0..100.`);
      }
    });
  }
  if (pageId === "ekman_intensity") {
    EKMAN_EMOTIONS.forEach((emotion) => {
      const field = ekmanFieldId(emotion.id);
      if (!isIntegerInRange(assessment.ekman_intensity[field], 0, 100)) {
        errors.push(`${emotion.label} intensity must be 0..100.`);
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
        { id: "demographics", fields: ["onboarding.participant_name", "onboarding.age_years", "onboarding.handedness", "onboarding.gender"] },
        { id: "consent", fields: ["onboarding.consent_text", "onboarding.signature"] }
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
      title: "SAM: valence and arousal",
      groups: [
        { id: "sam", fields: ["sam.valence_raw_1_9", "sam.arousal_raw_1_9"] }
      ]
    },
    {
      id: "affect_vas",
      title: "Valence and arousal VAS",
      groups: [
        { id: "affect_vas", fields: ["vas.valence_raw_0_100", "vas.arousal_raw_0_100"] }
      ]
    },
    {
      id: "ekman_intensity",
      title: "Ekman emotion VAS",
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
          condition_position: conditionPosition,
          condition_id: conditionId,
          audio_instruction_id: audioInstructionFor(conditionPosition).id,
          page_id: pageId,
          assessment_block_id: pageNumber ? `condition_${conditionPosition}_assessment_block` : null,
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

function visualStoryboardExport(order = activeOrder()) {
  const items = storyboardItems(order);
  return {
    panel_count: items.length,
    frame: QUEST_PANEL_FRAME,
    interaction_states_visible: [
      "segmented selections",
      "signature strokes",
      "SAM pictographic choices",
      "VAS slider positions",
      "Ekman slider positions",
      "footer navigation enabled/disabled states"
    ],
    panels: items.map((item, index) => ({
      panel_index: index + 1,
      page_id: item.page_id,
      condition_position: item.condition_position || null,
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
      condition_position: conditionPosition,
      condition_id: conditionId,
      preview_audio_instruction_id: audio.id,
      preview_audio_instruction_label: audio.label,
      assignment_mode: "runtime-randomized"
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

function exportObject() {
  const order = activeOrder();
  return {
    panel_id: PANEL_ID,
    schema_version: SCHEMA_VERSION,
    quest_panel_frame: QUEST_PANEL_FRAME,
    native_contract_authority: {
      protocol_version: "quest.questionnaire.v1",
      schema_id: "emotion-induction-sam-v3",
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
      license_path: "assets/sam/LICENSE-BSD-2-Clause.txt"
    },
    expanded_preview_sequence: expandedPreviewSequence(order),
    counterbalance: {
      order_id: order.id,
      condition_ids: order.condition_ids,
      assignment_policy: "assign participants evenly across the four counterbalance orders",
      equal_participant_allocation: true,
      editable_in_preview: true,
      editable_in_native_panel: false
    },
    audio_instruction_randomization: {
      assignment_policy: "randomly assign one audio instruction set per condition at runtime",
      options: AUDIO_INSTRUCTION_SETS,
      preview_assignments: previewAudioAssignments(order)
    },
    active_panel_page_id: activePanelPageId(),
    active_condition_position: state.active_condition_position,
    active_condition_id: activeConditionId(),
    active_assessment_page_id: activePage().id,
    responses_by_condition: order.condition_ids.map((conditionId, index) => {
      const response = responseFor(conditionId);
      return {
        condition_position: index + 1,
        condition_id: conditionId,
        assessment: response.assessment
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

elements.participantName.addEventListener("input", () => {
  state.onboarding.participant_name = elements.participantName.value;
  state.onboarding.complete = false;
  renderValidation();
  renderExport();
});

elements.participantAge.addEventListener("input", () => {
  const value = elements.participantAge.value.trim();
  state.onboarding.age_years = value === "" ? null : Number(value);
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
render();

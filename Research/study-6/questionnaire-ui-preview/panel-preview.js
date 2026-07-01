"use strict";

const PANEL_ID = "study6_questionnaire_panel_preview";
const SCHEMA_VERSION = 8;
const QUEST_PANEL_FRAME = { width_dp: 1080, height_dp: 720 };
const POLAR_ECG_SAMPLE_RATE_HZ = 130;
const RECENT_POLAR_SAMPLE_COUNT = 260;
const REAL_POLAR_SOURCE = "polar_h10_android_ble_pmd";
const DEFAULT_LANGUAGE_CODE = "en";
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
  { id: "LC_LE", label: "Low coherence / low energy", coherence_level: "low", energy_noise_level: "low" },
  { id: "LC_HE", label: "Low coherence / high energy", coherence_level: "low", energy_noise_level: "high" },
  { id: "HC_LE", label: "High coherence / low energy", coherence_level: "high", energy_noise_level: "low" },
  { id: "HC_HE", label: "High coherence / high energy", coherence_level: "high", energy_noise_level: "high" }
];

const COUNTERBALANCE_ORDERS = [
  { id: "order_01", label: "Order 01: LC_LE LC_HE HC_HE HC_LE", condition_ids: ["LC_LE", "LC_HE", "HC_HE", "HC_LE"] },
  { id: "order_02", label: "Order 02: LC_HE HC_LE LC_LE HC_HE", condition_ids: ["LC_HE", "HC_LE", "LC_LE", "HC_HE"] },
  { id: "order_03", label: "Order 03: HC_LE HC_HE LC_HE LC_LE", condition_ids: ["HC_LE", "HC_HE", "LC_HE", "LC_LE"] },
  { id: "order_04", label: "Order 04: HC_HE LC_LE HC_LE LC_HE", condition_ids: ["HC_HE", "LC_LE", "HC_LE", "LC_HE"] }
];

function conditionFor(id) {
  return CONDITIONS.find((condition) => condition.id === id) || CONDITIONS[0];
}

function conditionExportFields(conditionId) {
  const condition = conditionFor(conditionId);
  return {
    condition_id: condition.id,
    vr_condition_id: condition.id,
    coherence_level: condition.coherence_level,
    energy_noise_level: condition.energy_noise_level
  };
}

function nullableConditionExportFields(conditionId) {
  return conditionId
    ? conditionExportFields(conditionId)
    : {
      condition_id: null,
      vr_condition_id: null,
      coherence_level: null,
      energy_noise_level: null
    };
}

function activeConditionExportFields() {
  const conditionFields = conditionExportFields(activeConditionId());
  return {
    active_condition_id: conditionFields.condition_id,
    active_vr_condition_id: conditionFields.vr_condition_id,
    active_coherence_level: conditionFields.coherence_level,
    active_energy_noise_level: conditionFields.energy_noise_level
  };
}

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
    id: "self_assessment_manikin",
    label: "1/4",
    title: "Self-Assessment Manikin pictographs",
    summary: "Assessment page 1 of 4: Self-Assessment Manikin pictographs",
    block_group: "Self-Assessment Manikin pictograph valence, arousal, and dominance/control"
  },
  {
    id: "affect_vas",
    label: "2/4",
    title: "Valence and arousal VAS",
    summary: "Assessment page 2 of 4: valence and arousal visual analog scales",
    block_group: "Retrospective valence and arousal VAS 0-100"
  },
  {
    id: "emotion_representation_vas",
    label: "3/4",
    title: "Particle emotion representation VAS",
    summary: "Assessment page 3 of 4: emotion representation visual analog scales",
    block_group: "Particle emotion representation VAS 0-100"
  },
  {
    id: "hand_embodiment",
    label: "4/4",
    title: "Virtual hand embodiment",
    summary: "Assessment page 4 of 4: virtual hand ownership and agency",
    block_group: "Adapted VEQ virtual hand ownership and agency ratings"
  }
];

const READY_PAGE = {
  id: "session_ready",
  label: "Ready",
  title: "Ready for next session",
  summary: "Participant readiness prompt before the next timed audio/condition block"
};

const INDUCTION_PAGE = {
  id: "vr_task_instructions",
  label: "Instructions",
  title: "VR task instructions",
  summary: "Five-minute VR task instructions and audio"
};

const WORKFLOW_PAGES = [
  {
    id: "demographics",
    title: "Demographics",
    summary: "Demographics, language, consent, and Polar H10 readiness"
  },
  READY_PAGE,
  INDUCTION_PAGE,
  ...ASSESSMENT_PAGES
];

const LANGUAGE_OPTIONS = [
  { id: "en", label: { en: "English", de: "Englisch" } },
  { id: "de", label: { en: "Deutsch", de: "Deutsch" } }
];

const HANDEDNESS_OPTIONS = [
  { id: "right", label: { en: "Right", de: "Rechts" } },
  { id: "left", label: { en: "Left", de: "Links" } },
  { id: "ambidextrous", label: { en: "Both", de: "Beide" } },
  { id: "prefer_not_to_say", label: { en: "Prefer not to say", de: "Keine Angabe" } }
];

const GENDER_OPTIONS = [
  { id: "male", label: { en: "Male", de: "Männlich" } },
  { id: "female", label: { en: "Female", de: "Weiblich" } },
  { id: "other", label: { en: "Other", de: "Divers" } },
  { id: "prefer_not_to_say", label: { en: "Prefer not to say", de: "Keine Angabe" } }
];

const UI_TEXT = {
  en: {
    "app.title": "Study 6 Questionnaire",
    "page.demographics.title": "Demographics",
    "page.demographics.subtitle": "Participant details, consent, and Polar H10 check",
    "page.ready.label": "Ready",
    "page.ready.title": "Ready for next session",
    "page.session_ready.title": "Ready for next session",
    "page.instructions.label": "Instructions",
    "page.instructions.title": "VR task instructions",
    "page.vr_task_instructions.title": "VR task instructions",
    "page.self_assessment_manikin.title": "Self-Assessment Manikin pictographs",
    "page.affect_vas.title": "Valence and arousal VAS",
    "page.emotion_representation_vas.title": "Particle emotion representation VAS",
    "page.hand_embodiment.title": "Virtual hand embodiment",
    "demographics.language": "Language",
    "demographics.first_name": "First name",
    "demographics.last_name": "Last name",
    "demographics.age": "Age",
    "demographics.handedness": "Handedness",
    "demographics.gender": "Gender",
    "consent.text": CONSENT_TEXT,
    "consent.aria": "Study consent",
    "polar.ready": "Polar H10 ECG ready",
    "polar.pending": "Polar H10 pending",
    "polar.detail": "HR {heartRate} bpm | RR {rrCount} | ECG {sampleCount} samples @ {sampleRate} Hz",
    "polar.id": "Polar ID: {device}",
    "polar.not_connected": "not connected",
    "polar.waiting": "Waiting for Polar H10 signal",
    "polar.searching": "Searching for nearby Polar H10",
    "polar.waiting_samples": "Waiting for live Polar ECG samples",
    "polar.waveform_aria": "Live Polar H10 ECG waveform",
    "session.count": "Session {position} of {total}",
    "session.ready_question": "Are you ready for the next part?",
    "session.vr_task": "VR task",
    "session.audio_will_start": "{audioLabel} will start when you press Start next session.",
    "induction.task_duration": "Five-minute task instructions",
    "induction.audio_guide": "Audio guide",
    "induction.audio_ready": "Audio ready",
    "induction.follow": "Please follow the instructions.",
    "induction.summary": "The assessment pages follow this task.",
    "audio.variant": "Audio variant {variant}",
    "sam.instruction": "For each row, choose the picture that best matches how you felt during the previous session.",
    "sam.page_aria": "Self-Assessment Manikin pictographs",
    "sam.valence.question": "How pleasant did this experience feel?",
    "sam.valence.low": "Unpleasant",
    "sam.valence.high": "Pleasant",
    "sam.arousal.question": "How activated did you feel?",
    "sam.arousal.low": "Low Energy",
    "sam.arousal.high": "High Energy",
    "sam.dominance.question": "How much control did you feel during your experience?",
    "sam.dominance.low": "Not in control",
    "sam.dominance.high": "In control",
    "vas.page_aria": "Valence and arousal VAS",
    "vas.valence.question": "How pleasant did the previous experience feel?",
    "vas.valence.low": "Unpleasant",
    "vas.valence.high": "Pleasant",
    "vas.valence.touch": "valence",
    "vas.arousal.question": "How activated did you feel in the previous experience?",
    "vas.arousal.low": "Low Energy",
    "vas.arousal.high": "High Energy",
    "vas.arousal.touch": "arousal",
    "emotion.heading": "Which emotions did the particle motion remind you of? If it felt like a mix, rate how strongly each was represented.",
    "emotion.aria": "Particle emotion representation VAS",
    "emotion.anger": "Anger",
    "emotion.disgust": "Disgust",
    "emotion.fear": "Fear",
    "emotion.happiness": "Happiness",
    "emotion.sadness": "Sadness",
    "emotion.surprise": "Surprise",
    "emotion.low": "Not represented",
    "emotion.high": "Clearly represented",
    "hand.prompt": HAND_EMBODIMENT_PROMPT,
    "hand.ownership.question": "It felt like the virtual hands were my own hands.",
    "hand.agency.question": "It felt like I was controlling the movements of the virtual hands.",
    "button.back": "Back",
    "button.begin": "Begin",
    "button.continue": "Continue",
    "button.start_next_session": "Start next session",
    "button.mark_complete": "Mark workflow complete",
    "button.marked_complete": "Workflow marked complete",
    "status.demographics_complete": "Demographics marked complete",
    "status.ready_to_begin": "Ready to begin",
    "status.waiting_to_start": "Waiting to start",
    "status.ready_to_continue": "Ready to continue",
    "validation.polar": "Polar H10 ECG is not ready.",
    "validation.language": "Select language.",
    "validation.first_name": "Enter first name.",
    "validation.last_name": "Enter last name.",
    "validation.age": "Enter age.",
    "validation.handedness": "Select handedness.",
    "validation.gender": "Select gender.",
    "validation.consent": "Confirm study consent.",
    "validation.sam": "Select a picture for {dimension}.",
    "validation.vas_range": "VAS {field} must be 0..100.",
    "validation.vas_touch": "Touch the {label} slider once.",
    "validation.emotion_range": "{label} representation rating must be 0..100.",
    "validation.hand": "Select a response for {item}.",
    "condition.LC_LE": "Low coherence / low energy",
    "condition.LC_HE": "Low coherence / high energy",
    "condition.HC_LE": "High coherence / low energy",
    "condition.HC_HE": "High coherence / high energy",
    "story.panel_count": "Panel {index} of {total}",
    "story.response_section": "Response section",
    "story.ready_subtitle": "Participant readiness prompt before audio starts",
    "story.instructions_subtitle": "Five-minute task instructions and audio"
  },
  de: {
    "app.title": "Studie 6 Fragebogen",
    "page.demographics.title": "Demografische Angaben",
    "page.demographics.subtitle": "Teilnehmerdaten, Einwilligung und Polar-H10-Prüfung",
    "page.ready.label": "Bereit",
    "page.ready.title": "Bereit für die nächste Sitzung",
    "page.session_ready.title": "Bereit für die nächste Sitzung",
    "page.instructions.label": "Anweisungen",
    "page.instructions.title": "VR-Aufgabenanweisungen",
    "page.vr_task_instructions.title": "VR-Aufgabenanweisungen",
    "page.self_assessment_manikin.title": "Self-Assessment-Manikin-Piktogramme",
    "page.affect_vas.title": "Valenz- und Aktivierungs-VAS",
    "page.emotion_representation_vas.title": "VAS zur Emotionsdarstellung der Partikel",
    "page.hand_embodiment.title": "Verkörperung der virtuellen Hände",
    "demographics.language": "Sprache",
    "demographics.first_name": "Vorname",
    "demographics.last_name": "Nachname",
    "demographics.age": "Alter",
    "demographics.handedness": "Händigkeit",
    "demographics.gender": "Geschlecht",
    "consent.text": "Ich willige ein, an dieser Studie teilzunehmen.",
    "consent.aria": "Einwilligung zur Studie",
    "polar.ready": "Polar-H10-EKG bereit",
    "polar.pending": "Polar-H10 ausstehend",
    "polar.detail": "HF {heartRate} bpm | RR {rrCount} | EKG {sampleCount} Samples @ {sampleRate} Hz",
    "polar.id": "Polar-ID: {device}",
    "polar.not_connected": "nicht verbunden",
    "polar.waiting": "Warten auf Polar-H10-Signal",
    "polar.searching": "Suche nach Polar H10 in der Naehe",
    "polar.waiting_samples": "Warten auf Live-EKG-Samples vom Polar H10",
    "polar.waveform_aria": "Live-EKG-Wellenform vom Polar H10",
    "session.count": "Sitzung {position} von {total}",
    "session.ready_question": "Sind Sie bereit für den nächsten Teil?",
    "session.vr_task": "VR-Aufgabe",
    "session.audio_will_start": "{audioLabel} startet, wenn Sie Nächste Sitzung starten drücken.",
    "induction.task_duration": "Fünfminütige Aufgabenanweisungen",
    "induction.audio_guide": "Audioanleitung",
    "induction.audio_ready": "Audio bereit",
    "induction.follow": "Bitte folgen Sie den Anweisungen.",
    "induction.summary": "Danach folgen die Bewertungsseiten.",
    "audio.variant": "Audiovariante {variant}",
    "sam.instruction": "Wählen Sie in jeder Zeile das Bild aus, das am besten beschreibt, wie Sie sich während der vorherigen Sitzung gefühlt haben.",
    "sam.page_aria": "Self-Assessment-Manikin-Piktogramme",
    "sam.valence.question": "Wie angenehm fühlte sich diese Erfahrung an?",
    "sam.valence.low": "Unangenehm",
    "sam.valence.high": "Angenehm",
    "sam.arousal.question": "Wie aktiviert fühlten Sie sich?",
    "sam.arousal.low": "Wenig aktiviert",
    "sam.arousal.high": "Stark aktiviert",
    "sam.dominance.question": "Wie viel Kontrolle hatten Sie während Ihrer Erfahrung?",
    "sam.dominance.low": "Keine Kontrolle",
    "sam.dominance.high": "Viel Kontrolle",
    "vas.page_aria": "Valenz- und Aktivierungs-VAS",
    "vas.valence.question": "Wie angenehm fühlte sich die vorherige Erfahrung an?",
    "vas.valence.low": "Unangenehm",
    "vas.valence.high": "Angenehm",
    "vas.valence.touch": "Valenz",
    "vas.arousal.question": "Wie aktiviert fühlten Sie sich in der vorherigen Erfahrung?",
    "vas.arousal.low": "Wenig aktiviert",
    "vas.arousal.high": "Stark aktiviert",
    "vas.arousal.touch": "Aktivierung",
    "emotion.heading": "An welche Emotionen erinnerte Sie die Partikelbewegung? Wenn es sich wie eine Mischung anfühlte, bewerten Sie, wie stark jede Emotion dargestellt war.",
    "emotion.aria": "VAS zur Emotionsdarstellung der Partikel",
    "emotion.anger": "Wut",
    "emotion.disgust": "Ekel",
    "emotion.fear": "Angst",
    "emotion.happiness": "Freude",
    "emotion.sadness": "Traurigkeit",
    "emotion.surprise": "Überraschung",
    "emotion.low": "Nicht dargestellt",
    "emotion.high": "Eindeutig dargestellt",
    "hand.prompt": "Fühlten sich die virtuellen Hände während der vorherigen Erfahrung wie Ihre echten Hände an? Geben Sie an, wie sehr Sie jeder Aussage zustimmen oder nicht zustimmen.",
    "hand.ownership.question": "Es fühlte sich so an, als wären die virtuellen Hände meine eigenen Hände.",
    "hand.agency.question": "Es fühlte sich so an, als würde ich die Bewegungen der virtuellen Hände kontrollieren.",
    "button.back": "Zurück",
    "button.begin": "Beginnen",
    "button.continue": "Weiter",
    "button.start_next_session": "Nächste Sitzung starten",
    "button.mark_complete": "Ablauf abschließen",
    "button.marked_complete": "Ablauf abgeschlossen",
    "status.demographics_complete": "Demografische Angaben abgeschlossen",
    "status.ready_to_begin": "Bereit zum Beginnen",
    "status.waiting_to_start": "Warten auf Start",
    "status.ready_to_continue": "Bereit zum Fortfahren",
    "validation.polar": "Das Polar-H10-EKG ist noch nicht bereit.",
    "validation.language": "Sprache auswählen.",
    "validation.first_name": "Vornamen eingeben.",
    "validation.last_name": "Nachnamen eingeben.",
    "validation.age": "Alter eingeben.",
    "validation.handedness": "Händigkeit auswählen.",
    "validation.gender": "Geschlecht auswählen.",
    "validation.consent": "Einwilligung zur Studie bestätigen.",
    "validation.sam": "Wählen Sie ein Bild für {dimension} aus.",
    "validation.vas_range": "VAS {field} muss zwischen 0 und 100 liegen.",
    "validation.vas_touch": "Berühren Sie den {label}-Schieberegler einmal.",
    "validation.emotion_range": "Die Bewertung für {label} muss zwischen 0 und 100 liegen.",
    "validation.hand": "Wählen Sie eine Antwort für {item} aus.",
    "condition.LC_LE": "Niedrige Kohärenz / niedrige Energie",
    "condition.LC_HE": "Niedrige Kohärenz / hohe Energie",
    "condition.HC_LE": "Hohe Kohärenz / niedrige Energie",
    "condition.HC_HE": "Hohe Kohärenz / hohe Energie",
    "story.panel_count": "Panel {index} von {total}",
    "story.response_section": "Antwortbereich",
    "story.ready_subtitle": "Bereitschaftsabfrage vor dem Start der Audioanleitung",
    "story.instructions_subtitle": "Fünfminütige Aufgabenanweisungen und Audio"
  }
};

const REQUIRED_SAM_DIMENSIONS = ["valence", "arousal", "dominance"];

function normalizeLanguageCode(languageCode) {
  return languageCode === "de" ? "de" : DEFAULT_LANGUAGE_CODE;
}

function currentLanguageCode() {
  return normalizeLanguageCode(state && state.demographics ? state.demographics.language_code : DEFAULT_LANGUAGE_CODE);
}

function uiText(key, languageCode = currentLanguageCode(), replacements = {}, fallback = "") {
  const language = normalizeLanguageCode(languageCode);
  const table = UI_TEXT[language] || UI_TEXT[DEFAULT_LANGUAGE_CODE];
  const template = table[key] || UI_TEXT[DEFAULT_LANGUAGE_CODE][key] || fallback || "";
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, token) => {
    const value = replacements[token];
    return value === undefined || value === null ? "" : String(value);
  });
}

function consentTextFor(languageCode = currentLanguageCode()) {
  return uiText("consent.text", languageCode, {}, CONSENT_TEXT);
}

function pageTitleFor(pageId, languageCode = currentLanguageCode(), fallback = "") {
  return uiText(`page.${pageId}.title`, languageCode, {}, fallback);
}

function displayConditionLabelFor(id, languageCode = currentLanguageCode()) {
  return uiText(`condition.${id}`, languageCode, {}, conditionFor(id).label);
}

function audioInstructionLabel(audio, languageCode = currentLanguageCode()) {
  const match = String(audio.id || "").match(/(\d+)$/);
  const variant = match ? `V${match[1].padStart(2, "0")}` : audio.label;
  return uiText("audio.variant", languageCode, { variant }, audio.label);
}

function localizedSamText(row, property, languageCode = currentLanguageCode()) {
  return uiText(`sam.${row.id}.${property}`, languageCode, {}, row[property]);
}

function localizedAffectVasText(slider, property, languageCode = currentLanguageCode()) {
  const key = slider.field.indexOf("arousal") === 0 ? "arousal" : "valence";
  return uiText(`vas.${key}.${property}`, languageCode, {}, slider[property]);
}

function localizedEmotionLabel(emotion, languageCode = currentLanguageCode()) {
  return uiText(`emotion.${emotion.id}`, languageCode, {}, emotion.label);
}

function localizedHandQuestion(item, languageCode = currentLanguageCode()) {
  return uiText(`hand.${item.id}.question`, languageCode, {}, localizedText(item.question, languageCode));
}

function labelForContainer(container) {
  if (!container || !container.closest) {
    return null;
  }
  const fieldGroup = container.closest(".field-group");
  return fieldGroup ? fieldGroup.querySelector("label") : null;
}

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
    throw new Error(`Self-Assessment Manikin pictograph rows must include valence, arousal, and dominance rows: ${details}.`);
  }
}

const SAM_MANIKIN_ROWS = QUESTIONNAIRE_ITEMS
  .filter((item) => item.page === "self_assessment_manikin" && item.type === "pictographic-choice")
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

const EMOTION_REPRESENTATION_ITEMS = QUESTIONNAIRE_ITEMS
  .filter((item) => item.page === "emotion_representation_vas" && item.response_namespace === "emotion_representation_vas")
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

function emotionRepresentationFieldId(emotionId) {
  const item = EMOTION_REPRESENTATION_ITEMS.find((emotion) => emotion.id === emotionId);
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
    source: "native_pending",
    state: "scanning",
    ready: false,
    detected: false,
    connected: false,
    streaming: false,
    pmd_ready: false,
    ecg_streaming: false,
    device_id: "",
    device_name: "",
    device_address: "",
    heart_rate_bpm: 0,
    rr_interval_count: 0,
    ecg_sample_count: 0,
    pmd_frame_count: 0,
    requested_mtu: 23,
    negotiated_mtu: 0,
    ecg_sample_rate_hz: POLAR_ECG_SAMPLE_RATE_HZ,
    ecg_resolution_bits: 14,
    pmd_control_point_indications_enabled: false,
    pmd_data_notifications_enabled: false,
    pmd_settings_received: false,
    pmd_start_response_received: false,
    recent_ecg_samples_uv: [],
    diagnostic: "Searching for nearby Polar H10",
    native_ready_rule: "source == polar_h10_android_ble_pmd && streaming && heart_rate_bpm > 0 && rr_interval_count > 0 && pmd_ready && ecg_streaming && ecg_sample_count > 0 && recent_ecg_samples_uv.length >= 2 && ecg_sample_rate_hz == 130"
  };
}

function defaultDemographics() {
  return {
    polar_validation: defaultPolarValidation(),
    language_code: DEFAULT_LANGUAGE_CODE,
    participant_first_name: "",
    participant_last_name: "",
    participant_name: "",
    age_years: null,
    handedness: "",
    gender: "",
    consent_confirmed: false,
    consent_text: consentTextFor(DEFAULT_LANGUAGE_CODE),
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

function normalizeDemographics(rawDemographics) {
  const base = defaultDemographics();
  const raw = rawDemographics || {};
  const { signature: _legacySignature, ...rawWithoutLegacySignature } = raw;
  const polar = {
    ...base.polar_validation,
    ...(raw.polar_validation || {})
  };
  if (!Array.isArray(polar.recent_ecg_samples_uv)) {
    polar.recent_ecg_samples_uv = [];
  } else {
    polar.recent_ecg_samples_uv = polar.recent_ecg_samples_uv
      .map((sample) => Number(sample))
      .filter((sample) => Number.isFinite(sample));
  }
  const age = raw.age_years === "" || raw.age_years === undefined ? null : raw.age_years;
  const legacyName = typeof raw.participant_name === "string" ? raw.participant_name : "";
  const splitName = splitParticipantName(legacyName);
  const rawFirstName = typeof raw.participant_first_name === "string" ? raw.participant_first_name : "";
  const rawLastName = typeof raw.participant_last_name === "string" ? raw.participant_last_name : "";
  const useLegacySplit = rawFirstName.trim().length === 0 && rawLastName.trim().length === 0 && legacyName.trim().length > 0;
  const firstName = useLegacySplit ? splitName.first : rawFirstName;
  const lastName = useLegacySplit ? splitName.last : rawLastName;
  const languageCode = normalizeLanguageCode(raw.language_code);
  return {
    ...base,
    ...rawWithoutLegacySignature,
    polar_validation: polar,
    language_code: languageCode,
    participant_first_name: firstName,
    participant_last_name: lastName,
    participant_name: combinedParticipantName(firstName, lastName),
    age_years: age === null ? null : Number(age),
    handedness: typeof raw.handedness === "string" ? raw.handedness : base.handedness,
    gender: typeof raw.gender === "string" ? raw.gender : base.gender,
    consent_confirmed: Boolean(raw.consent_confirmed),
    consent_text: consentTextFor(languageCode),
    complete: Boolean(raw.complete)
  };
}

function defaultPageCompletion() {
  return Object.fromEntries(ASSESSMENT_PAGES.map((page) => [page.id, false]));
}

function defaultEmotionRepresentationVas() {
  return Object.fromEntries(EMOTION_REPRESENTATION_ITEMS.map((emotion) => [emotionRepresentationFieldId(emotion.id), 0]));
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
    emotion_representation_vas: defaultEmotionRepresentationVas(),
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
    emotion_representation_vas: {
      ...base.emotion_representation_vas,
      ...(raw.emotion_representation_vas || {})
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
    emotion_representation_vas: normalized.emotion_representation_vas,
    hand_embodiment: normalized.hand_embodiment,
    page_complete: normalized.page_complete,
    complete: normalized.complete
  };
}

function makeState() {
  return {
    panel_id: PANEL_ID,
    schema_version: SCHEMA_VERSION,
    demographics: defaultDemographics(),
    counterbalance_order_id: "order_01",
    active_panel_page_id: "demographics",
    active_condition_position: 1,
    active_assessment_page_id: "self_assessment_manikin",
    responses_by_condition: CONDITIONS.map((condition, index) => ({
      condition_id: condition.id,
      vr_condition_id: condition.id,
      coherence_level: condition.coherence_level,
      energy_noise_level: condition.energy_noise_level,
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
  state.active_panel_page_id = "demographics";
  state.active_assessment_page_id = "emotion_representation_vas";
  state.demographics = normalizeDemographics({
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
    consent_confirmed: true
  });
  state.responses_by_condition.forEach((entry, index) => {
    const assessment = entry.assessment;
    assessment.sam.valence_raw_1_9 = index === 3 ? 1 : 9;
    assessment.sam.arousal_raw_1_9 = index === 3 ? 9 : 1;
    assessment.sam.dominance_raw_1_9 = index === 3 ? 1 : 9;
    assessment.affect_vas.valence_raw_0_100 = index === 3 ? 0 : 100;
    assessment.affect_vas.arousal_raw_0_100 = index === 3 ? 100 : 0;
    EMOTION_REPRESENTATION_ITEMS.forEach((emotion, emotionIndex) => {
      assessment.emotion_representation_vas[emotionRepresentationFieldId(emotion.id)] = index === 3 ? emotionIndex * 20 : 100 - emotionIndex * 12;
    });
    assessment.hand_embodiment.ownership_raw_1_7 = index === 3 ? 2 : 6;
    assessment.hand_embodiment.agency_raw_1_7 = index === 3 ? 3 : 7;
    assessment.page_complete.self_assessment_manikin = true;
    assessment.page_complete.affect_vas = true;
    assessment.page_complete.emotion_representation_vas = true;
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
  demographicsPage: document.getElementById("demographicsPage"),
  demographicsHeading: document.getElementById("demographicsHeading"),
  demographicsSubtitle: document.querySelector(".demographics-title span"),
  polarStatusCard: document.getElementById("polarStatusCard"),
  polarStatusTitle: document.getElementById("polarStatusTitle"),
  polarSignalDetail: document.getElementById("polarSignalDetail"),
  polarDeviceId: document.getElementById("polarDeviceId"),
  polarDiagnostic: document.getElementById("polarDiagnostic"),
  polarWaveform: document.getElementById("polarWaveform"),
  languageOptions: document.getElementById("languageOptions"),
  languageLabel: labelForContainer(document.getElementById("languageOptions")),
  participantFirstName: document.getElementById("participantFirstName"),
  participantFirstNameLabel: document.querySelector("label[for='participantFirstName']"),
  participantLastName: document.getElementById("participantLastName"),
  participantLastNameLabel: document.querySelector("label[for='participantLastName']"),
  participantAge: document.getElementById("participantAge"),
  participantAgeLabel: document.querySelector("label[for='participantAge']"),
  handednessOptions: document.getElementById("handednessOptions"),
  handednessLabel: labelForContainer(document.getElementById("handednessOptions")),
  genderOptions: document.getElementById("genderOptions"),
  genderLabel: labelForContainer(document.getElementById("genderOptions")),
  consentCheckbox: document.getElementById("consentCheckbox"),
  consentText: document.getElementById("consentText"),
  sessionReadyPage: document.getElementById("sessionReadyPage"),
  sessionReadyKicker: document.getElementById("sessionReadyKicker"),
  sessionReadyHeading: document.getElementById("sessionReadyHeading"),
  sessionReadyConditionLabel: document.getElementById("sessionReadyConditionLabel"),
  sessionReadyBlockLabel: document.getElementById("sessionReadyBlockLabel"),
  sessionReadyAudioLabel: document.getElementById("sessionReadyAudioLabel"),
  sessionReadyStart: document.getElementById("sessionReadyStart"),
  inductionPage: document.getElementById("inductionPage"),
  inductionKicker: document.getElementById("inductionKicker"),
  inductionHeading: document.getElementById("inductionHeading"),
  inductionConditionLabel: document.getElementById("inductionConditionLabel"),
  inductionAudioLabel: document.getElementById("inductionAudioLabel"),
  inductionAudioSummary: document.getElementById("inductionAudioSummary"),
  inductionRandomizationNote: document.getElementById("inductionRandomizationNote"),
  inductionAudioLinks: document.getElementById("inductionAudioLinks"),
  inductionSummary: document.getElementById("inductionSummary"),
  inductionTaskInstructions: document.querySelector("#inductionPage .induction-placeholder strong"),
  inductionAudioGuideLabel: document.querySelector("#inductionPage .induction-audio small"),
  samPage: document.getElementById("samPage"),
  samInstruction: document.querySelector("#samPage .page-instruction"),
  vasPage: document.getElementById("vasPage"),
  emotionRepresentationPage: document.getElementById("emotionRepresentationPage"),
  emotionRepresentationHeading: document.getElementById("emotionRepresentationHeading"),
  handEmbodimentPage: document.getElementById("handEmbodimentPage"),
  samRows: document.getElementById("samRows"),
  samCompletion: document.getElementById("samCompletion"),
  sliderRows: document.getElementById("sliderRows"),
  emotionRepresentationSliderRows: document.getElementById("emotionRepresentationSliderRows"),
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

function isDemographicsActive() {
  return activePanelPageId() === "demographics";
}

function isReadyActive() {
  return activePanelPageId() === READY_PAGE.id;
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
  return conditionFor(id).label;
}

function audioInstructionFor(conditionPosition) {
  return AUDIO_INSTRUCTION_SETS[(conditionPosition - 1) % AUDIO_INSTRUCTION_SETS.length];
}

function audioAssetPath(audio, languageCode = state.demographics.language_code) {
  const language = languageCode === "de" ? "de" : "en";
  return audio.asset_paths[language] || audio.asset_paths.en;
}

function audioAssetLinksMarkup(languageCode = state.demographics.language_code) {
  return AUDIO_INSTRUCTION_SETS.map((audio, index) => {
    const label = `V${String(index + 1).padStart(2, "0")}`;
    return `<a href="${escapeHtml(audioAssetPath(audio, languageCode))}" target="_blank" rel="noopener">${label}</a>`;
  }).join("");
}

function renderAudioAssetLinks(container, languageCode = state.demographics.language_code) {
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
    const condition = conditionFor(conditionId);
    response = {
      condition_id: condition.id,
      vr_condition_id: condition.id,
      coherence_level: condition.coherence_level,
      energy_noise_level: condition.energy_noise_level,
      preview_condition_label: condition.label,
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
    : "self_assessment_manikin";
  const panelPageId = WORKFLOW_PAGES.some((page) => page.id === copy.active_panel_page_id)
    ? copy.active_panel_page_id
    : "demographics";
  state = {
    ...makeState(),
    ...copy,
    demographics: normalizeDemographics(copy.demographics),
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

function setElementText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

function setElementAttribute(element, name, value) {
  if (element) {
    element.setAttribute(name, value);
  }
}

function renderLocalizedStaticText() {
  const languageCode = currentLanguageCode();
  document.documentElement.lang = languageCode;
  document.title = uiText("app.title", languageCode);

  setElementText(elements.demographicsHeading, uiText("page.demographics.title", languageCode));
  setElementText(elements.demographicsSubtitle, uiText("page.demographics.subtitle", languageCode));
  setElementText(elements.languageLabel, uiText("demographics.language", languageCode));
  setElementText(elements.participantFirstNameLabel, uiText("demographics.first_name", languageCode));
  setElementText(elements.participantLastNameLabel, uiText("demographics.last_name", languageCode));
  setElementText(elements.participantAgeLabel, uiText("demographics.age", languageCode));
  setElementText(elements.handednessLabel, uiText("demographics.handedness", languageCode));
  setElementText(elements.genderLabel, uiText("demographics.gender", languageCode));
  setElementText(elements.sessionReadyStart, uiText("button.start_next_session", languageCode));
  setElementText(elements.inductionTaskInstructions, uiText("induction.task_duration", languageCode));
  setElementText(elements.inductionAudioGuideLabel, uiText("induction.audio_guide", languageCode));
  setElementText(elements.samInstruction, uiText("sam.instruction", languageCode));
  setElementText(elements.emotionRepresentationHeading, uiText("emotion.heading", languageCode));

  setElementAttribute(elements.consentCheckbox, "aria-label", uiText("consent.aria", languageCode));
  setElementAttribute(elements.polarWaveform, "aria-label", uiText("polar.waveform_aria", languageCode));
  setElementAttribute(elements.samPage, "aria-label", uiText("sam.page_aria", languageCode));
  setElementAttribute(elements.vasPage, "aria-label", uiText("vas.page_aria", languageCode));
  setElementAttribute(elements.emotionRepresentationPage, "aria-label", uiText("emotion.aria", languageCode));
  setElementAttribute(elements.handEmbodimentPage, "aria-label", uiText("hand.prompt", languageCode));
}

function render() {
  renderLocalizedStaticText();
  renderHeader();
  renderVisiblePage();
  renderDemographics();
  renderSessionReady();
  renderInductionPlaceholder();
  renderSamRows();
  renderVasSliders();
  renderEmotionRepresentationSliders();
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
  const languageCode = currentLanguageCode();
  elements.conditionButtons.replaceChildren();
  const order = activeOrder();
  order.condition_ids.forEach((conditionId, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index + 1}. ${displayConditionLabelFor(conditionId, languageCode).replace("Induction ", "")}`;
    button.setAttribute("aria-pressed", String(index + 1 === state.active_condition_position));
    button.addEventListener("click", () => {
      state.active_condition_position = index + 1;
      state.active_panel_page_id = READY_PAGE.id;
      state.active_assessment_page_id = "self_assessment_manikin";
      render();
    });
    elements.conditionButtons.appendChild(button);
  });
}

function renderPageButtons() {
  if (!elements.pageButtons) {
    return;
  }
  const languageCode = currentLanguageCode();
  elements.pageButtons.replaceChildren();
  WORKFLOW_PAGES.forEach((page, index) => {
    const button = document.createElement("button");
    button.type = "button";
    const pageLabel = page.id === "demographics"
      ? uiText("page.demographics.title", languageCode)
      : pageTitleFor(page.id, languageCode, page.title);
    button.textContent = page.id === "demographics" ? pageLabel : `${index}. ${pageLabel}`;
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
  const languageCode = currentLanguageCode();
  elements.conditionStatus.textContent = "";
  elements.conditionStatus.hidden = true;
  if (isDemographicsActive()) {
    const demographicsTitle = uiText("page.demographics.title", languageCode);
    elements.conditionLabel.textContent = demographicsTitle;
    elements.pageLabel.textContent = demographicsTitle;
    elements.pageTitle.textContent = demographicsTitle;
    elements.pageCounter.textContent = "";
    elements.pageCounter.hidden = true;
    return;
  }
  if (isReadyActive()) {
    elements.conditionLabel.textContent = "";
    elements.pageLabel.textContent = uiText("page.ready.label", languageCode);
    elements.pageTitle.textContent = uiText("page.ready.title", languageCode);
    elements.pageCounter.textContent = "";
    elements.pageCounter.hidden = true;
    return;
  }
  if (isInductionActive()) {
    elements.conditionLabel.textContent = "";
    elements.pageLabel.textContent = uiText("page.instructions.label", languageCode);
    elements.pageTitle.textContent = uiText("page.instructions.title", languageCode);
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
  elements.pageTitle.textContent = pageTitleFor(page.id, languageCode, page.title);
  elements.pageCounter.textContent = "";
  elements.pageCounter.hidden = true;
}

function renderVisiblePage() {
  const pageId = activePanelPageId();
  elements.demographicsPage.hidden = pageId !== "demographics";
  elements.sessionReadyPage.hidden = pageId !== READY_PAGE.id;
  elements.inductionPage.hidden = pageId !== INDUCTION_PAGE.id;
  elements.samPage.hidden = pageId !== "self_assessment_manikin";
  elements.vasPage.hidden = pageId !== "affect_vas";
  elements.emotionRepresentationPage.hidden = pageId !== "emotion_representation_vas";
  elements.handEmbodimentPage.hidden = pageId !== "hand_embodiment";
}

function realPolarSamples(polar = state.demographics.polar_validation) {
  return Array.isArray(polar.recent_ecg_samples_uv)
    ? polar.recent_ecg_samples_uv.map((sample) => Number(sample)).filter((sample) => Number.isFinite(sample))
    : [];
}

function polarHasRealNativeSamples(polar = state.demographics.polar_validation) {
  return String(polar.source || "") === REAL_POLAR_SOURCE && realPolarSamples(polar).length >= 2;
}

function polarIsReady(polar = state.demographics.polar_validation) {
  return Boolean(
    String(polar.source || "") === REAL_POLAR_SOURCE &&
      polar.ready &&
      polar.streaming &&
      polar.heart_rate_bpm > 0 &&
      polar.rr_interval_count > 0 &&
      polar.pmd_ready &&
      polar.ecg_streaming &&
      polar.ecg_sample_count > 0 &&
      polarHasRealNativeSamples(polar) &&
      polar.ecg_sample_rate_hz === POLAR_ECG_SAMPLE_RATE_HZ
  );
}

function polarDeviceLabel(polar = state.demographics.polar_validation, languageCode = currentLanguageCode()) {
  const deviceId = String(polar.device_id || "").trim();
  if (deviceId) {
    return deviceId;
  }
  const name = String(polar.device_name || "").trim();
  const address = String(polar.device_address || "").trim();
  if (name && address) {
    return `${name} [${address}]`;
  }
  return name || address || uiText("polar.not_connected", languageCode);
}

function polarWaitingMessage(polar = state.demographics.polar_validation, languageCode = currentLanguageCode()) {
  if (polar.connected || polar.streaming || polar.pmd_ready || polar.ecg_streaming || realPolarSamples(polar).length > 0) {
    return uiText("polar.waiting_samples", languageCode);
  }
  return uiText("polar.searching", languageCode);
}

function localizedPolarDiagnostic(polar, ready, languageCode = currentLanguageCode()) {
  const diagnostic = String(ready ? (polar.diagnostic || "") : (polar.diagnostic || polar.state || "")).trim();
  if (!ready && !polar.connected && !polar.detected) {
    return uiText("polar.searching", languageCode);
  }
  if (languageCode !== "de") {
    return diagnostic || uiText("polar.waiting", languageCode);
  }
  const mtuMatch = diagnostic.match(/^PMD ready \| ECG streaming \| MTU (.+)$/);
  if (mtuMatch) {
    return `PMD bereit | EKG-Streaming | MTU ${mtuMatch[1]}`;
  }
  const germanDiagnostics = {
    "ECG stream waiting for samples": "EKG-Stream wartet auf Samples",
    "Waiting for Polar H10 signal": "Warten auf Polar-H10-Signal",
    waiting_for_polar_h10: "Warten auf Polar-H10-Signal",
    native_pending: "Native Polar-H10-Prüfung ausstehend",
    created: "Polar-H10-Prüfung vorbereitet",
    permissions_missing: "Bluetooth-Berechtigungen fehlen",
    bluetooth_unavailable: "Bluetooth nicht verfügbar",
    bluetooth_off: "Bluetooth ausgeschaltet",
    scanning: "Suche nach Polar H10",
    connecting: "Verbindung zu Polar H10 wird hergestellt",
    connected: "Polar H10 verbunden",
    pmd_ready: "Polar-PMD bereit",
    streaming: "EKG-Streaming",
    stopped: "Gestoppt",
    closed: "Geschlossen",
    scan_timeout: "Polar-H10-Suche abgelaufen"
  };
  return germanDiagnostics[diagnostic] || diagnostic || uiText("polar.waiting", languageCode);
}

function renderDemographics() {
  state.demographics = normalizeDemographics(state.demographics);
  const demographics = state.demographics;
  const languageCode = demographics.language_code;
  const polar = demographics.polar_validation;
  const ready = polarIsReady(polar);

  elements.polarStatusCard.classList.toggle("ready", ready);
  elements.polarStatusCard.classList.toggle("waiting", !ready);
  elements.polarStatusTitle.textContent = ready ? uiText("polar.ready", languageCode) : polarWaitingMessage(polar, languageCode);
  elements.polarSignalDetail.textContent = ready
    ? uiText("polar.detail", languageCode, {
        heartRate: polar.heart_rate_bpm,
        rrCount: polar.rr_interval_count,
        sampleCount: polar.ecg_sample_count,
        sampleRate: polar.ecg_sample_rate_hz
      })
    : polarWaitingMessage(polar, languageCode);
  elements.polarDeviceId.textContent = uiText("polar.id", languageCode, { device: polarDeviceLabel(polar, languageCode) });
  elements.polarDiagnostic.textContent = localizedPolarDiagnostic(polar, ready, languageCode);

  renderOptionGroup(elements.languageOptions, LANGUAGE_OPTIONS, demographics.language_code, "demographics.language", (value) => {
    demographics.language_code = value;
    demographics.consent_text = consentTextFor(value);
    demographics.complete = false;
  });
  renderOptionGroup(elements.handednessOptions, HANDEDNESS_OPTIONS, demographics.handedness, "demographics.handedness", (value) => {
    demographics.handedness = value;
    demographics.complete = false;
  });
  renderOptionGroup(elements.genderOptions, GENDER_OPTIONS, demographics.gender, "demographics.gender", (value) => {
    demographics.gender = value;
    demographics.complete = false;
  });

  if (document.activeElement !== elements.participantFirstName) {
    elements.participantFirstName.value = demographics.participant_first_name;
  }
  if (document.activeElement !== elements.participantLastName) {
    elements.participantLastName.value = demographics.participant_last_name;
  }
  if (document.activeElement !== elements.participantAge) {
    elements.participantAge.value = demographics.age_years === null || Number.isNaN(demographics.age_years)
      ? ""
      : String(demographics.age_years);
  }
  elements.consentCheckbox.checked = demographics.consent_confirmed;
  elements.consentText.textContent = demographics.consent_text;

  window.requestAnimationFrame(() => {
    drawPolarWaveform();
  });
}

function renderOptionGroup(container, options, selectedValue, idPrefix, onSelect, languageCode = currentLanguageCode()) {
  container.replaceChildren();
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = `${idPrefix}.${option.id}`;
    button.textContent = localizedText(option.label, languageCode);
    button.setAttribute("aria-pressed", String(option.id === selectedValue));
    button.addEventListener("click", () => {
      onSelect(option.id);
      render();
    });
    container.appendChild(button);
  });
}

function renderSessionReady() {
  const languageCode = currentLanguageCode();
  const audio = audioInstructionFor(state.active_condition_position);
  const sessionCount = uiText("session.count", languageCode, {
    position: state.active_condition_position,
    total: CONDITIONS.length
  });
  elements.sessionReadyKicker.textContent = sessionCount;
  elements.sessionReadyHeading.textContent = uiText("session.ready_question", languageCode);
  elements.sessionReadyConditionLabel.textContent = displayConditionLabelFor(activeConditionId(), languageCode);
  elements.sessionReadyBlockLabel.textContent = sessionCount;
  elements.sessionReadyAudioLabel.textContent = uiText("session.audio_will_start", languageCode, {
    audioLabel: audioInstructionLabel(audio, languageCode)
  });
}

function renderInductionPlaceholder() {
  const languageCode = currentLanguageCode();
  elements.inductionKicker.textContent = "";
  elements.inductionKicker.hidden = true;
  elements.inductionHeading.textContent = uiText("page.instructions.title", languageCode);
  elements.inductionConditionLabel.textContent = uiText("session.vr_task", languageCode);
  elements.inductionAudioLabel.textContent = uiText("induction.audio_ready", languageCode);
  elements.inductionAudioSummary.textContent = uiText("induction.follow", languageCode);
  elements.inductionRandomizationNote.textContent = "";
  elements.inductionAudioLinks.replaceChildren();
  elements.inductionSummary.textContent = uiText("induction.summary", languageCode);
}

function storyboardItems(order = activeOrder()) {
  const languageCode = currentLanguageCode();
  return [
    {
      page_id: "demographics",
      storyboard_title: uiText("page.demographics.title", languageCode),
      storyboard_subtitle: uiText("page.demographics.subtitle", languageCode)
    },
    ...order.condition_ids.flatMap((conditionId, index) => {
      const conditionPosition = index + 1;
      return [
        {
          page_id: READY_PAGE.id,
          condition_id: conditionId,
          condition_position: conditionPosition,
          storyboard_title: uiText("page.ready.title", languageCode),
          storyboard_subtitle: uiText("story.ready_subtitle", languageCode)
        },
        {
          page_id: INDUCTION_PAGE.id,
          condition_id: conditionId,
          condition_position: conditionPosition,
          storyboard_title: uiText("page.instructions.title", languageCode),
          storyboard_subtitle: uiText("story.instructions_subtitle", languageCode)
        },
        ...ASSESSMENT_PAGES.map((page, pageIndex) => ({
          page_id: page.id,
          condition_id: conditionId,
          condition_position: conditionPosition,
          storyboard_title: pageTitleFor(page.id, languageCode, page.title),
          storyboard_subtitle: uiText("story.response_section", languageCode)
        }))
      ];
    })
  ];
}

function storyboardDemographicsState() {
  return normalizeDemographics({
    polar_validation: defaultPolarValidation(),
    language_code: currentLanguageCode(),
    participant_first_name: "Preview",
    participant_last_name: "Participant",
    age_years: 29,
    handedness: "right",
    gender: "prefer_not_to_say",
    complete: false
  });
}

function storyboardAssessmentFor(conditionPosition) {
  const examples = [
    {
      sam: { valence_raw_1_9: null, arousal_raw_1_9: null, dominance_raw_1_9: null },
      affect_vas: { valence_raw_0_100: 52, arousal_raw_0_100: 48 },
      affect_vas_touched: { valence_raw_0_100: true, arousal_raw_0_100: true },
      emotion_representation_vas: {
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
      emotion_representation_vas: {
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
      emotion_representation_vas: {
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
      emotion_representation_vas: {
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
  const languageCode = currentLanguageCode();
  const items = storyboardItems();
  elements.storyboardPanels.replaceChildren();
  items.forEach((item, index) => {
    const wrapper = document.createElement("article");
    wrapper.className = "storyboard-item";
    wrapper.dataset.pageId = item.page_id;
    wrapper.innerHTML = `
      <div class="storyboard-card-label">
        <span>${escapeHtml(uiText("story.panel_count", languageCode, {
          index: String(index + 1).padStart(2, "0"),
          total: String(items.length).padStart(2, "0")
        }))}</span>
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

function localizedText(value, languageCode = state.demographics.language_code) {
  const language = normalizeLanguageCode(languageCode);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value[language] || value.en || Object.values(value).find(Boolean) || "";
  }
  return String(value ?? "");
}

function likertLabelFor(item, score, languageCode = state.demographics.language_code) {
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
  const languageCode = currentLanguageCode();
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
        <button class="secondary-button" type="button"${meta.backDisabled ? " disabled" : ""}>${escapeHtml(uiText("button.back", languageCode))}</button>
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
  const languageCode = currentLanguageCode();
  if (item.page_id === "demographics") {
    const demographics = storyboardDemographicsState();
    const errors = demographicsValidationErrors(demographics);
    const demographicsTitle = uiText("page.demographics.title", languageCode);
    return {
      conditionStatus: "",
      conditionLabel: demographicsTitle,
      pageLabel: demographicsTitle,
      pageTitle: demographicsTitle,
      pageCounter: "",
      footerStatus: errors.length > 0 ? errors[0] : uiText("status.ready_to_begin", languageCode),
      footerError: errors.length > 0,
      backDisabled: true,
      nextDisabled: errors.length > 0,
      nextText: uiText("button.begin", languageCode)
    };
  }

  if (item.page_id === READY_PAGE.id) {
    return {
      conditionStatus: "",
      conditionLabel: "",
      pageLabel: uiText("page.ready.label", languageCode),
      pageTitle: uiText("page.ready.title", languageCode),
      pageCounter: "",
      footerStatus: uiText("status.waiting_to_start", languageCode),
      footerError: false,
      backDisabled: false,
      nextDisabled: false,
      nextText: uiText("button.start_next_session", languageCode)
    };
  }

  if (item.page_id === INDUCTION_PAGE.id) {
    return {
      conditionStatus: "",
      conditionLabel: "",
      pageLabel: uiText("page.instructions.label", languageCode),
      pageTitle: uiText("page.instructions.title", languageCode),
      pageCounter: "",
      footerStatus: uiText("status.ready_to_continue", languageCode),
      footerError: false,
      backDisabled: false,
      nextDisabled: false,
      nextText: uiText("button.continue", languageCode)
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
        ? uiText("button.continue", languageCode)
        : (assessment.complete ? uiText("button.marked_complete", languageCode) : uiText("button.mark_complete", languageCode))
      : uiText("button.continue", languageCode)
  };
}

function storyboardContentMarkup(item) {
  if (item.page_id === "demographics") {
    return demographicsStoryboardMarkup();
  }
  if (item.page_id === READY_PAGE.id) {
    return sessionReadyStoryboardMarkup(item);
  }
  if (item.page_id === INDUCTION_PAGE.id) {
    return inductionStoryboardMarkup(item);
  }
  const assessment = storyboardAssessmentFor(item.condition_position);
  if (item.page_id === "self_assessment_manikin") {
    return samStoryboardMarkup(assessment);
  }
  if (item.page_id === "affect_vas") {
    return vasStoryboardMarkup(assessment);
  }
  if (item.page_id === "emotion_representation_vas") {
    return emotionRepresentationStoryboardMarkup(assessment);
  }
  return handEmbodimentStoryboardMarkup(assessment);
}

function demographicsStoryboardMarkup() {
  const demographics = storyboardDemographicsState();
  const languageCode = demographics.language_code;
  const polar = demographics.polar_validation;
  const ready = polarIsReady(polar);
  const age = demographics.age_years === null || Number.isNaN(demographics.age_years) ? "" : String(demographics.age_years);
  return `
    <section class="assessment-page demographics-section storyboard-demographics-page">
      <div class="polar-status ${ready ? "ready" : "waiting"}">
        <div class="polar-status-main">
          <span class="status-lamp" aria-hidden="true"></span>
          <div>
            <p class="story-polar-title">${escapeHtml(ready ? uiText("polar.ready", languageCode) : polarWaitingMessage(polar, languageCode))}</p>
            <p class="story-polar-detail">${escapeHtml(ready
              ? uiText("polar.detail", languageCode, {
                  heartRate: polar.heart_rate_bpm,
                  rrCount: polar.rr_interval_count,
                  sampleCount: polar.ecg_sample_count,
                  sampleRate: polar.ecg_sample_rate_hz
                })
              : polarWaitingMessage(polar, languageCode))}</p>
            <p class="story-polar-detail">${escapeHtml(uiText("polar.id", languageCode, { device: polarDeviceLabel(polar, languageCode) }))}</p>
            <p class="story-polar-diagnostic">${escapeHtml(localizedPolarDiagnostic(polar, ready, languageCode))}</p>
          </div>
        </div>
        <canvas class="polar-waveform storyboard-polar-waveform" width="300" height="48" data-ready="${ready ? "true" : "false"}" data-message="${escapeHtml(polarWaitingMessage(polar, languageCode))}" aria-label="${escapeHtml(uiText("polar.waveform_aria", languageCode))}"></canvas>
      </div>

      <div class="section-title demographics-title">
        <h2>${escapeHtml(uiText("page.demographics.title", languageCode))}</h2>
        <span>${escapeHtml(uiText("page.demographics.subtitle", languageCode))}</span>
      </div>

      <div class="demographics-grid">
        <div class="demographics-column">
          <div class="field-group">
            <label>${escapeHtml(uiText("demographics.language", languageCode))}</label>
            <div class="option-group two-options">${optionButtonsMarkup(LANGUAGE_OPTIONS, demographics.language_code, languageCode)}</div>
          </div>
          <div class="split-field-row">
            <div class="field-row">
              <label>${escapeHtml(uiText("demographics.first_name", languageCode))}</label>
              <input type="text" autocomplete="given-name" inputmode="text" value="${escapeHtml(demographics.participant_first_name)}" readonly>
            </div>
            <div class="field-row">
              <label>${escapeHtml(uiText("demographics.last_name", languageCode))}</label>
              <input type="text" autocomplete="family-name" inputmode="text" value="${escapeHtml(demographics.participant_last_name)}" readonly>
            </div>
          </div>
          <div class="field-row compact">
            <label>${escapeHtml(uiText("demographics.age", languageCode))}</label>
            <input type="number" min="0" max="120" step="1" inputmode="numeric" value="${escapeHtml(age)}" readonly>
          </div>
          <div class="field-group">
            <label>${escapeHtml(uiText("demographics.handedness", languageCode))}</label>
            <div class="option-group four-options">${optionButtonsMarkup(HANDEDNESS_OPTIONS, demographics.handedness, languageCode)}</div>
          </div>
          <div class="field-group">
            <label>${escapeHtml(uiText("demographics.gender", languageCode))}</label>
            <div class="option-group four-options">${optionButtonsMarkup(GENDER_OPTIONS, demographics.gender, languageCode)}</div>
          </div>
        </div>

        <div class="demographics-column consent-column">
          <label class="consent-check">
            <input type="checkbox" ${demographics.consent_confirmed ? "checked" : ""} aria-label="${escapeHtml(uiText("consent.aria", languageCode))}">
            <span>${escapeHtml(demographics.consent_text)}</span>
          </label>
        </div>
      </div>
    </section>
  `;
}

function inductionStoryboardMarkup(item) {
  const languageCode = currentLanguageCode();
  return `
    <section class="assessment-page induction-section">
      <div class="induction-shell">
        <p class="induction-kicker" hidden></p>
        <h2>${escapeHtml(uiText("page.instructions.title", languageCode))}</h2>
        <div class="induction-placeholder">
          <span>${escapeHtml(displayConditionLabelFor(item.condition_id, languageCode))}</span>
          <strong>${escapeHtml(uiText("induction.task_duration", languageCode))}</strong>
          <div class="induction-audio">
            <small>${escapeHtml(uiText("induction.audio_guide", languageCode))}</small>
            <b>${escapeHtml(uiText("induction.audio_ready", languageCode))}</b>
            <em>${escapeHtml(uiText("induction.follow", languageCode))}</em>
          </div>
        </div>
        <p class="induction-summary">${escapeHtml(uiText("induction.summary", languageCode))}</p>
      </div>
    </section>
  `;
}

function sessionReadyStoryboardMarkup(item) {
  const languageCode = currentLanguageCode();
  const audio = audioInstructionFor(item.condition_position);
  const sessionCountText = uiText("session.count", languageCode, {
    position: item.condition_position,
    total: CONDITIONS.length
  });
  return `
    <section class="assessment-page session-ready-section">
      <div class="session-ready-shell">
        <p class="session-ready-kicker">${escapeHtml(sessionCountText)}</p>
        <h2>${escapeHtml(uiText("session.ready_question", languageCode))}</h2>
        <div class="session-ready-summary">
          <span>${escapeHtml(displayConditionLabelFor(item.condition_id, languageCode))}</span>
          <strong>${escapeHtml(sessionCountText)}</strong>
          <p>${escapeHtml(uiText("session.audio_will_start", languageCode, {
            audioLabel: audioInstructionLabel(audio, languageCode)
          }))}</p>
        </div>
        <button class="primary-button session-ready-start" type="button">${escapeHtml(uiText("button.start_next_session", languageCode))}</button>
      </div>
    </section>
  `;
}

function samStoryboardMarkup(assessment) {
  const languageCode = currentLanguageCode();
  return `
    <section class="assessment-page sam-section" aria-label="${escapeHtml(uiText("sam.page_aria", languageCode))}">
      <p class="page-instruction">${escapeHtml(uiText("sam.instruction", languageCode))}</p>
      <div class="sam-rows">
        ${SAM_MANIKIN_ROWS.map((row) => {
          const questionText = localizedSamText(row, "question", languageCode);
          const lowText = localizedSamText(row, "low", languageCode);
          const highText = localizedSamText(row, "high", languageCode);
          return `
          <div class="sam-row">
            <div class="row-label">
              <strong class="sam-row-question">${escapeHtml(questionText)}</strong>
            </div>
            <div class="sam-scale-row">
              <span class="sam-row-anchor sam-row-anchor-low" aria-label="${escapeHtml(lowText)}">${stackedLabelMarkup(lowText)}</span>
              <div class="sam-options">
                ${(row.options || Array.from({ length: 9 }, (_, index) => index + 1)).map((score) => {
                  return `
                    <button type="button" class="sam-choice" aria-label="${escapeHtml(`${questionText} ${score}`)}" aria-pressed="${assessment.sam[row.field] === score ? "true" : "false"}">
                      <img src="${samManikinImageUrl(row.id, score)}" alt="" draggable="false" data-sam-scale="${escapeHtml(row.id)}"${dominanceManikinStyleAttribute(row.id, score)}>
                      <span>${score}</span>
                    </button>
                  `;
                }).join("")}
              </div>
              <span class="sam-row-anchor sam-row-anchor-high" aria-label="${escapeHtml(highText)}">${stackedLabelMarkup(highText)}</span>
            </div>
          </div>
        `;
        }).join("")}
      </div>
    </section>
  `;
}

function vasStoryboardMarkup(assessment) {
  const languageCode = currentLanguageCode();
  return `
    <section class="assessment-page slider-section" aria-label="${escapeHtml(uiText("vas.page_aria", languageCode))}">
      <div class="vas-slider-rows">
        ${AFFECT_VAS_SLIDERS.map((slider) => {
          const lowText = localizedAffectVasText(slider, "low", languageCode);
          const highText = localizedAffectVasText(slider, "high", languageCode);
          const questionText = localizedAffectVasText(slider, "question", languageCode);
          return `
          <div class="slider-row vas-slider-row">
            <header class="vas-slider-header">
              <span class="vas-header-anchor vas-header-anchor-low">${escapeHtml(lowText)}</span>
              <strong class="vas-question">${escapeHtml(questionText)}</strong>
              <span class="vas-header-anchor vas-header-anchor-high">${escapeHtml(highText)}</span>
            </header>
            <div class="vas-scale">
              <div class="vas-range-shell">
                <input type="range" min="0" max="100" step="1" value="${assessment.affect_vas[slider.field]}" tabindex="-1" aria-label="${escapeHtml(questionText)}" aria-valuetext="${vasDisplayValue(assessment.affect_vas[slider.field])}">
                <span class="axis-midpoint" aria-hidden="true"></span>
                <span class="vas-slider-readout" style="${vasReadoutStyle(assessment.affect_vas[slider.field])}">${vasDisplayValue(assessment.affect_vas[slider.field])}</span>
              </div>
            </div>
          </div>
        `;
        }).join("")}
      </div>
    </section>
  `;
}

function emotionRepresentationStoryboardMarkup(assessment) {
  const languageCode = currentLanguageCode();
  return `
    <section class="assessment-page emotion-representation-section">
      <div class="section-title">
        <h2>${escapeHtml(uiText("emotion.heading", languageCode))}</h2>
      </div>
      <div class="emotion-representation-slider-grid">
        ${EMOTION_REPRESENTATION_ITEMS.map((emotion) => {
          const field = emotionRepresentationFieldId(emotion.id);
          const emotionLabel = localizedEmotionLabel(emotion, languageCode);
          return `
            <div class="slider-row emotion-representation-slider-row">
              <header>
                <strong>${escapeHtml(emotionLabel)}</strong>
                <span class="slider-value">${assessment.emotion_representation_vas[field]}</span>
              </header>
              <input type="range" min="0" max="100" step="1" value="${assessment.emotion_representation_vas[field]}" tabindex="-1">
              <div class="slider-axis"><span>${escapeHtml(uiText("emotion.low", languageCode))}</span><span>${escapeHtml(uiText("emotion.high", languageCode))}</span></div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function handEmbodimentStoryboardMarkup(assessment) {
  const languageCode = currentLanguageCode();
  return `
    <section class="assessment-page hand-embodiment-section" aria-label="${escapeHtml(uiText("hand.prompt", languageCode))}">
      <div class="hand-likert-rows">
        ${HAND_EMBODIMENT_ITEMS.map((item) => {
          const questionText = localizedHandQuestion(item, languageCode);
          return `
          <div class="hand-likert-row">
            <strong class="hand-likert-question">${escapeHtml(questionText)}</strong>
            <div class="hand-likert-options">
              ${(item.options || Array.from({ length: 7 }, (_, index) => index + 1)).map((score) => `
                <button type="button" class="hand-likert-choice" aria-label="${escapeHtml(`${questionText} ${score}`)}" aria-pressed="${assessment.hand_embodiment[item.field] === score ? "true" : "false"}">
                  <span class="likert-number">${score}</span>
                  <span class="likert-label">${escapeHtml(likertLabelFor(item, score, languageCode))}</span>
                </button>
              `).join("")}
            </div>
          </div>
        `;
        }).join("")}
      </div>
    </section>
  `;
}

function optionButtonsMarkup(options, selectedValue, languageCode = currentLanguageCode()) {
  return options.map((option) => `
    <button type="button" aria-pressed="${option.id === selectedValue ? "true" : "false"}">${escapeHtml(localizedText(option.label, languageCode))}</button>
  `).join("");
}

function drawStoryboardCanvases() {
  document.querySelectorAll(".storyboard-polar-waveform").forEach((canvas) => {
    drawPolarWaveformCanvas(canvas, canvas.dataset.ready === "true", [], canvas.dataset.message || "");
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

function rangeValuePercent(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || min);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return 50;
  }
  return Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
}

function vasDisplayValue(value) {
  return Math.round(Math.min(Math.max(Number(value || 0), 0), 100));
}

function vasReadoutStyle(value) {
  return `--vas-readout-position: ${Math.min(Math.max(Number(value || 0), 0), 100)}%;`;
}

function updateSliderValueDisplay(input) {
  const valueElement = document.getElementById(`${input.id}.value`);
  if (valueElement) {
    valueElement.textContent = input.value;
  }
  const readoutElement = document.getElementById(`${input.id}.readout`);
  if (readoutElement) {
    readoutElement.textContent = String(vasDisplayValue(input.value));
    readoutElement.style.setProperty("--vas-readout-position", `${rangeValuePercent(input)}%`);
    input.setAttribute("aria-valuetext", String(vasDisplayValue(input.value)));
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
  const languageCode = currentLanguageCode();
  elements.samRows.replaceChildren();
  SAM_MANIKIN_ROWS.forEach((row) => {
    const questionText = localizedSamText(row, "question", languageCode);
    const lowText = localizedSamText(row, "low", languageCode);
    const highText = localizedSamText(row, "high", languageCode);
    const container = document.createElement("div");
    container.className = "sam-row";

    const label = document.createElement("div");
    label.className = "row-label";
    const question = document.createElement("strong");
    question.className = "sam-row-question";
    question.textContent = questionText;
    label.appendChild(question);
    container.appendChild(label);

    const scaleRow = document.createElement("div");
    scaleRow.className = "sam-scale-row";

    const lowAnchor = document.createElement("span");
    lowAnchor.className = "sam-row-anchor sam-row-anchor-low";
    appendStackedLabel(lowAnchor, lowText);
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
      button.setAttribute("aria-label", `${questionText} ${score}`);
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
    appendStackedLabel(highAnchor, highText);
    scaleRow.appendChild(highAnchor);

    container.appendChild(scaleRow);
    elements.samRows.appendChild(container);
  });
}

function renderVasSliders() {
  const assessment = activeAssessment();
  const languageCode = currentLanguageCode();
  elements.sliderRows.replaceChildren();
  AFFECT_VAS_SLIDERS.forEach((slider) => {
    const lowText = localizedAffectVasText(slider, "low", languageCode);
    const highText = localizedAffectVasText(slider, "high", languageCode);
    const questionText = localizedAffectVasText(slider, "question", languageCode);
    const row = document.createElement("div");
    row.className = "slider-row vas-slider-row";
    row.innerHTML = `
      <header class="vas-slider-header">
        <span class="vas-header-anchor vas-header-anchor-low">${escapeHtml(lowText)}</span>
        <strong class="vas-question">${escapeHtml(questionText)}</strong>
        <span class="vas-header-anchor vas-header-anchor-high">${escapeHtml(highText)}</span>
      </header>
      <div class="vas-scale">
        <div class="vas-range-shell">
          <input id="${slider.id}" type="range" min="0" max="100" step="1" value="${assessment.affect_vas[slider.field]}" aria-label="${escapeHtml(questionText)}" aria-valuetext="${vasDisplayValue(assessment.affect_vas[slider.field])}">
          <span class="axis-midpoint" aria-hidden="true"></span>
          <span class="vas-slider-readout" id="${slider.id}.readout" style="${vasReadoutStyle(assessment.affect_vas[slider.field])}">${vasDisplayValue(assessment.affect_vas[slider.field])}</span>
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

function renderEmotionRepresentationSliders() {
  const assessment = activeAssessment();
  const languageCode = currentLanguageCode();
  elements.emotionRepresentationSliderRows.replaceChildren();
  EMOTION_REPRESENTATION_ITEMS.forEach((emotion) => {
    const field = emotionRepresentationFieldId(emotion.id);
    const emotionLabel = localizedEmotionLabel(emotion, languageCode);
    const row = document.createElement("div");
    row.className = "slider-row emotion-representation-slider-row";
    row.innerHTML = `
      <header>
        <strong>${escapeHtml(emotionLabel)}</strong>
        <span class="slider-value" id="emotion_representation_vas.${field}.value">${assessment.emotion_representation_vas[field]}</span>
      </header>
      <input id="emotion_representation_vas.${field}" type="range" min="0" max="100" step="1" value="${assessment.emotion_representation_vas[field]}" aria-label="${escapeHtml(emotionLabel)}">
      <div class="slider-axis"><span>${escapeHtml(uiText("emotion.low", languageCode))}</span><span>${escapeHtml(uiText("emotion.high", languageCode))}</span></div>
    `;
    const input = row.querySelector("input");
    const applyValue = () => {
      const currentAssessment = activeAssessment();
      currentAssessment.emotion_representation_vas[field] = Number(input.value);
      updateSliderValueDisplay(input);
      markPageDirty("emotion_representation_vas");
      renderValidation();
      renderExport();
    };
    bindSmoothRangeDrag(input, applyValue);
    input.addEventListener("input", applyValue);
    elements.emotionRepresentationSliderRows.appendChild(row);
  });
}

function renderHandEmbodimentItems() {
  const assessment = activeAssessment();
  const languageCode = currentLanguageCode();
  elements.handEmbodimentRows.replaceChildren();
  HAND_EMBODIMENT_ITEMS.forEach((item) => {
    const questionText = localizedHandQuestion(item, languageCode);
    const row = document.createElement("div");
    row.className = "hand-likert-row";

    const question = document.createElement("strong");
    question.className = "hand-likert-question";
    question.textContent = questionText;
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
      button.setAttribute("aria-label", `${questionText} ${score}`);
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
  const polar = state.demographics.polar_validation;
  drawPolarWaveformCanvas(elements.polarWaveform, polarIsReady(polar), polar.recent_ecg_samples_uv, polarWaitingMessage(polar));
}

function drawPolarWaveformCanvas(canvas, ready, samples = [], waitingMessage = "") {
  const prepared = prepareCanvas(canvas);
  if (!prepared) {
    return;
  }
  const { context, width, height } = prepared;
  const values = ready ? realPolarSamples({ recent_ecg_samples_uv: samples }).slice(-RECENT_POLAR_SAMPLE_COUNT) : [];
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

  if (values.length < 2) {
    context.fillStyle = "#6b7280";
    context.font = "600 11px Inter, Arial, sans-serif";
    context.textBaseline = "middle";
    context.fillText(waitingMessage || "Searching for nearby Polar H10", 12, height / 2);
    return;
  }

  const baseline = height * 0.52;
  context.strokeStyle = "#127a3a";
  context.lineWidth = 2.2;
  context.lineCap = "round";
  context.beginPath();
  const scale = Math.max(120, ...values.map((sample) => Math.abs(sample)));
  const drawCount = values.length;
  for (let index = 0; index < drawCount; index += 1) {
    const wave = values[index] / scale;
    const x = drawCount <= 1 ? 0 : (index / (drawCount - 1)) * width;
    const y = Math.max(4, Math.min(height - 4, baseline - wave * height * 0.42));
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function demographicsValidationErrors(demographics = state.demographics) {
  const normalized = normalizeDemographics(demographics);
  const languageCode = normalized.language_code;
  const errors = [];
  if (!polarIsReady(normalized.polar_validation)) {
    errors.push(uiText("validation.polar", languageCode));
  }
  if (!LANGUAGE_OPTIONS.some((option) => option.id === normalized.language_code)) {
    errors.push(uiText("validation.language", languageCode));
  }
  if (normalized.participant_first_name.trim().length === 0) {
    errors.push(uiText("validation.first_name", languageCode));
  }
  if (normalized.participant_last_name.trim().length === 0) {
    errors.push(uiText("validation.last_name", languageCode));
  }
  if (!isIntegerInRange(normalized.age_years, 0, 120)) {
    errors.push(uiText("validation.age", languageCode));
  }
  if (!HANDEDNESS_OPTIONS.some((option) => option.id === normalized.handedness)) {
    errors.push(uiText("validation.handedness", languageCode));
  }
  if (!GENDER_OPTIONS.some((option) => option.id === normalized.gender)) {
    errors.push(uiText("validation.gender", languageCode));
  }
  if (!normalized.consent_confirmed) {
    errors.push(uiText("validation.consent", languageCode));
  }
  return errors;
}

function validationErrors(assessment = activeAssessment(), pageId = activePage().id, languageCode = currentLanguageCode()) {
  const normalized = normalizeAssessment(assessment);
  const errors = [];
  if (pageId === "self_assessment_manikin") {
    SAM_MANIKIN_ROWS.forEach((row) => {
      if (!isIntegerInRange(normalized.sam[row.field], 1, 9)) {
        errors.push(uiText("validation.sam", languageCode, {
          dimension: localizedSamText(row, "high", languageCode).toLowerCase()
        }));
      }
    });
  }
  if (pageId === "affect_vas") {
    AFFECT_VAS_SLIDERS.forEach((slider) => {
      if (!isIntegerInRange(normalized.affect_vas[slider.field], 0, 100)) {
        errors.push(uiText("validation.vas_range", languageCode, { field: slider.field }));
      } else if (!normalized.affect_vas_touched[slider.field]) {
        errors.push(uiText("validation.vas_touch", languageCode, {
          label: localizedAffectVasText(slider, "touch", languageCode)
        }));
      }
    });
  }
  if (pageId === "emotion_representation_vas") {
    EMOTION_REPRESENTATION_ITEMS.forEach((emotion) => {
      const field = emotionRepresentationFieldId(emotion.id);
      if (!isIntegerInRange(normalized.emotion_representation_vas[field], 0, 100)) {
        errors.push(uiText("validation.emotion_range", languageCode, {
          label: localizedEmotionLabel(emotion, languageCode)
        }));
      }
    });
  }
  if (pageId === "hand_embodiment") {
    HAND_EMBODIMENT_ITEMS.forEach((item) => {
      if (!isIntegerInRange(normalized.hand_embodiment[item.field], 1, 7)) {
        errors.push(uiText("validation.hand", languageCode, {
          item: localizedHandQuestion(item, languageCode)
        }));
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
  const languageCode = currentLanguageCode();
  elements.previousPage.textContent = uiText("button.back", languageCode);
  if (isDemographicsActive()) {
    const errors = demographicsValidationErrors();
    const hasBlockingErrors = errors.length > 0 && !skipRequired;
    elements.validationSummary.hidden = false;
    elements.validationSummary.classList.toggle("error", hasBlockingErrors);
    elements.validationSummary.textContent = hasBlockingErrors
      ? errors[0]
      : state.demographics.complete
        ? uiText("status.demographics_complete", languageCode)
        : uiText("status.ready_to_begin", languageCode);
    elements.previousPage.disabled = true;
    elements.nextPage.hidden = false;
    elements.nextPage.disabled = hasBlockingErrors;
    elements.nextPage.textContent = uiText("button.begin", languageCode);
    return;
  }
  if (isReadyActive()) {
    elements.validationSummary.hidden = false;
    elements.validationSummary.classList.remove("error");
    elements.validationSummary.textContent = uiText("status.waiting_to_start", languageCode);
    elements.previousPage.disabled = false;
    elements.nextPage.hidden = true;
    elements.nextPage.disabled = false;
    elements.nextPage.textContent = uiText("button.start_next_session", languageCode);
    return;
  }
  if (isInductionActive()) {
    elements.validationSummary.hidden = false;
    elements.validationSummary.classList.remove("error");
    elements.validationSummary.textContent = uiText("status.ready_to_continue", languageCode);
    elements.previousPage.disabled = false;
    elements.nextPage.hidden = false;
    elements.nextPage.disabled = false;
    elements.nextPage.textContent = uiText("button.continue", languageCode);
    return;
  }
  const page = activePage();
  const assessment = activeAssessment();
  const errors = validationErrors(assessment, page.id, languageCode);
  elements.validationSummary.hidden = true;
  elements.validationSummary.classList.remove("error");
  elements.validationSummary.textContent = "";
  elements.previousPage.disabled = false;
  elements.nextPage.hidden = false;
  elements.nextPage.disabled = errors.length > 0 && !skipRequired;
  elements.nextPage.textContent = activePageIndex() === ASSESSMENT_PAGES.length - 1
    ? state.active_condition_position < CONDITIONS.length
      ? uiText("button.continue", languageCode)
      : (assessment.complete ? uiText("button.marked_complete", languageCode) : uiText("button.mark_complete", languageCode))
    : uiText("button.continue", languageCode);
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
  return [READY_PAGE.id, INDUCTION_PAGE.id, ...ASSESSMENT_PAGES.map((page) => page.id)];
}

function expandedPreviewSequence(order = activeOrder()) {
  return [
    {
      stage: "demographics",
      page_id: "demographics",
      assessment_block_id: null,
      assessment_block_page: null,
      assessment_block_page_count: null,
      assessment_block_group: null
    },
    ...order.condition_ids.flatMap((conditionId, index) => {
      const conditionPosition = index + 1;
      const conditionFields = conditionExportFields(conditionId);
      return conditionBlockSequence().map((pageId) => {
        const pageNumber = assessmentPageNumber(pageId);
        const page = ASSESSMENT_PAGES.find((candidate) => candidate.id === pageId);
        return {
          block_position: conditionPosition,
          condition_position: conditionPosition,
          counterbalanced_condition_id: conditionId,
          ...conditionFields,
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
      "Self-Assessment Manikin pictograph choices",
      "VAS slider positions",
      "emotion representation VAS slider positions",
      "hand embodiment Likert selections",
      "footer navigation enabled/disabled states"
    ],
    panels: items.map((item, index) => {
      const conditionFields = nullableConditionExportFields(item.condition_id);
      return {
        panel_index: index + 1,
        page_id: item.page_id,
        block_position: item.condition_position || null,
        condition_position: item.condition_position || null,
        counterbalanced_condition_id: item.condition_id || null,
        ...conditionFields,
        audio_instruction_id: item.condition_position ? audioInstructionFor(item.condition_position).id : null,
        assessment_block_page: assessmentPageNumber(item.page_id),
        assessment_block_page_count: assessmentPageNumber(item.page_id) ? ASSESSMENT_PAGES.length : null,
        title: item.storyboard_title
      };
    })
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
      ...conditionExportFields(conditionId),
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
      condition_id: "runtime condition assigned to a block; this preview uses the locked factor-coded VR condition ID",
      vr_condition_id: "locked factor-coded VR particle condition ID",
      coherence_level: "low or high movement coherence factor level",
      energy_noise_level: "low or high movement energy/noise factor level",
      counterbalance_order_id: "mapping from block positions to counterbalanced conditions"
    },
    native_contract_authority: {
      protocol_version: "quest.questionnaire.v1",
      schema_id: `study6-questionnaire-v${SCHEMA_VERSION}`,
      open_stage: activePanelPageId(),
      screen_sequence: WORKFLOW_PAGES.map((page) => page.id),
      demographics_required_once: true,
      condition_block_sequence: conditionBlockSequence(),
      condition_assessment_sequence: ASSESSMENT_PAGES.map((page) => page.id),
      repeated_after_each_condition: true,
      result_owner: "caller-owned content URI"
    },
    preview_transfer_note: "Browser preview state is a layout and fixture artifact only. The Polar strip is a visual/native-state preview; native Android/Compose request parsing, H10 validation, result writing, focus, and headset validation remain authoritative.",
    questionnaire_item_library: QUESTIONNAIRE_ITEM_LIBRARY,
    control_model: CONTROL_MODEL,
    pages: pageGroups(),
    demographics: normalizeDemographics(state.demographics),
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
        ...conditionExportFields(conditionId)
      })),
      assignment_policy: "study runner/data logging assigns each participant to the least-filled counterbalance order from accumulated allocation counts; each order maps factor-coded VR conditions onto block positions",
      equal_participant_allocation: true,
      visible_in_questionnaire_panel: false,
      editable_in_preview: false,
      editable_in_native_panel: false,
      participant_input_required: false
    },
    audio_instruction_randomization: {
      condition_order_policy: "counterbalance condition order through counterbalance.order_id",
      assignment_policy: "randomly shuffle the four audio instruction variants so each runtime block receives one variant",
      options: AUDIO_INSTRUCTION_SETS,
      preview_assignments: previewAudioAssignments(order)
    },
    active_panel_page_id: activePanelPageId(),
    active_block_position: state.active_condition_position,
    active_condition_position: state.active_condition_position,
    ...activeConditionExportFields(),
    active_assessment_page_id: activePage().id,
    responses_by_condition: order.condition_ids.map((conditionId, index) => {
      const response = responseFor(conditionId);
      return {
        block_position: index + 1,
        condition_position: index + 1,
        ...conditionExportFields(conditionId),
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

function setNativePolarValidation(polarValidation) {
  state.demographics = normalizeDemographics({
    ...state.demographics,
    polar_validation: {
      ...state.demographics.polar_validation,
      ...(polarValidation || {})
    },
    complete: polarIsReady({
      ...state.demographics.polar_validation,
      ...(polarValidation || {})
    }) ? state.demographics.complete : false
  });
  render();
}

function setNativeEntryValue(elementId, value) {
  const element = document.getElementById(elementId);
  if (!element || !["participantFirstName", "participantLastName", "participantAge"].includes(element.id)) {
    return false;
  }
  element.value = String(value == null ? "" : value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.focus({ preventScroll: false });
  return true;
}

window.STUDY6_QUESTIONNAIRE_PREVIEW = {
  exportObject,
  makeState,
  makeEdgeState,
  setState,
  setNativePolarValidation,
  setNativeEntryValue
};

if (elements.orderSelect) {
  elements.orderSelect.addEventListener("change", () => {
    state.counterbalance_order_id = elements.orderSelect.value;
    state.active_condition_position = 1;
    state.active_panel_page_id = "demographics";
    state.active_assessment_page_id = "self_assessment_manikin";
    render();
  });
}

if (elements.sessionReadyStart) {
  elements.sessionReadyStart.addEventListener("click", () => {
    elements.nextPage.click();
  });
}

elements.previousPage.addEventListener("click", () => {
  if (isDemographicsActive()) {
    return;
  }
  if (isReadyActive()) {
    if (state.active_condition_position > 1) {
      const previousAssessmentPageId = ASSESSMENT_PAGES[ASSESSMENT_PAGES.length - 1].id;
      state.active_condition_position -= 1;
      state.active_panel_page_id = previousAssessmentPageId;
      state.active_assessment_page_id = previousAssessmentPageId;
    } else {
      state.active_panel_page_id = "demographics";
    }
    render();
    return;
  }
  if (isInductionActive()) {
    state.active_panel_page_id = READY_PAGE.id;
    render();
    return;
  }
  const index = activePageIndex();
  if (index > 0) {
    state.active_panel_page_id = ASSESSMENT_PAGES[index - 1].id;
    state.active_assessment_page_id = ASSESSMENT_PAGES[index - 1].id;
    render();
  } else {
    state.active_panel_page_id = "demographics";
    render();
  }
});

elements.nextPage.addEventListener("click", () => {
  const skipRequired = previewSkipRequiredEnabled();
  if (isDemographicsActive()) {
    if (!skipRequired && demographicsValidationErrors().length > 0) {
      return;
    }
    state.demographics.complete = true;
    state.active_panel_page_id = READY_PAGE.id;
    state.active_assessment_page_id = "self_assessment_manikin";
    render();
    return;
  }
  if (isReadyActive()) {
    state.active_panel_page_id = INDUCTION_PAGE.id;
    state.active_assessment_page_id = "self_assessment_manikin";
    render();
    return;
  }
  if (isInductionActive()) {
    state.active_panel_page_id = "self_assessment_manikin";
    state.active_assessment_page_id = "self_assessment_manikin";
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
      state.active_panel_page_id = READY_PAGE.id;
      state.active_assessment_page_id = "self_assessment_manikin";
    }
  }
  render();
});

function updateParticipantNameField(field, value) {
  state.demographics[field] = value;
  state.demographics.participant_name = combinedParticipantName(
    state.demographics.participant_first_name,
    state.demographics.participant_last_name
  );
  state.demographics.complete = false;
  renderValidation();
  renderExport();
}

elements.participantFirstName.addEventListener("input", () => {
  updateParticipantNameField("participant_first_name", elements.participantFirstName.value);
});

elements.participantLastName.addEventListener("input", () => {
  updateParticipantNameField("participant_last_name", elements.participantLastName.value);
});

function requestNativeKeyboardFor(element) {
  if (!element) {
    return;
  }
  const request = () => {
    element.focus({ preventScroll: false });
    if (window.AndroidStudy6 && typeof window.AndroidStudy6.requestKeyboard === "function") {
      const label = document.querySelector(`label[for="${element.id}"]`);
      window.AndroidStudy6.requestKeyboard(JSON.stringify({
        elementId: element.id || "",
        label: label ? label.textContent : "",
        value: element.value || "",
        inputMode: element.id === "participantAge" ? "number" : "text"
      }));
    }
  };
  element.addEventListener("pointerdown", request);
  element.addEventListener("focus", request);
  element.addEventListener("pointerup", request);
  element.addEventListener("click", request);
}

requestNativeKeyboardFor(elements.participantFirstName);
requestNativeKeyboardFor(elements.participantLastName);
requestNativeKeyboardFor(elements.participantAge);

elements.participantAge.addEventListener("input", () => {
  const value = elements.participantAge.value.trim();
  state.demographics.age_years = value === "" ? null : Number(value);
  state.demographics.complete = false;
  renderValidation();
  renderExport();
});

elements.consentCheckbox.addEventListener("change", () => {
  state.demographics.consent_confirmed = elements.consentCheckbox.checked;
  state.demographics.complete = false;
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
  markPageDirty("self_assessment_manikin");
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

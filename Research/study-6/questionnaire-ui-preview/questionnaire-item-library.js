"use strict";

(function () {
  const range = (start, end) => Array.from(
    { length: end - start + 1 },
    (_, index) => start + index
  );

  const scale01To09 = range(1, 9);

  const item = (definition) => ({
    item_library_version: 1,
    ...definition
  });

  const samItems = [
    {
      id: "sam.valence_raw_1_9",
      variable_name: "sam_valence_raw_1_9",
      label: "Retrospective SAM valence",
      scale_id: "valence",
      axis_label: "Unpleasant - Pleasant",
      question: "How pleasant did this experience feel?",
      low: "Unpleasant",
      high: "Pleasant",
      field: "valence_raw_1_9"
    },
    {
      id: "sam.arousal_raw_1_9",
      variable_name: "sam_arousal_raw_1_9",
      label: "Retrospective SAM arousal",
      scale_id: "arousal",
      axis_label: "Inactive - Active",
      question: "How active did you feel during this experience?",
      low: "Inactive",
      high: "Active",
      field: "arousal_raw_1_9"
    },
    {
      id: "sam.dominance_raw_1_9",
      variable_name: "sam_dominance_raw_1_9",
      label: "Retrospective SAM dominance/control",
      scale_id: "dominance",
      axis_label: "Not in control - In control",
      question: "How much control did you feel during your experience?",
      low: "Not in control",
      high: "In control",
      field: "dominance_raw_1_9"
    }
  ].map((definition) => item({
    ...definition,
    page: "sam_pictographic",
    group: "sam",
    response_namespace: "sam",
    type: "pictographic-choice",
    default: null,
    min: 1,
    max: 9,
    step: 1,
    options: scale01To09,
    anchors: [
      { value: 1, label: definition.low },
      { value: 9, label: definition.high }
    ],
    asset_catalog_id: definition.scale_id === "dominance" ? "sam.valence.neutral_scaled" : `sam.${definition.scale_id}`,
    asset_name_pattern: definition.scale_id === "dominance" ? "valence_05_scaled_by_score" : `${definition.scale_id}_{score_2digit}`,
    editable: "editable",
    validation: "required integer 1..9",
    result_json_field: `answers.emotion_assessment.sam.${definition.field}`
  }));

  const affectVasItems = [
    {
      id: "vas.valence_raw_0_100",
      variable_name: "affect_vas_valence_raw_0_100",
      label: "Retrospective valence VAS",
      axis_label: "Negative - positive",
      question: "How positive or negative did you feel during the last session?",
      touchLabel: "valence",
      low: "Very negative",
      high: "Very positive",
      field: "valence_raw_0_100"
    },
    {
      id: "vas.arousal_raw_0_100",
      variable_name: "affect_vas_arousal_raw_0_100",
      label: "Retrospective arousal VAS",
      axis_label: "Inactive - active",
      question: "How active or inactive did you feel during the last session?",
      touchLabel: "arousal",
      low: "Very inactive",
      high: "Very active",
      field: "arousal_raw_0_100"
    }
  ].map((definition) => item({
    ...definition,
    page: "affect_vas",
    group: "affect_vas",
    response_namespace: "affect_vas",
    type: "range",
    default: 50,
    min: 0,
    max: 100,
    step: 1,
    center_marker: 50,
    anchors: [
      { value: 0, label: definition.low },
      { value: 100, label: definition.high }
    ],
    editable: "editable",
    validation: "required integer 0..100; slider must be touched once before page completion",
    result_json_field: `answers.emotion_assessment.affect_vas.${definition.field}`
  }));

  const ekmanItems = [
    { emotion_id: "anger", label: "Anger" },
    { emotion_id: "disgust", label: "Disgust" },
    { emotion_id: "fear", label: "Fear" },
    { emotion_id: "happiness", label: "Happiness" },
    { emotion_id: "sadness", label: "Sadness" },
    { emotion_id: "surprise", label: "Surprise" }
  ].map((definition) => {
    const field = `${definition.emotion_id}_raw_0_100`;
    return item({
      id: `ekman_intensity.${field}`,
      variable_name: `particle_ekman_${field}`,
      label: definition.label,
      emotion_id: definition.emotion_id,
      page: "ekman_intensity",
      group: "ekman_intensity",
      response_namespace: "ekman_intensity",
      field,
      type: "range",
      default: 0,
      min: 0,
      max: 100,
      step: 1,
      anchors: [
        { value: 0, label: "Not represented" },
        { value: 100, label: "Clearly represented" }
      ],
      editable: "editable",
      validation: "required integer 0..100",
      result_json_field: `answers.emotion_assessment.ekman_intensity.${field}`
    });
  });

  const items = [
    item({
      id: "onboarding.polar_validation.ready",
      variable_name: "onboarding_polar_validation_ready",
      label: "Polar H10 ECG validation",
      page: "onboarding",
      group: "polar_validation",
      response_namespace: "onboarding",
      field: "polar_validation.ready",
      type: "readonly-status-strip",
      default: true,
      editable: "native-owned",
      validation: "native ready only when HR/RR stream, PMD, ECG stream, samples, and 130 Hz are present",
      native_state_field: "questionnaire_state.onboarding.polar_validation.ready",
      result_json_field: "answers.onboarding.polar_validation"
    }),
    item({
      id: "onboarding.language_code",
      variable_name: "onboarding_language_code",
      label: "Language",
      page: "onboarding",
      group: "language",
      response_namespace: "onboarding",
      field: "language_code",
      type: "segmented",
      default: "en",
      options: ["en", "de"],
      editable: "editable",
      validation: "required; must be en or de",
      result_json_field: "answers.onboarding.language_code"
    }),
    item({
      id: "onboarding.participant_first_name",
      variable_name: "onboarding_participant_first_name",
      label: "First name",
      page: "onboarding",
      group: "demographics",
      response_namespace: "onboarding",
      field: "participant_first_name",
      type: "text",
      default: "",
      editable: "editable",
      validation: "required non-empty text",
      result_json_field: "answers.onboarding.participant_first_name"
    }),
    item({
      id: "onboarding.participant_last_name",
      variable_name: "onboarding_participant_last_name",
      label: "Last name",
      page: "onboarding",
      group: "demographics",
      response_namespace: "onboarding",
      field: "participant_last_name",
      type: "text",
      default: "",
      editable: "editable",
      validation: "required non-empty text",
      result_json_field: "answers.onboarding.participant_last_name"
    }),
    item({
      id: "onboarding.participant_name",
      variable_name: "onboarding_participant_name",
      label: "Full name",
      page: "onboarding",
      group: "demographics",
      response_namespace: "onboarding",
      field: "participant_name",
      type: "readonly-derived",
      default: "",
      editable: "derived",
      validation: "derived from first and last name",
      result_json_field: "answers.onboarding.participant_name"
    }),
    item({
      id: "onboarding.age_years",
      variable_name: "onboarding_age_years",
      label: "Age",
      page: "onboarding",
      group: "demographics",
      response_namespace: "onboarding",
      field: "age_years",
      type: "number",
      default: null,
      min: 0,
      max: 120,
      step: 1,
      editable: "editable",
      validation: "required integer 0..120",
      result_json_field: "answers.onboarding.age_years"
    }),
    item({
      id: "onboarding.handedness",
      variable_name: "onboarding_handedness",
      label: "Handedness",
      page: "onboarding",
      group: "demographics",
      response_namespace: "onboarding",
      field: "handedness",
      type: "segmented",
      default: "",
      options: ["right", "left", "ambidextrous", "prefer_not_to_say"],
      editable: "editable",
      validation: "required; must be one handedness option id",
      result_json_field: "answers.onboarding.handedness"
    }),
    item({
      id: "onboarding.gender",
      variable_name: "onboarding_gender",
      label: "Gender",
      page: "onboarding",
      group: "demographics",
      response_namespace: "onboarding",
      field: "gender",
      type: "segmented",
      default: "",
      options: ["male", "female", "other", "prefer_not_to_say"],
      editable: "editable",
      validation: "required; must be one gender option id",
      result_json_field: "answers.onboarding.gender"
    }),
    item({
      id: "onboarding.consent_confirmed",
      variable_name: "onboarding_consent_confirmed",
      label: "Study consent",
      page: "onboarding",
      group: "consent",
      response_namespace: "onboarding",
      field: "consent_confirmed",
      type: "checkbox",
      default: false,
      editable: "editable",
      validation: "required; must be checked",
      result_json_field: "answers.onboarding.consent_confirmed"
    }),
    item({
      id: "onboarding.consent_text",
      variable_name: "onboarding_consent_text",
      label: "Consent text",
      page: "onboarding",
      group: "consent",
      response_namespace: "onboarding",
      field: "consent_text",
      type: "readonly-text",
      default: "I consent to participate in this study.",
      editable: "fixed",
      validation: "fixed consent wording shown to participant",
      result_json_field: "answers.onboarding.consent_text"
    }),
    item({
      id: "onboarding.signature",
      variable_name: "onboarding_signature",
      label: "Consent signature",
      page: "onboarding",
      group: "consent",
      response_namespace: "onboarding",
      field: "signature",
      type: "signature-pad",
      default: { has_signature: false, stroke_count: 0 },
      editable: "editable",
      validation: "required signature stroke data",
      result_json_field: "answers.onboarding.signature"
    }),
    item({
      id: "counterbalance.order_id",
      variable_name: "counterbalance_order_id",
      label: "Counterbalance order assignment",
      group: "background_assignment",
      response_namespace: "runtime_metadata",
      field: "counterbalance_order_id",
      type: "background-allocation",
      default: "order_01",
      options: ["order_01", "order_02", "order_03", "order_04"],
      editable: "caller-owned-background",
      validation: "assigned by the study runner from accumulated allocation counts; must be one of counterbalance order ids",
      native_state_field: "questionnaire_state.counterbalance_order_id"
    }),
    item({
      id: "condition.active_index",
      variable_name: "condition_active_index",
      label: "Active condition index",
      group: "runtime_navigation",
      response_namespace: "runtime_metadata",
      field: "active_condition_position",
      type: "runtime-state",
      default: 1,
      min: 1,
      max: 4,
      step: 1,
      editable: "runtime-owned",
      validation: "derived from the current block position; must be 1..4",
      native_state_field: "questionnaire_state.condition_index"
    }),
    item({
      id: "condition.induction_placeholder",
      variable_name: "condition_induction_placeholder",
      label: "Emotion induction placeholder",
      page: "emotion_induction_placeholder",
      group: "condition_induction",
      response_namespace: "condition_runtime",
      field: "induction_placeholder",
      type: "placeholder-stage",
      default: "condition-specific native induction",
      editable: "caller-owned",
      validation: "native app/caller owns induction timing, media, task state, completion, counterbalanced condition order, and randomized audio variant",
      native_state_field: "questionnaire_state.condition_induction_stage"
    }),
    item({
      id: "assessment.active_page_id",
      variable_name: "assessment_active_page_id",
      label: "Active assessment page",
      group: "runtime_navigation",
      response_namespace: "runtime_metadata",
      field: "active_assessment_page_id",
      type: "runtime-navigation-state",
      default: "sam_pictographic",
      options: ["sam_pictographic", "affect_vas", "ekman_intensity"],
      editable: "runtime-owned",
      validation: "derived from questionnaire workflow navigation; must be one of assessment page ids",
      native_state_field: "questionnaire_state.open_stage"
    }),
    ...samItems,
    ...affectVasItems,
    ...ekmanItems
  ];

  const pages = [
    {
      id: "onboarding",
      title: "Participant onboarding",
      groups: [
        { id: "polar_validation", fields: ["onboarding.polar_validation.ready"] },
        { id: "language", fields: ["onboarding.language_code"] },
        {
          id: "demographics",
          fields: [
            "onboarding.participant_first_name",
            "onboarding.participant_last_name",
            "onboarding.participant_name",
            "onboarding.age_years",
            "onboarding.handedness",
            "onboarding.gender"
          ]
        },
        {
          id: "consent",
          fields: [
            "onboarding.consent_confirmed",
            "onboarding.consent_text",
            "onboarding.signature"
          ]
        }
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
        { id: "sam", fields: samItems.map((definition) => definition.id) }
      ]
    },
    {
      id: "affect_vas",
      title: "Retrospective valence and arousal VAS",
      groups: [
        { id: "affect_vas", fields: affectVasItems.map((definition) => definition.id) }
      ]
    },
    {
      id: "ekman_intensity",
      title: "Particle movement emotion VAS",
      groups: [
        { id: "ekman_intensity", fields: ekmanItems.map((definition) => definition.id) }
      ]
    }
  ];

  const ids = new Set();
  const variableNames = new Set();
  items.forEach((definition) => {
    if (ids.has(definition.id)) {
      throw new Error(`Duplicate questionnaire item id: ${definition.id}`);
    }
    if (variableNames.has(definition.variable_name)) {
      throw new Error(`Duplicate questionnaire variable name: ${definition.variable_name}`);
    }
    ids.add(definition.id);
    variableNames.add(definition.variable_name);
  });

  window.STUDY6_QUESTIONNAIRE_ITEM_LIBRARY = Object.freeze({
    id: "study6_questionnaire_item_library",
    version: 1,
    naming_rule: "Use namespaced dot ids for nested JSON paths and flat snake_case variable_name values for exports/spreadsheets.",
    items: Object.freeze(items),
    pages: Object.freeze(pages)
  });
}());

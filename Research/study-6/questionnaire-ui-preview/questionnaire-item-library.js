"use strict";

(function () {
  const range = (start, end) => Array.from(
    { length: end - start + 1 },
    (_, index) => start + index
  );

  const scale01To09 = range(1, 9);
  const scale01To07 = range(1, 7);

  const item = (definition) => ({
    item_library_version: 1,
    ...definition
  });

  const samItems = [
    {
      id: "sam.valence_raw_1_9",
      variable_name: "sam_valence_raw_1_9",
      label: "Retrospective Self-Assessment Manikin pictograph valence",
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
      label: "Retrospective Self-Assessment Manikin pictograph arousal",
      scale_id: "arousal",
      axis_label: "Low Energy - High Energy",
      question: "How activated did you feel?",
      low: "Low Energy",
      high: "High Energy",
      field: "arousal_raw_1_9"
    },
    {
      id: "sam.dominance_raw_1_9",
      variable_name: "sam_dominance_raw_1_9",
      label: "Retrospective Self-Assessment Manikin pictograph dominance/control",
      scale_id: "dominance",
      axis_label: "Not in control - In control",
      question: "How much control did you feel during your experience?",
      low: "Not in control",
      high: "In control",
      field: "dominance_raw_1_9"
    }
  ].map((definition) => item({
    ...definition,
    page: "self_assessment_manikin",
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
      axis_label: "Unpleasant - Pleasant",
      question: "How pleasant did the previous experience feel?",
      touchLabel: "valence",
      low: "Unpleasant",
      high: "Pleasant",
      field: "valence_raw_0_100"
    },
    {
      id: "vas.arousal_raw_0_100",
      variable_name: "affect_vas_arousal_raw_0_100",
      label: "Retrospective arousal VAS",
      axis_label: "Low Energy - High Energy",
      question: "How activated did you feel in the previous experience?",
      touchLabel: "arousal",
      low: "Low Energy",
      high: "High Energy",
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

  const emotionRepresentationItems = [
    { emotion_id: "anger", label: "Anger" },
    { emotion_id: "disgust", label: "Disgust" },
    { emotion_id: "fear", label: "Fear" },
    { emotion_id: "happiness", label: "Happiness" },
    { emotion_id: "sadness", label: "Sadness" },
    { emotion_id: "surprise", label: "Surprise" }
  ].map((definition) => {
    const field = `${definition.emotion_id}_raw_0_100`;
    return item({
      id: `emotion_representation_vas.${field}`,
      variable_name: `emotion_representation_vas_${field}`,
      label: definition.label,
      emotion_id: definition.emotion_id,
      page: "emotion_representation_vas",
      group: "emotion_representation_vas",
      response_namespace: "emotion_representation_vas",
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
      result_json_field: `answers.emotion_assessment.emotion_representation_vas.${field}`
    });
  });

  const likertAgreementOptions = [
    {
      value: 1,
      label: {
        en: "Strongly disagree",
        de: "Stimme überhaupt nicht zu"
      }
    },
    {
      value: 2,
      label: {
        en: "Disagree",
        de: "Stimme nicht zu"
      }
    },
    {
      value: 3,
      label: {
        en: "Somewhat disagree",
        de: "Stimme eher nicht zu"
      }
    },
    {
      value: 4,
      label: {
        en: "Neither agree nor disagree",
        de: "Weder Zustimmung noch Ablehnung"
      }
    },
    {
      value: 5,
      label: {
        en: "Somewhat agree",
        de: "Stimme eher zu"
      }
    },
    {
      value: 6,
      label: {
        en: "Agree",
        de: "Stimme zu"
      }
    },
    {
      value: 7,
      label: {
        en: "Strongly agree",
        de: "Stimme voll und ganz zu"
      }
    }
  ];

  const handEmbodimentItems = [
    {
      id: "hand_embodiment.ownership_raw_1_7",
      variable_name: "hand_embodiment_ownership_raw_1_7",
      label: "Adapted VEQ hand ownership",
      construct_id: "ownership",
      field: "ownership_raw_1_7",
      question: {
        en: "It felt like the virtual hands were my own hands.",
        de: "Es fühlte sich so an, als wären die virtuellen Hände meine eigenen Hände."
      }
    },
    {
      id: "hand_embodiment.agency_raw_1_7",
      variable_name: "hand_embodiment_agency_raw_1_7",
      label: "Adapted VEQ hand agency",
      construct_id: "agency",
      field: "agency_raw_1_7",
      question: {
        en: "It felt like I was controlling the movements of the virtual hands.",
        de: "Es fühlte sich so an, als würde ich die Bewegungen der virtuellen Hände kontrollieren."
      }
    }
  ].map((definition) => item({
    ...definition,
    page: "hand_embodiment",
    group: "hand_embodiment",
    response_namespace: "hand_embodiment",
    type: "likert-choice",
    default: null,
    min: 1,
    max: 7,
    step: 1,
    options: scale01To07,
    option_labels: likertAgreementOptions,
    anchors: [
      { value: 1, label: likertAgreementOptions[0].label },
      { value: 7, label: likertAgreementOptions[6].label }
    ],
    source_scale: "Adapted single-item Virtual Embodiment Questionnaire (VEQ) ownership/agency measures for virtual hands",
    editable: "editable",
    validation: "required integer 1..7",
    result_json_field: `answers.emotion_assessment.hand_embodiment.${definition.field}`
  }));

  const items = [
    item({
      id: "demographics.polar_validation.ready",
      variable_name: "demographics_polar_validation_ready",
      label: "Polar H10 ECG validation",
      page: "demographics",
      group: "polar_validation",
      response_namespace: "demographics",
      field: "polar_validation.ready",
      type: "readonly-status-strip",
      default: true,
      editable: "native-owned",
      validation: "native ready only when HR/RR stream, PMD, ECG stream, samples, and 130 Hz are present",
      native_state_field: "questionnaire_state.demographics.polar_validation.ready",
      result_json_field: "answers.demographics.polar_validation"
    }),
    item({
      id: "demographics.language_code",
      variable_name: "demographics_language_code",
      label: "Language",
      page: "demographics",
      group: "language",
      response_namespace: "demographics",
      field: "language_code",
      type: "segmented",
      default: "en",
      options: ["en", "de"],
      editable: "editable",
      validation: "required; must be en or de",
      result_json_field: "answers.demographics.language_code"
    }),
    item({
      id: "demographics.participant_first_name",
      variable_name: "demographics_participant_first_name",
      label: "First name",
      page: "demographics",
      group: "demographics",
      response_namespace: "demographics",
      field: "participant_first_name",
      type: "text",
      default: "",
      editable: "editable",
      validation: "required non-empty text",
      result_json_field: "answers.demographics.participant_first_name"
    }),
    item({
      id: "demographics.participant_last_name",
      variable_name: "demographics_participant_last_name",
      label: "Last name",
      page: "demographics",
      group: "demographics",
      response_namespace: "demographics",
      field: "participant_last_name",
      type: "text",
      default: "",
      editable: "editable",
      validation: "required non-empty text",
      result_json_field: "answers.demographics.participant_last_name"
    }),
    item({
      id: "demographics.participant_name",
      variable_name: "demographics_participant_name",
      label: "Full name",
      page: "demographics",
      group: "demographics",
      response_namespace: "demographics",
      field: "participant_name",
      type: "readonly-derived",
      default: "",
      editable: "derived",
      validation: "derived from first and last name",
      result_json_field: "answers.demographics.participant_name"
    }),
    item({
      id: "demographics.age_years",
      variable_name: "demographics_age_years",
      label: "Age",
      page: "demographics",
      group: "demographics",
      response_namespace: "demographics",
      field: "age_years",
      type: "number",
      default: null,
      min: 0,
      max: 120,
      step: 1,
      editable: "editable",
      validation: "required integer 0..120",
      result_json_field: "answers.demographics.age_years"
    }),
    item({
      id: "demographics.handedness",
      variable_name: "demographics_handedness",
      label: "Handedness",
      page: "demographics",
      group: "demographics",
      response_namespace: "demographics",
      field: "handedness",
      type: "segmented",
      default: "",
      options: ["right", "left", "ambidextrous", "prefer_not_to_say"],
      editable: "editable",
      validation: "required; must be one handedness option id",
      result_json_field: "answers.demographics.handedness"
    }),
    item({
      id: "demographics.gender",
      variable_name: "demographics_gender",
      label: "Gender",
      page: "demographics",
      group: "demographics",
      response_namespace: "demographics",
      field: "gender",
      type: "segmented",
      default: "",
      options: ["male", "female", "other", "prefer_not_to_say"],
      editable: "editable",
      validation: "required; must be one gender option id",
      result_json_field: "answers.demographics.gender"
    }),
    item({
      id: "demographics.consent_confirmed",
      variable_name: "demographics_consent_confirmed",
      label: "Study consent",
      page: "demographics",
      group: "consent",
      response_namespace: "demographics",
      field: "consent_confirmed",
      type: "checkbox",
      default: false,
      editable: "editable",
      validation: "required; must be checked",
      result_json_field: "answers.demographics.consent_confirmed"
    }),
    item({
      id: "demographics.consent_text",
      variable_name: "demographics_consent_text",
      label: "Consent text",
      page: "demographics",
      group: "consent",
      response_namespace: "demographics",
      field: "consent_text",
      type: "readonly-text",
      default: "I consent to participate in this study.",
      editable: "fixed",
      validation: "fixed consent wording shown to participant",
      result_json_field: "answers.demographics.consent_text"
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
      id: "condition.session_ready_prompt",
      variable_name: "condition_session_ready_prompt",
      label: "Ready for next session prompt",
      page: "session_ready",
      group: "condition_readiness",
      response_namespace: "condition_runtime",
      field: "session_ready_prompt",
      type: "placeholder-stage",
      default: "participant readiness prompt before timed audio/condition block",
      editable: "caller-owned",
      validation: "shown before every condition audio block; participant must start next session before audio begins",
      native_state_field: "questionnaire_state.condition_readiness_stage"
    }),
    item({
      id: "condition.induction_placeholder",
      variable_name: "condition_induction_placeholder",
      label: "VR task instructions",
      page: "vr_task_instructions",
      group: "condition_induction",
      response_namespace: "condition_runtime",
      field: "induction_placeholder",
      type: "placeholder-stage",
      default: "condition-specific native VR task instructions",
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
      default: "self_assessment_manikin",
      options: ["self_assessment_manikin", "affect_vas", "emotion_representation_vas", "hand_embodiment"],
      editable: "runtime-owned",
      validation: "derived from questionnaire workflow navigation; must be one of assessment page ids",
      native_state_field: "questionnaire_state.open_stage"
    }),
    ...samItems,
    ...affectVasItems,
    ...emotionRepresentationItems,
    ...handEmbodimentItems
  ];

  const pages = [
    {
      id: "demographics",
      title: "Demographics",
      groups: [
        { id: "polar_validation", fields: ["demographics.polar_validation.ready"] },
        { id: "language", fields: ["demographics.language_code"] },
        {
          id: "demographics",
          fields: [
            "demographics.participant_first_name",
            "demographics.participant_last_name",
            "demographics.participant_name",
            "demographics.age_years",
            "demographics.handedness",
            "demographics.gender"
          ]
        },
        {
          id: "consent",
          fields: [
            "demographics.consent_confirmed",
            "demographics.consent_text"
          ]
        }
      ]
    },
    {
      id: "session_ready",
      title: "Ready for next session",
      groups: [
        { id: "condition_readiness", fields: ["condition.session_ready_prompt"] }
      ]
    },
    {
      id: "vr_task_instructions",
      title: "VR task instructions",
      groups: [
        { id: "condition_induction", fields: ["condition.induction_placeholder"] }
      ]
    },
    {
      id: "self_assessment_manikin",
      title: "Self-Assessment Manikin pictographs",
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
      id: "emotion_representation_vas",
      title: "Particle emotion representation VAS",
      groups: [
        { id: "emotion_representation_vas", fields: emotionRepresentationItems.map((definition) => definition.id) }
      ]
    },
    {
      id: "hand_embodiment",
      title: "Virtual hand embodiment",
      groups: [
        { id: "hand_embodiment", fields: handEmbodimentItems.map((definition) => definition.id) }
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

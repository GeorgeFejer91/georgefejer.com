"use strict";

(function () {
  if (window.__study6QuestAutoRunInstalled) {
    return;
  }
  window.__study6QuestAutoRunInstalled = true;

  const api = window.STUDY6_QUESTIONNAIRE_PREVIEW;
  const params = new URLSearchParams(window.location.search);
  const autoRunProfile = (params.get("auto_run_profile") || "linear").toLowerCase();
  const previewOrders = {
    order_01: ["LC_LE", "LC_HE", "HC_HE", "HC_LE"],
    order_02: ["LC_HE", "HC_LE", "LC_LE", "HC_HE"],
    order_03: ["HC_LE", "HC_HE", "LC_HE", "LC_LE"],
    order_04: ["HC_HE", "LC_LE", "HC_LE", "LC_HE"]
  };
  let lastClickAt = 0;
  let lastClickPage = "";
  let finished = false;

  function status(eventType, detail) {
    try {
      window.AndroidStudy6.onQuestAutoRunStatus(eventType, String(detail || ""));
    } catch (error) {
      // The Android bridge owns logging. If it is not ready yet, keep the UI run alive.
    }
  }

  function snapshot(reason) {
    try {
      window.AndroidStudy6.onQuestionnaireSnapshot(reason, JSON.stringify(api.exportObject()));
    } catch (error) {
      status("snapshot_failed", error && error.message ? error.message : error);
    }
  }

  function responseValue(itemId, blockOrder) {
    const profiles = {
      linear: {
      SAM1: 4 + blockOrder,
      SAM2: Math.max(1, 8 - blockOrder),
      SAM3: 5,
      valence: 50 + blockOrder,
      arousal: 55 + blockOrder,
      Anger: 10 * blockOrder,
      Fear: 10 * blockOrder + 1,
      Sadness: 10 * blockOrder + 2,
      Disgust: 10 * blockOrder + 3,
      Happiness: 10 * blockOrder + 4,
      Surprise: 10 * blockOrder + 5,
      Ownership: Math.min(7, 3 + blockOrder),
      Agency: Math.min(7, 4 + blockOrder)
      },
      low: {
        SAM1: Math.max(1, 6 - blockOrder),
        SAM2: 1 + blockOrder,
        SAM3: Math.max(1, 5 - blockOrder),
        valence: 20 + blockOrder,
        arousal: 30 + blockOrder * 2,
        Anger: 4 * blockOrder,
        Fear: 4 * blockOrder + 1,
        Sadness: 4 * blockOrder + 2,
        Disgust: 4 * blockOrder + 3,
        Happiness: 4 * blockOrder + 4,
        Surprise: 4 * blockOrder + 5,
        Ownership: blockOrder,
        Agency: Math.max(1, 5 - blockOrder)
      },
      high: {
        SAM1: 9 - blockOrder,
        SAM2: 5 + blockOrder,
        SAM3: Math.min(9, 4 + blockOrder),
        valence: 75 + blockOrder,
        arousal: 80 - blockOrder,
        Anger: 70 + 2 * blockOrder,
        Fear: 70 + 2 * blockOrder + 1,
        Sadness: 70 + 2 * blockOrder + 2,
        Disgust: 70 + 2 * blockOrder + 3,
        Happiness: 70 + 2 * blockOrder + 4,
        Surprise: 70 + 2 * blockOrder + 5,
        Ownership: Math.min(7, 4 + blockOrder),
        Agency: Math.min(7, 3 + blockOrder)
      },
      zigzag: {
        SAM1: blockOrder % 2 === 0 ? 8 : 2,
        SAM2: blockOrder % 2 === 0 ? 3 : 7,
        SAM3: blockOrder % 2 === 0 ? 7 : 3,
        valence: blockOrder % 2 === 0 ? 68 : 32,
        arousal: blockOrder % 2 === 0 ? 36 : 72,
        Anger: blockOrder % 2 === 0 ? 16 : 62,
        Fear: blockOrder % 2 === 0 ? 18 : 64,
        Sadness: blockOrder % 2 === 0 ? 20 : 66,
        Disgust: blockOrder % 2 === 0 ? 22 : 68,
        Happiness: blockOrder % 2 === 0 ? 74 : 28,
        Surprise: blockOrder % 2 === 0 ? 48 : 84,
        Ownership: blockOrder % 2 === 0 ? 6 : 2,
        Agency: blockOrder % 2 === 0 ? 5 : 3
      }
    };
    return (profiles[autoRunProfile] || profiles.linear)[itemId];
  }

  function completeAssessmentForBlock(blockOrder) {
    return {
      sam: {
        valence_raw_1_9: responseValue("SAM1", blockOrder),
        arousal_raw_1_9: responseValue("SAM2", blockOrder),
        dominance_raw_1_9: responseValue("SAM3", blockOrder)
      },
      affect_vas: {
        valence_raw_0_100: responseValue("valence", blockOrder),
        arousal_raw_0_100: responseValue("arousal", blockOrder)
      },
      affect_vas_touched: {
        valence_raw_0_100: true,
        arousal_raw_0_100: true
      },
      emotion_representation_vas: {
        anger_raw_0_100: responseValue("Anger", blockOrder),
        fear_raw_0_100: responseValue("Fear", blockOrder),
        sadness_raw_0_100: responseValue("Sadness", blockOrder),
        disgust_raw_0_100: responseValue("Disgust", blockOrder),
        happiness_raw_0_100: responseValue("Happiness", blockOrder),
        surprise_raw_0_100: responseValue("Surprise", blockOrder)
      },
      hand_embodiment: {
        ownership_raw_1_7: responseValue("Ownership", blockOrder),
        agency_raw_1_7: responseValue("Agency", blockOrder)
      },
      page_complete: {
        self_assessment_manikin: false,
        affect_vas: false,
        emotion_representation_vas: false,
        hand_embodiment: false
      },
      complete: false
    };
  }

  function preloadState() {
    const draft = api.makeState();
    draft.participant_id = params.get("participant_id") || params.get("participant") || draft.participant_id || "P001";
    draft.apk_variant_id = params.get("apk_variant_id") || draft.apk_variant_id || "BG_ENV";
    const order = previewOrders[draft.counterbalance_order_id] || previewOrders.order_01;
    draft.active_panel_page_id = "demographics";
    draft.active_condition_position = 1;
    draft.active_assessment_page_id = "self_assessment_manikin";
    draft.demographics = {
      ...draft.demographics,
      language_code: "en",
      participant_first_name: "Quest",
      participant_last_name: "Validation",
      participant_name: "Quest Validation",
      age_years: 29,
      handedness: "right",
      gender: "prefer_not_to_say",
      consent_confirmed: true,
      consent_text: "I consent to participate in this study.",
      polar_validation: {
        ...draft.demographics.polar_validation,
        source: "native_pending",
        state: "waiting_for_polar_h10",
        ready: false,
        detected: false,
        connected: false,
        streaming: false,
        pmd_ready: false,
        ecg_streaming: false,
        heart_rate_bpm: 0,
        rr_interval_count: 0,
        ecg_sample_count: 0,
        pmd_frame_count: 0,
        device_id: "not connected",
        device_name: "",
        device_address: "",
        recent_ecg_samples_uv: [],
        diagnostic: "Waiting for native Polar H10 readiness"
      },
      complete: false
    };
    draft.responses_by_condition.forEach((entry, index) => {
      const conditionId = entry.vr_condition_id || entry.condition_id;
      const blockOrder = Math.max(1, order.indexOf(conditionId) + 1) || entry.assigned_position || index + 1;
      entry.assessment = completeAssessmentForBlock(blockOrder);
    });
    api.setState(draft);
    status("state_preloaded", `${draft.participant_id} ${draft.counterbalance_order_id || "order_01"} ${autoRunProfile}`);
    snapshot("quest_auto_run_state_preloaded");
  }

  function activePayload() {
    return api.exportObject();
  }

  function completedCount(payload) {
    return payload.responses_by_condition.filter((row) => row.assessment && row.assessment.complete).length;
  }

  function clickNext(payload) {
    const button = document.getElementById("nextPage");
    if (!button || button.disabled) {
      status("next_blocked", payload.active_panel_page_id);
      return false;
    }
    const now = Date.now();
    if (payload.active_panel_page_id === lastClickPage && now - lastClickAt < 1500) {
      return false;
    }
    lastClickAt = now;
    lastClickPage = payload.active_panel_page_id;
    status("click_next", `${payload.active_panel_page_id} block ${payload.active_block_position}`);
    button.click();
    window.setTimeout(() => snapshot(`quest_auto_run_click_${payload.active_panel_page_id}`), 250);
    return true;
  }

  function tick() {
    if (finished) {
      return;
    }
    const payload = activePayload();
    if (completedCount(payload) === payload.responses_by_condition.length) {
      finished = true;
      status("finished", "all questionnaire blocks complete");
      try {
        window.AndroidStudy6.onQuestAutoRunFinished(JSON.stringify(payload));
      } catch (error) {
        status("finish_failed", error && error.message ? error.message : error);
      }
      return;
    }
    if (payload.active_panel_page_id !== "vr_task_instructions") {
      clickNext(payload);
    } else {
      status("waiting_audio", `block ${payload.active_block_position}`);
    }
    window.setTimeout(tick, 1000);
  }

  if (!api) {
    status("missing_preview_api", "Questionnaire preview API is unavailable");
    return;
  }

  window.setTimeout(() => {
    preloadState();
    tick();
  }, 500);
}());

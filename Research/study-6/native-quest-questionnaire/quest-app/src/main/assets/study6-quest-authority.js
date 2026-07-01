"use strict";

(function () {
  if (window.__study6QuestAuthorityInstalled) {
    return;
  }
  window.__study6QuestAuthorityInstalled = true;

  const api = window.STUDY6_QUESTIONNAIRE_PREVIEW;
  const plan = Array.isArray(window.__STUDY6_QUEST_BLOCK_ORDER)
    ? window.__STUDY6_QUEST_BLOCK_ORDER
    : [];

  const conditionLabels = {
    en: {
      LC_LE: "Low coherence / low energy",
      LC_HE: "Low coherence / high energy",
      HC_LE: "High coherence / low energy",
      HC_HE: "High coherence / high energy"
    },
    de: {
      LC_LE: "Niedrige Kohärenz / niedrige Energie",
      LC_HE: "Niedrige Kohärenz / hohe Energie",
      HC_LE: "Hohe Kohärenz / niedrige Energie",
      HC_HE: "Hohe Kohärenz / hohe Energie"
    }
  };

  const conditionFactors = {
    LC_LE: { coherence_level: "low", energy_noise_level: "low" },
    LC_HE: { coherence_level: "low", energy_noise_level: "high" },
    HC_LE: { coherence_level: "high", energy_noise_level: "low" },
    HC_HE: { coherence_level: "high", energy_noise_level: "high" }
  };

  function status(eventType, detail) {
    try {
      window.AndroidStudy6.onQuestAutoRunStatus(eventType, String(detail || ""));
    } catch (error) {
      // Logging is best-effort during early WebView startup.
    }
  }

  if (!api || typeof api.exportObject !== "function" || plan.length === 0) {
    status("authority_missing", "preview API or block plan unavailable");
    return;
  }

  const originalExportObject = api.exportObject.bind(api);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function numericPosition(row) {
    return Number(row.block_position || row.block_order || row.condition_position || 1);
  }

  function planForPosition(position) {
    return plan.find((row) => numericPosition(row) === position) || plan[0];
  }

  function languageCodeFor(payload) {
    const demographics = payload && payload.demographics ? payload.demographics : {};
    return demographics.language_code === "de" ? "de" : "en";
  }

  function text(languageCode, en, de) {
    return languageCode === "de" ? de : en;
  }

  function sessionCount(languageCode, position, total) {
    return text(languageCode, `Session ${position} of ${total}`, `Sitzung ${position} von ${total}`);
  }

  function conditionLabel(conditionId, languageCode) {
    const labels = conditionLabels[languageCode] || conditionLabels.en;
    return labels[conditionId] || conditionId || text(languageCode, "VR task", "VR-Aufgabe");
  }

  function fieldsFor(row) {
    const conditionId = row.vr_condition_id || row.condition_id;
    const factors = conditionFactors[conditionId] || {};
    return {
      condition_id: conditionId,
      vr_condition_id: conditionId,
      coherence_level: row.coherence_level || factors.coherence_level || null,
      energy_noise_level: row.energy_noise_level || factors.energy_noise_level || null
    };
  }

  function assessmentByPosition(payload) {
    const map = new Map();
    (payload.responses_by_condition || []).forEach((row) => {
      map.set(numericPosition(row), clone(row.assessment));
    });
    return map;
  }

  function authoritativeBlockMap() {
    return plan.map((row) => ({
      block_position: numericPosition(row),
      ...fieldsFor(row)
    }));
  }

  function authoritativeResponses(payload) {
    const source = assessmentByPosition(payload);
    return plan.map((row) => {
      const position = numericPosition(row);
      return {
        block_position: position,
        condition_position: position,
        ...fieldsFor(row),
        audio_variant_id: row.audio_variant_id || null,
        audio_instruction_id: row.audio_instruction_id || null,
        assessment: source.get(position) || null
      };
    });
  }

  function applyAuthority(payload) {
    const adjusted = clone(payload);
    const activePosition = Number(payload.active_block_position || payload.active_condition_position || 1);
    const active = planForPosition(activePosition);
    const activeFields = fieldsFor(active);

    adjusted.native_contract_authority = {
      ...(adjusted.native_contract_authority || {}),
      condition_block_sequence: authoritativeBlockMap()
    };
    adjusted.counterbalance = {
      ...(adjusted.counterbalance || {}),
      order_id: `lookup_${active.permutation_id || "participant"}`,
      condition_ids: plan.map((row) => row.vr_condition_id || row.condition_id),
      block_condition_map: authoritativeBlockMap(),
      assignment_policy: "authoritative 24-permutation backend lookup",
      editable_in_native_panel: false,
      participant_input_required: false
    };
    adjusted.audio_instruction_randomization = {
      ...(adjusted.audio_instruction_randomization || {}),
      authoritative_assignments: plan.map((row) => ({
        block_position: numericPosition(row),
        audio_variant_id: row.audio_variant_id || null,
        audio_instruction_id: row.audio_instruction_id || null,
        audio_asset_file: row.audio_asset_file || null
      }))
    };
    adjusted.active_condition_id = activeFields.condition_id;
    adjusted.active_vr_condition_id = activeFields.vr_condition_id;
    adjusted.active_coherence_level = activeFields.coherence_level;
    adjusted.active_energy_noise_level = activeFields.energy_noise_level;
    adjusted.responses_by_condition = authoritativeResponses(payload);
    return adjusted;
  }

  api.exportObject = function exportObjectWithQuestAuthority() {
    return applyAuthority(originalExportObject());
  };

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element && element.textContent !== text) {
      element.textContent = text;
    }
  }

  function patchVisibleLabels() {
    const payload = api.exportObject();
    const position = Number(payload.active_block_position || payload.active_condition_position || 1);
    const active = planForPosition(position);
    const conditionId = active.vr_condition_id || active.condition_id;
    const languageCode = languageCodeFor(payload);
    const label = conditionLabel(conditionId, languageCode);
    const audioLabel = active.audio_variant_id
      ? `Audio ${active.audio_variant_id}`
      : text(languageCode, "Audio ready", "Audio bereit");
    if (payload.active_panel_page_id === "session_ready") {
      setText("sessionReadyKicker", sessionCount(languageCode, position, plan.length || 4));
      setText("sessionReadyConditionLabel", label);
      setText("sessionReadyBlockLabel", sessionCount(languageCode, position, plan.length || 4));
      setText(
        "sessionReadyAudioLabel",
        text(
          languageCode,
          `${audioLabel} will start when you press Start next session.`,
          `${audioLabel} startet, wenn Sie Nächste Sitzung starten drücken.`
        )
      );
    }
    if (payload.active_panel_page_id === "vr_task_instructions") {
      setText("inductionConditionLabel", label);
      setText("inductionAudioLabel", audioLabel);
    }
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(patchVisibleLabels);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.setInterval(patchVisibleLabels, 1000);
  patchVisibleLabels();
  status("authority_installed", plan.map((row) => row.vr_condition_id || row.condition_id).join(","));
}());

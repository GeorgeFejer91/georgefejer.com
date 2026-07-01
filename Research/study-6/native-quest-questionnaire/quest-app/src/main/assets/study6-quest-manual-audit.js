"use strict";

(function () {
  if (window.__study6QuestManualAuditInstalled) {
    return;
  }
  window.__study6QuestManualAuditInstalled = true;

  const api = window.STUDY6_QUESTIONNAIRE_PREVIEW;

  function safeExport() {
    try {
      return api && typeof api.exportObject === "function" ? api.exportObject() : {};
    } catch (error) {
      return {};
    }
  }

  function textOf(element) {
    return (element && element.textContent ? element.textContent : "").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  function valueSummary(element) {
    if (!element) {
      return null;
    }
    if (element.type === "range" || element.type === "number" || element.tagName === "SELECT") {
      return String(element.value || "");
    }
    if (element.type === "checkbox") {
      return element.checked ? "checked" : "unchecked";
    }
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      return `length:${String(element.value || "").length}`;
    }
    return null;
  }

  function closestControl(target) {
    if (!target || !target.closest) {
      return target || null;
    }
    return target.closest("button,input,select,textarea,canvas,[role='button']") || target;
  }

  function controlGroup(element) {
    const id = element && element.id ? element.id : "";
    if (id.startsWith("demographics.language.")) return "language";
    if (id === "participantFirstName") return "participant_first_name";
    if (id === "participantLastName") return "participant_last_name";
    if (id === "participantAge") return "participant_age";
    if (id.startsWith("demographics.handedness.")) return "handedness";
    if (id.startsWith("demographics.gender.")) return "gender";
    if (id === "consentCheckbox") return "consent";
    if (id === "sessionReadyStart") return "session_ready";
    if (id === "previousPage") return "previous_page";
    if (id === "nextPage") return "next_page";
    if (id.startsWith("sam.")) return "sam";
    if (id === "valence" || id === "arousal") return "affect_vas";
    if (id.startsWith("emotion_representation_vas.")) return "emotion_representation_vas";
    if (id.startsWith("Ownership_") || id.startsWith("Agency_")) return "hand_embodiment";
    return "";
  }

  function targetDescriptor(target) {
    const element = closestControl(target);
    if (!element) {
      return {};
    }
    return {
      id: element.id || "",
      tag: element.tagName || "",
      type: element.type || "",
      role: element.getAttribute ? (element.getAttribute("role") || "") : "",
      class_name: element.className && typeof element.className === "string" ? element.className.slice(0, 160) : "",
      control_group: controlGroup(element),
      item_id: element.dataset ? (element.dataset.itemId || "") : "",
      variable_name: element.dataset ? (element.dataset.variableName || "") : "",
      aria_pressed: element.getAttribute ? (element.getAttribute("aria-pressed") || "") : "",
      aria_label: element.getAttribute ? (element.getAttribute("aria-label") || "").slice(0, 160) : "",
      checked: typeof element.checked === "boolean" ? element.checked : null,
      value_summary: valueSummary(element),
      text: textOf(element)
    };
  }

  function validationSummary() {
    const node = document.getElementById("validationSummary");
    return textOf(node);
  }

  function nextDisabled() {
    const next = document.getElementById("nextPage");
    return Boolean(next && next.disabled);
  }

  function payloadFor(event, extra) {
    const exported = safeExport();
    const target = targetDescriptor(event && event.target);
    return {
      audit_schema: "study6.manual-interaction.v1",
      source: "manual_audit",
      event_name: event ? event.type : "",
      is_trusted: event ? Boolean(event.isTrusted) : null,
      pointer_type: event && event.pointerType ? event.pointerType : "",
      key: event && event.key ? event.key : "",
      active_panel_page_id: exported.active_panel_page_id || "",
      active_block_position: exported.active_block_position || exported.active_condition_position || null,
      active_assessment_page_id: exported.active_assessment_page_id || "",
      active_vr_condition_id: exported.active_vr_condition_id || "",
      validation_summary: validationSummary(),
      next_disabled: nextDisabled(),
      target,
      ...extra
    };
  }

  function emit(eventType, event, extra) {
    try {
      window.AndroidStudy6.onManualInteraction(eventType, JSON.stringify(payloadFor(event, extra || {})));
    } catch (error) {
      // Manual audit is evidence-only. Never block participant interaction.
    }
  }

  document.addEventListener("pointerdown", (event) => {
    const control = closestControl(event.target);
    if (control && control.id === "nextPage" && control.disabled) {
      emit("manual_next_blocked_attempt", event, { blocked_reason: validationSummary() });
      return;
    }
    emit("manual_pointerdown", event);
  }, true);

  document.addEventListener("click", (event) => {
    const control = closestControl(event.target);
    if (control && control.id === "nextPage") {
      emit(control.disabled ? "manual_next_blocked_attempt" : "manual_next_continue_attempt", event, {
        blocked_reason: control.disabled ? validationSummary() : ""
      });
      return;
    }
    emit("manual_click", event);
  }, true);

  document.addEventListener("input", (event) => {
    emit("manual_input", event);
  }, true);

  document.addEventListener("change", (event) => {
    emit("manual_change", event);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (["Tab", "Enter", " ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
      emit("manual_keydown", event);
    }
  }, true);

  emit("manual_audit_ready", null, { ready: true });
}());

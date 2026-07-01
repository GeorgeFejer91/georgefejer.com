package com.georgefejer.study6.quest;

import android.content.Context;
import android.content.res.AssetManager;
import android.os.SystemClock;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class Study6RunLogger {
    private static final String TAG = "Study6RunLogger";
    private static final String PROTOCOL_VERSION = "quest.questionnaire.v1";
    private static final String SCHEMA_ID = "study6-questionnaire-v8";
    private static final String MARKER_SCHEMA = "study6-physiology-marker-v1";
    private static final String DEFAULT_LANGUAGE_CODE = "en";

    private final Context context;
    private final String apkVariantId;
    private final int devDurationSeconds;
    private final JSONObject lookup;
    private final JSONObject apkVariant;
    private final JSONObject participantAllocation;
    private final String participantId;
    private final String sessionId;
    private final File rootDir;
    private final File dataDir;
    private final File demographicsDir;
    private final Study6AnalysisExporter analysisExporter;
    private final Set<Integer> writtenResultBlocks = new HashSet<>();
    private final Set<Integer> readinessPromptBlocks = new HashSet<>();
    private final Set<Integer> readinessConfirmedBlocks = new HashSet<>();
    private final Map<Integer, JSONObject> blockPhysiologySummaries = new HashMap<>();
    private String currentLanguageCode = DEFAULT_LANGUAGE_CODE;
    private JSONObject latestPolarStatus = new JSONObject();

    Study6RunLogger(Context context, String apkVariantId, int devDurationSeconds, String requestedParticipantId) {
        this.context = context.getApplicationContext();
        this.apkVariantId = apkVariantId;
        this.devDurationSeconds = devDurationSeconds;
        try {
            this.lookup = readAssetJson("for-ai/study6_apk_permutation_lookup.json");
            this.apkVariant = findObject(lookup.getJSONArray("apk_variants"), "apk_variant_id", apkVariantId);
            this.rootDir = new File(context.getFilesDir(), "study6-dev/" + apkVariant.getString("data_folder"));
            this.dataDir = new File(rootDir, "data");
            this.demographicsDir = new File(rootDir, "demographics");
            this.analysisExporter = new Study6AnalysisExporter(this.context, apkVariantId, lookup, apkVariant, rootDir, dataDir, demographicsDir);
            JSONObject existingState = readFileJson(new File(rootDir, "allocation_state.json"));
            this.participantAllocation = chooseParticipantAllocation(requestedParticipantId, existingState);
            this.participantId = participantAllocation.getString("participant_id");
            this.sessionId = participantId + "_" + apkVariantId + "_DEV";
            ensureDataLayout();
            refreshAnalysisExport();
        } catch (JSONException | IOException error) {
            throw new IllegalStateException("Unable to initialize Study 6 logger", error);
        }
    }

    String participantId() {
        return participantId;
    }

    String sessionId() {
        return sessionId;
    }

    String apkVariantId() {
        return apkVariantId;
    }

    String apkFileCode() {
        return apkVariant.optString("apk_file_code", apkVariantId);
    }

    File ecgMasterCsvFile() {
        return new File(dataDir, apkFileCode() + "_" + participantId + "_session_ECG_PolarH10_master.csv");
    }

    String ecgMasterRelativeFile() {
        return "data/" + ecgMasterCsvFile().getName();
    }

    String markerRelativeFile() {
        return "data/" + markerFile().getName();
    }

    File ecgCsvFile(BlockPlan plan) {
        return new File(dataDir, plan.blockFileStem + "_ECG_PolarH10.csv");
    }

    String ecgRelativeFile(BlockPlan plan) {
        return "data/" + plan.blockFileStem + "_ECG_PolarH10.csv";
    }

    boolean allExpectedResultsWritten() {
        return writtenResultBlocks.size() >= expectedBlockCount();
    }

    void updatePolarStatus(JSONObject status) {
        if (status == null) {
            latestPolarStatus = new JSONObject();
            return;
        }
        try {
            latestPolarStatus = new JSONObject(status.toString());
        } catch (JSONException error) {
            latestPolarStatus = status;
        }
    }

    String questBlockOrderJson() {
        JSONArray blocks = new JSONArray();
        for (int blockPosition = 1; blockPosition <= expectedBlockCount(); blockPosition++) {
            BlockPlan plan = blockPlan(blockPosition);
            JSONObject block = new JSONObject();
            put(block, "participant_id", participantId);
            put(block, "permutation_id", plan.permutationId);
            put(block, "block_order", plan.blockPosition);
            put(block, "block_position", plan.blockPosition);
            put(block, "block_id", plan.blockId);
            put(block, "block_file_stem", plan.blockFileStem);
            put(block, "condition_id", plan.vrConditionId);
            put(block, "vr_condition_id", plan.vrConditionId);
            put(block, "coherence_level", plan.coherenceLevel);
            put(block, "energy_noise_level", plan.energyNoiseLevel);
            put(block, "audio_variant_id", plan.audioVariantId);
            put(block, "audio_instruction_id", plan.audioInstructionId);
            put(block, "audio_asset_file", plan.audioAssetFile);
            blocks.put(block);
        }
        return blocks.toString();
    }

    void logHarnessStarted() {
        logHarnessEvent("harness_started", "Study 6 Quest questionnaire harness started");
        writeAllocationState(false);
        logHarnessEvent("participant_allocated", participantId + " " + participantAllocation.optString("permutation_id"));
        writeDemographicsPlaceholder();
    }

    void logHarnessEvent(String eventType, String detail) {
        JSONObject event = new JSONObject();
        put(event, "event_type", eventType);
        put(event, "detail", detail);
        put(event, "recorded_at_utc", Instant.now().toString());
        appendJsonl(new File(dataDir, "runtime_events.jsonl"), event);
    }

    void logSnapshot(String reason, JSONObject snapshot) {
        currentLanguageCode = languageCodeFromSnapshot(snapshot);
        String activePageId = snapshot.optString("active_panel_page_id", "");
        int activeBlockPosition = snapshot.optInt("active_block_position", snapshot.optInt("active_condition_position", 1));
        JSONObject row = new JSONObject();
        put(row, "event_type", "questionnaire_snapshot");
        put(row, "reason", reason);
        put(row, "active_panel_page_id", activePageId);
        put(row, "active_block_position", activeBlockPosition);
        put(row, "language_code", currentLanguageCode);
        put(row, "recorded_at_utc", Instant.now().toString());
        appendJsonl(new File(dataDir, "webview_snapshots.jsonl"), row);
        logReadinessTransition(activePageId, activeBlockPosition, currentLanguageCode);
        writeDemographicsFromSnapshot(snapshot);
    }

    private void logReadinessTransition(String activePageId, int activeBlockPosition, String languageCode) {
        if (activeBlockPosition <= 0 || activeBlockPosition > expectedBlockCount()) {
            return;
        }
        if ("session_ready".equals(activePageId) && readinessPromptBlocks.add(activeBlockPosition)) {
            logBlockEvent(blockPlan(activeBlockPosition, languageCode), "session_ready_prompt_shown", null);
            return;
        }
        if ("vr_task_instructions".equals(activePageId) && readinessConfirmedBlocks.add(activeBlockPosition)) {
            logBlockEvent(blockPlan(activeBlockPosition, languageCode), "session_start_confirmed", null);
        }
    }

    private String languageCodeFromSnapshot(JSONObject snapshot) {
        JSONObject demographics = snapshot == null ? null : snapshot.optJSONObject("demographics");
        if (demographics == null) {
            return currentLanguageCode;
        }
        return normalizeLanguageCode(demographics.optString("language_code", currentLanguageCode));
    }

    private String normalizeLanguageCode(String languageCode) {
        return "de".equals(languageCode) ? "de" : DEFAULT_LANGUAGE_CODE;
    }

    void logManualInteraction(String eventType, JSONObject payload) {
        JSONObject event = new JSONObject();
        put(event, "event_type", eventType);
        put(event, "participant_id", participantId);
        put(event, "apk_variant_id", apkVariantId);
        put(event, "session_id", sessionId);
        put(event, "recorded_at_utc", Instant.now().toString());
        put(event, "detail", payload);
        appendJsonl(new File(dataDir, "manual_interactions.jsonl"), event);

        if ("manual_next_blocked_attempt".equals(eventType)) {
            JSONObject extra = new JSONObject();
            put(extra, "source", "manual_interaction_audit");
            put(extra, "active_panel_page_id", payload.optString("active_panel_page_id", ""));
            put(extra, "active_assessment_page_id", payload.optString("active_assessment_page_id", ""));
            put(extra, "validation_summary", payload.optString("validation_summary", ""));
            put(extra, "target_id", payload.optJSONObject("target") == null ? "" : payload.optJSONObject("target").optString("id", ""));
            int blockPosition = payload.optInt("active_block_position", 0);
            if (blockPosition > 0 && !"demographics".equals(payload.optString("active_panel_page_id", ""))) {
                logBlockEvent(blockPlan(blockPosition), "validation_failure", extra);
            } else {
                logHarnessEvent("validation_failure", extra.toString());
            }
        }
    }

    BlockPlan blockPlan(int blockPosition) {
        return blockPlan(blockPosition, currentLanguageCode);
    }

    BlockPlan blockPlan(int blockPosition, String languageCode) {
        try {
            String planLanguageCode = normalizeLanguageCode(languageCode);
            String permutationId = participantAllocation.getString("permutation_id");
            JSONObject conditionPermutation = findObject(lookup.getJSONArray("condition_permutations"), "permutation_id", permutationId);
            JSONObject audioPermutation = findObject(lookup.getJSONArray("audio_permutations"), "permutation_id", permutationId);
            JSONObject conditionBlock = findBlock(conditionPermutation.getJSONArray("block_order"), blockPosition);
            JSONObject audioBlock = findBlock(audioPermutation.getJSONArray("audio_order"), blockPosition);
            JSONObject condition = findObject(lookup.getJSONArray("conditions"), "vr_condition_id", conditionBlock.getString("vr_condition_id"));
            JSONObject audio = findObject(lookup.getJSONArray("audio_variants"), "audio_variant_id", audioBlock.getString("audio_variant_id"));
            String blockId = "B" + String.format("%02d", blockPosition);
            String apkFileCode = apkVariant.getString("apk_file_code");
            String blockFileStem = apkFileCode + "_" + participantId + "_" + blockId + "_" + condition.getString("vr_condition_id");
            JSONObject audioFileByLanguage = audio.getJSONObject("audio_asset_file_by_language");
            JSONObject audioUrlByLanguage = audio.getJSONObject("audio_asset_url_by_language");
            String audioFile = audioFileByLanguage.optString(planLanguageCode, audioFileByLanguage.getString(DEFAULT_LANGUAGE_CODE));
            return new BlockPlan(
                    blockPosition,
                    blockId,
                    blockFileStem,
                    apkFileCode,
                    apkVariant.getString("mapping_target"),
                    condition.getString("vr_condition_id"),
                    condition.getString("coherence_level"),
                    condition.getString("energy_noise_level"),
                    audio.getString("audio_variant_id"),
                    audio.getString("audio_instruction_id"),
                    planLanguageCode,
                    audioFile,
                    audioUrlByLanguage.optString(planLanguageCode, audioUrlByLanguage.getString(DEFAULT_LANGUAGE_CODE)),
                    permutationId
            );
        } catch (JSONException error) {
            throw new IllegalStateException("Unable to build block plan for " + blockPosition, error);
        }
    }

    void logBlockStarted(BlockPlan plan) {
        JSONObject metadata = baseBlockMetadata(plan);
        put(metadata, "block_started_at_utc", Instant.now().toString());
        put(metadata, "technical_failure", false);
        put(metadata, "block_complete", false);
        writeJsonAtomic(new File(dataDir, plan.blockFileStem + "_block_metadata.json"), metadata);
        logBlockEvent(plan, "block_assigned", null);
        logBlockEvent(plan, "block_started", null);
    }

    void logSessionPhysiologyStarted(JSONObject extra) {
        logSessionMarker("session_physiology_started", extra);
    }

    void logPolarConnected(JSONObject extra) {
        logSessionMarker("polar_connected", extra);
    }

    void logPolarEcgStreamStarted(JSONObject extra) {
        logSessionMarker("polar_ecg_stream_started", extra);
    }

    void logPolarEcgStreamStopped(JSONObject extra) {
        logSessionMarker("polar_ecg_stream_stopped", extra);
    }

    void logSessionPhysiologyCompleted(JSONObject extra) {
        logSessionMarker("session_physiology_completed", extra);
    }

    void logPolarRuntimeMarker(BlockPlan plan, String eventType, JSONObject extra) {
        if (plan == null) {
            logSessionMarker(eventType, extra);
        } else {
            logPhysiologyMarker(plan, eventType, extra);
        }
    }

    void logPhysiologyFailure(BlockPlan plan, String failureCode, String failureMessage, String qcFlag, JSONObject extra) {
        JSONObject payload = new JSONObject();
        merge(payload, extra);
        put(payload, "failure_code", failureCode);
        put(payload, "failure_message", failureMessage == null ? "" : failureMessage);
        put(payload, "qc_flag", qcFlag == null ? "technical_failure" : qcFlag);
        logPhysiologyMarker(plan, failureCode, payload);
    }

    void logAudioStarted(BlockPlan plan, JSONObject sync) {
        JSONObject extra = new JSONObject();
        put(extra, "audio_asset_file", plan.audioAssetFile);
        put(extra, "audio_variant_id", plan.audioVariantId);
        merge(extra, sync);
        logBlockEvent(plan, "audio_started", extra);
    }

    void logConditionStarted(BlockPlan plan, JSONObject sync) {
        JSONObject extra = new JSONObject();
        put(extra, "audio_asset_file", plan.audioAssetFile);
        put(extra, "audio_variant_id", plan.audioVariantId);
        merge(extra, sync);
        logBlockEvent(plan, "condition_started", extra);
    }

    void logAudioStoppedAtDevDuration(BlockPlan plan, JSONObject sync) {
        JSONObject extra = new JSONObject();
        put(extra, "dev_duration_s", devDurationSeconds);
        merge(extra, sync);
        logBlockEvent(plan, "audio_stopped_dev_duration", extra);
    }

    void logConditionEnded(BlockPlan plan, JSONObject sync) {
        JSONObject extra = new JSONObject();
        put(extra, "dev_duration_s", devDurationSeconds);
        merge(extra, sync);
        logBlockEvent(plan, "condition_ended", extra);
    }

    void logAudioCompletedBeforeDevDuration(BlockPlan plan) {
        JSONObject extra = new JSONObject();
        put(extra, "dev_duration_s", devDurationSeconds);
        logBlockEvent(plan, "audio_completed_before_dev_duration", extra);
    }

    void logEcgRecordingArmed(BlockPlan plan, JSONObject extra) {
        logBlockEvent(plan, "ecg_recording_armed", extra);
    }

    void logEcgRecordingStarted(BlockPlan plan, JSONObject extra) {
        logBlockEvent(plan, "ecg_recording_started", extra);
    }

    void logEcgRecordingCompleted(BlockPlan plan, JSONObject extra) {
        rememberBlockPhysiology(plan, extra);
        logBlockEvent(plan, "ecg_recording_completed", extra);
    }

    void logBlockEcgWindowClosed(BlockPlan plan, JSONObject extra) {
        rememberBlockPhysiology(plan, extra);
        logBlockEvent(plan, "block_ecg_window_closed", extra);
    }

    private void rememberBlockPhysiology(BlockPlan plan, JSONObject extra) {
        if (plan == null || extra == null) {
            return;
        }
        try {
            blockPhysiologySummaries.put(plan.blockPosition, new JSONObject(extra.toString()));
        } catch (JSONException error) {
            blockPhysiologySummaries.put(plan.blockPosition, extra);
        }
    }

    void logTechnicalFailure(BlockPlan plan, String code, String message) {
        JSONObject extra = new JSONObject();
        put(extra, "failure_code", code);
        put(extra, "failure_message", message);
        logBlockEvent(plan, "technical_failure", extra);
    }

    void writeCompletedResultsIfNeeded(JSONObject snapshot) {
        String languageCode = languageCodeFromSnapshot(snapshot);
        JSONArray responses = snapshot.optJSONArray("responses_by_condition");
        if (responses == null) {
            return;
        }
        for (int i = 0; i < responses.length(); i++) {
            JSONObject response = responses.optJSONObject(i);
            if (response == null) {
                continue;
            }
            int blockPosition = response.optInt("block_position", response.optInt("condition_position", i + 1));
            if (writtenResultBlocks.contains(blockPosition)) {
                continue;
            }
            JSONObject assessment = response.optJSONObject("assessment");
            if (assessment == null || !assessment.optBoolean("complete", false)) {
                continue;
            }
            BlockPlan plan = blockPlan(blockPosition, languageCode);
            writeResult(plan, assessment);
            writtenResultBlocks.add(blockPosition);
            if (writtenResultBlocks.size() == expectedBlockCount()) {
                writeAllocationState(true);
                logHarnessEvent("participant_completed", participantId);
            }
        }
    }

    private void writeResult(BlockPlan plan, JSONObject assessment) {
        logBlockEvent(plan, "questionnaire_started", null);
        for (String pageId : new String[]{"self_assessment_manikin", "affect_vas", "emotion_representation_vas", "hand_embodiment"}) {
            JSONObject extra = new JSONObject();
            put(extra, "page_id", pageId);
            logBlockEvent(plan, "page_completed", extra);
        }
        logBlockEvent(plan, "questionnaire_completed", null);

        JSONObject result = new JSONObject();
        put(result, "protocol_version", PROTOCOL_VERSION);
        put(result, "schema_id", SCHEMA_ID);
        put(result, "participant_id", participantId);
        put(result, "session_id", sessionId);
        put(result, "apk_variant_id", apkVariantId);
        put(result, "apk_file_code", plan.apkFileCode);
        put(result, "mapping_target", plan.mappingTarget);
        put(result, "block_order", plan.blockPosition);
        put(result, "block_id", plan.blockId);
        put(result, "block_file_stem", plan.blockFileStem);
        put(result, "condition_id", plan.vrConditionId);
        put(result, "vr_condition_id", plan.vrConditionId);
        put(result, "coherence_level", plan.coherenceLevel);
        put(result, "energy_noise_level", plan.energyNoiseLevel);
        put(result, "language_code", plan.languageCode);
        put(result, "answers", wrapAnswers(assessment));
        JSONObject pageComplete = new JSONObject();
        put(pageComplete, "self_assessment_manikin", true);
        put(pageComplete, "affect_vas", true);
        put(pageComplete, "emotion_representation_vas", true);
        put(pageComplete, "hand_embodiment", true);
        put(result, "page_complete", pageComplete);
        put(result, "complete", true);
        writeJsonAtomic(new File(dataDir, plan.blockFileStem + "_questionnaire_result.json"), result);

        appendQuestionnaireRows(plan, assessment);
        appendBlockMetadataRow(plan);
        writeCompletedBlockMetadata(plan);
        logBlockEvent(plan, "result_write_success", null);
        logBlockEvent(plan, "block_completed", null);
        refreshAnalysisExport();
    }

    private JSONObject wrapAnswers(JSONObject assessment) {
        JSONObject answers = new JSONObject();
        JSONObject emotionAssessment = new JSONObject();
        put(emotionAssessment, "sam", assessment.optJSONObject("sam"));
        put(emotionAssessment, "affect_vas", assessment.optJSONObject("affect_vas"));
        put(emotionAssessment, "emotion_representation_vas", assessment.optJSONObject("emotion_representation_vas"));
        put(emotionAssessment, "hand_embodiment", assessment.optJSONObject("hand_embodiment"));
        put(answers, "emotion_assessment", emotionAssessment);
        return answers;
    }

    private void appendQuestionnaireRows(BlockPlan plan, JSONObject assessment) {
        File csv = new File(dataDir, "questionnaire_responses_long.csv");
        if (!csv.exists()) {
            appendLine(csv, "response_id,apk_file_code,participant_id,apk_variant_id,block_order,block_id,vr_condition_id,item_id,item_value,item_scale,recorded_at_utc");
        }
        try {
            JSONArray items = lookup.getJSONArray("questionnaire_items");
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                String itemId = item.getString("item_id");
                Object value = valueForItem(assessment, itemId);
                String responseId = plan.blockFileStem + "_" + itemId;
                appendLine(csv, csv(responseId, plan.apkFileCode, participantId, apkVariantId,
                        String.valueOf(plan.blockPosition), plan.blockId, plan.vrConditionId, itemId,
                        String.valueOf(value), item.getString("scale"), Instant.now().toString()));
            }
        } catch (JSONException error) {
            logTechnicalFailure(plan, "csv_write_failed", error.getMessage());
        }
    }

    private Object valueForItem(JSONObject assessment, String itemId) {
        JSONObject sam = assessment.optJSONObject("sam");
        JSONObject affectVas = assessment.optJSONObject("affect_vas");
        JSONObject emotionVas = assessment.optJSONObject("emotion_representation_vas");
        JSONObject hand = assessment.optJSONObject("hand_embodiment");
        switch (itemId) {
            case "SAM1":
                return sam == null ? JSONObject.NULL : sam.opt("valence_raw_1_9");
            case "SAM2":
                return sam == null ? JSONObject.NULL : sam.opt("arousal_raw_1_9");
            case "SAM3":
                return sam == null ? JSONObject.NULL : sam.opt("dominance_raw_1_9");
            case "valence":
                return affectVas == null ? JSONObject.NULL : affectVas.opt("valence_raw_0_100");
            case "arousal":
                return affectVas == null ? JSONObject.NULL : affectVas.opt("arousal_raw_0_100");
            case "Anger":
                return emotionVas == null ? JSONObject.NULL : emotionVas.opt("anger_raw_0_100");
            case "Fear":
                return emotionVas == null ? JSONObject.NULL : emotionVas.opt("fear_raw_0_100");
            case "Sadness":
                return emotionVas == null ? JSONObject.NULL : emotionVas.opt("sadness_raw_0_100");
            case "Disgust":
                return emotionVas == null ? JSONObject.NULL : emotionVas.opt("disgust_raw_0_100");
            case "Happiness":
                return emotionVas == null ? JSONObject.NULL : emotionVas.opt("happiness_raw_0_100");
            case "Surprise":
                return emotionVas == null ? JSONObject.NULL : emotionVas.opt("surprise_raw_0_100");
            case "Ownership":
                return hand == null ? JSONObject.NULL : hand.opt("ownership_raw_1_7");
            case "Agency":
                return hand == null ? JSONObject.NULL : hand.opt("agency_raw_1_7");
            default:
                return JSONObject.NULL;
        }
    }

    private void appendBlockMetadataRow(BlockPlan plan) {
        File csv = new File(dataDir, "block_metadata_long.csv");
        if (!csv.exists()) {
            appendLine(csv, "block_file_stem,participant_id,apk_variant_id,block_order,block_id,vr_condition_id,audio_variant_id,technical_failure,block_complete,polar_device_id,polar_ready_at_session_start,polar_ready_at_block_start,ecg_sample_count,ecg_expected_sample_count,ecg_sample_coverage_ratio,ecg_gap_count,max_ecg_gap_ms,total_ecg_gap_ms,polar_reconnect_count,ecg_qc_valid,ecg_qc_flag");
        }
        JSONObject metadata = baseBlockMetadata(plan);
        appendLine(csv, csv(plan.blockFileStem, participantId, apkVariantId, String.valueOf(plan.blockPosition),
                plan.blockId, plan.vrConditionId, plan.audioVariantId, "false", "true",
                metadata.optString("polar_device_id", ""),
                stringOpt(metadata, "polar_ready_at_session_start"),
                stringOpt(metadata, "polar_ready_at_block_start"),
                stringOpt(metadata, "ecg_sample_count"),
                stringOpt(metadata, "ecg_expected_sample_count"),
                stringOpt(metadata, "ecg_sample_coverage_ratio"),
                stringOpt(metadata, "ecg_gap_count"),
                stringOpt(metadata, "max_ecg_gap_ms"),
                stringOpt(metadata, "total_ecg_gap_ms"),
                stringOpt(metadata, "polar_reconnect_count"),
                stringOpt(metadata, "ecg_qc_valid"),
                metadata.optString("ecg_qc_flag", "")));
    }

    private void writeCompletedBlockMetadata(BlockPlan plan) {
        JSONObject metadata = baseBlockMetadata(plan);
        put(metadata, "block_completed_at_utc", Instant.now().toString());
        put(metadata, "technical_failure", false);
        put(metadata, "block_complete", true);
        writeJsonAtomic(new File(dataDir, plan.blockFileStem + "_block_metadata.json"), metadata);
    }

    private JSONObject baseBlockMetadata(BlockPlan plan) {
        JSONObject metadata = new JSONObject();
        put(metadata, "participant_id", participantId);
        put(metadata, "session_id", sessionId);
        put(metadata, "apk_variant_id", apkVariantId);
        put(metadata, "apk_file_code", plan.apkFileCode);
        put(metadata, "mapping_target", plan.mappingTarget);
        put(metadata, "apk_package_name", context.getPackageName());
        put(metadata, "apk_build_version", "0.1.0-dev");
        put(metadata, "apk_run_position", 1);
        put(metadata, "global_block_position", plan.blockPosition);
        put(metadata, "apk_block_position", plan.blockPosition);
        put(metadata, "permutation_id", plan.permutationId);
        put(metadata, "block_order", plan.blockPosition);
        put(metadata, "block_id", plan.blockId);
        put(metadata, "block_file_stem", plan.blockFileStem);
        put(metadata, "block_metadata_file", "data/" + plan.blockFileStem + "_block_metadata.json");
        put(metadata, "event_log_file", "data/" + plan.blockFileStem + "_events.jsonl");
        put(metadata, "ecg_file", "data/" + plan.blockFileStem + "_ECG_PolarH10.csv");
        put(metadata, "ecg_master_file", ecgMasterRelativeFile());
        put(metadata, "physiology_marker_file", markerRelativeFile());
        put(metadata, "questionnaire_append_file", "data/questionnaire_responses_long.csv");
        put(metadata, "condition_id", plan.vrConditionId);
        put(metadata, "vr_condition_id", plan.vrConditionId);
        put(metadata, "coherence_level", plan.coherenceLevel);
        put(metadata, "energy_noise_level", plan.energyNoiseLevel);
        put(metadata, "audio_variant_id", plan.audioVariantId);
        put(metadata, "audio_instruction_id", plan.audioInstructionId);
        put(metadata, "language_code", plan.languageCode);
        put(metadata, "audio_asset_file", plan.audioAssetFile);
        put(metadata, "audio_asset_url", plan.audioAssetUrl);
        put(metadata, "induction_target_duration_s", 300);
        put(metadata, "induction_dev_duration_s", devDurationSeconds);
        addPhysiologyMetadata(metadata, plan);
        return metadata;
    }

    private void addPhysiologyMetadata(JSONObject metadata, BlockPlan plan) {
        JSONObject physiology = blockPhysiologySummaries.get(plan.blockPosition);
        put(metadata, "polar_device_id", firstNonEmpty(
                physiology == null ? "" : firstNonEmpty(physiology.optString("polar_device_id", ""), physiology.optString("device_id", "")),
                latestPolarStatus.optString("polar_device_id", latestPolarStatus.optString("device_id", ""))));
        put(metadata, "polar_ready_at_session_start", physiology == null
                ? latestPolarStatus.optBoolean("session_ready_observed", false)
                : physiology.optBoolean("polar_ready_at_session_start", false));
        put(metadata, "polar_ready_at_block_start", physiology == null
                ? JSONObject.NULL
                : physiology.opt("polar_ready_at_block_start"));
        put(metadata, "ecg_sample_count", physiology == null ? JSONObject.NULL : physiology.opt("ecg_sample_count"));
        put(metadata, "ecg_expected_sample_count", physiology == null ? JSONObject.NULL : physiology.opt("ecg_expected_sample_count"));
        put(metadata, "ecg_sample_coverage_ratio", physiology == null ? JSONObject.NULL : physiology.opt("ecg_sample_coverage_ratio"));
        put(metadata, "ecg_gap_count", physiology == null ? JSONObject.NULL : physiology.opt("ecg_gap_count"));
        put(metadata, "max_ecg_gap_ms", physiology == null ? JSONObject.NULL : physiology.opt("max_ecg_gap_ms"));
        put(metadata, "total_ecg_gap_ms", physiology == null ? JSONObject.NULL : physiology.opt("total_ecg_gap_ms"));
        put(metadata, "polar_reconnect_count", physiology == null ? JSONObject.NULL : physiology.opt("polar_reconnect_count"));
        put(metadata, "ecg_qc_valid", physiology == null ? JSONObject.NULL : physiology.opt("ecg_qc_valid"));
        put(metadata, "ecg_qc_flag", physiology == null ? "pending" : physiology.optString("ecg_qc_flag", ""));
    }

    private void logBlockEvent(BlockPlan plan, String eventType, JSONObject extra) {
        JSONObject event = new JSONObject();
        put(event, "event_type", eventType);
        put(event, "participant_id", participantId);
        put(event, "session_id", sessionId);
        put(event, "apk_variant_id", apkVariantId);
        put(event, "apk_file_code", plan.apkFileCode);
        put(event, "mapping_target", plan.mappingTarget);
        put(event, "permutation_id", plan.permutationId);
        put(event, "allocation_row", participantAllocation.opt("allocation_row"));
        put(event, "block_order", plan.blockPosition);
        put(event, "block_id", plan.blockId);
        put(event, "vr_condition_id", plan.vrConditionId);
        put(event, "condition_id", plan.vrConditionId);
        put(event, "coherence_level", plan.coherenceLevel);
        put(event, "energy_noise_level", plan.energyNoiseLevel);
        put(event, "audio_variant_id", plan.audioVariantId);
        put(event, "audio_instruction_id", plan.audioInstructionId);
        put(event, "language_code", plan.languageCode);
        put(event, "audio_asset_file", plan.audioAssetFile);
        put(event, "block_file_stem", plan.blockFileStem);
        put(event, "ecg_master_file", ecgMasterRelativeFile());
        put(event, "physiology_marker_file", markerRelativeFile());
        put(event, "recorded_at_utc", Instant.now().toString());
        if (extra != null) {
            JSONArray names = extra.names();
            if (names != null) {
                for (int i = 0; i < names.length(); i++) {
                    String key = names.optString(i);
                    if (isCanonicalEventField(key)) {
                        continue;
                    }
                    put(event, key, extra.opt(key));
                }
            }
        }
        appendJsonl(new File(dataDir, plan.blockFileStem + "_events.jsonl"), event);
        if (isPhysiologyMarkerEvent(eventType)) {
            logPhysiologyMarker(plan, eventType, event);
        }
    }

    private void logSessionMarker(String eventType, JSONObject extra) {
        JSONObject marker = baseSessionMarker(eventType);
        merge(marker, extra);
        addPolarDeviceAlias(marker);
        appendJsonl(markerFile(), marker);
    }

    private void logPhysiologyMarker(BlockPlan plan, String eventType, JSONObject extra) {
        JSONObject marker = baseSessionMarker(eventType);
        put(marker, "marker_id", markerId(plan.blockFileStem, eventType, marker.optString("recorded_at_utc")));
        put(marker, "block_order", plan.blockPosition);
        put(marker, "block_id", plan.blockId);
        put(marker, "block_file_stem", plan.blockFileStem);
        put(marker, "condition_id", plan.vrConditionId);
        put(marker, "vr_condition_id", plan.vrConditionId);
        put(marker, "coherence_level", plan.coherenceLevel);
        put(marker, "energy_noise_level", plan.energyNoiseLevel);
        put(marker, "audio_variant_id", plan.audioVariantId);
        put(marker, "audio_instruction_id", plan.audioInstructionId);
        put(marker, "language_code", plan.languageCode);
        put(marker, "audio_asset_file", plan.audioAssetFile);
        put(marker, "derived_block_ecg_file", ecgRelativeFile(plan));
        merge(marker, extra);
        addPolarDeviceAlias(marker);
        appendJsonl(markerFile(), marker);
    }

    private JSONObject baseSessionMarker(String eventType) {
        String recordedAtUtc = Instant.now().toString();
        JSONObject marker = new JSONObject();
        put(marker, "marker_schema", MARKER_SCHEMA);
        put(marker, "marker_id", markerId(apkFileCode() + "_" + participantId + "_session", eventType, recordedAtUtc));
        put(marker, "event_type", eventType);
        put(marker, "recorded_at_utc", recordedAtUtc);
        put(marker, "elapsed_realtime_ns", SystemClock.elapsedRealtimeNanos());
        put(marker, "participant_id", participantId);
        put(marker, "session_id", sessionId);
        put(marker, "apk_variant_id", apkVariantId);
        put(marker, "apk_file_code", apkFileCode());
        put(marker, "mapping_target", apkVariant.optString("mapping_target", ""));
        put(marker, "permutation_id", participantAllocation.optString("permutation_id", ""));
        put(marker, "allocation_row", participantAllocation.opt("allocation_row"));
        put(marker, "ecg_master_file", ecgMasterRelativeFile());
        put(marker, "physiology_marker_file", markerRelativeFile());
        addLatestPolarStatus(marker);
        return marker;
    }

    private void addPolarDeviceAlias(JSONObject marker) {
        if (marker.optString("polar_device_id", "").isEmpty()) {
            String deviceId = marker.optString("device_id", "");
            if (!deviceId.isEmpty()) {
                put(marker, "polar_device_id", deviceId);
            }
        }
    }

    private void addLatestPolarStatus(JSONObject marker) {
        if (latestPolarStatus == null) {
            return;
        }
        String deviceId = latestPolarStatus.optString("device_id", "");
        if (!deviceId.isEmpty()) {
            put(marker, "device_id", deviceId);
            put(marker, "polar_device_id", deviceId);
        }
        String deviceName = latestPolarStatus.optString("device_name", "");
        if (!deviceName.isEmpty()) {
            put(marker, "device_name", deviceName);
        }
        String deviceAddress = latestPolarStatus.optString("device_address", "");
        if (!deviceAddress.isEmpty()) {
            put(marker, "device_address", deviceAddress);
        }
        put(marker, "polar_ready", latestPolarStatus.optBoolean("ready", false));
        put(marker, "polar_state", latestPolarStatus.optString("state", ""));
        put(marker, "heart_rate_bpm", latestPolarStatus.optInt("heart_rate_bpm", 0));
        put(marker, "rr_interval_count", latestPolarStatus.optInt("rr_interval_count", 0));
        put(marker, "ecg_sample_count", latestPolarStatus.optLong("ecg_sample_count", 0L));
        put(marker, "pmd_frame_count", latestPolarStatus.optLong("pmd_frame_count", 0L));
        put(marker, "polar_ready_at_session_start", latestPolarStatus.optBoolean("session_ready_observed", false));
        put(marker, "ecg_gap_count", latestPolarStatus.optInt("ecg_gap_count", 0));
        put(marker, "max_ecg_gap_ms", latestPolarStatus.optLong("max_ecg_gap_ms", 0L));
        put(marker, "total_ecg_gap_ms", latestPolarStatus.optLong("total_ecg_gap_ms", 0L));
        put(marker, "polar_reconnect_count", latestPolarStatus.optInt("polar_reconnect_count", 0));
    }

    private boolean isPhysiologyMarkerEvent(String eventType) {
        switch (eventType) {
            case "session_ready_prompt_shown":
            case "session_start_confirmed":
            case "block_assigned":
            case "block_started":
            case "ecg_recording_armed":
            case "ecg_recording_started":
            case "ecg_recording_completed":
            case "audio_started":
            case "condition_started":
            case "audio_stopped_dev_duration":
            case "condition_ended":
            case "block_ecg_window_closed":
            case "polar_disconnect":
            case "polar_reconnect_started":
            case "polar_reconnected":
            case "polar_reconnect_failed":
            case "questionnaire_started":
            case "page_completed":
            case "questionnaire_completed":
            case "result_write_success":
            case "block_completed":
                return true;
            default:
                return false;
        }
    }

    private File markerFile() {
        return new File(dataDir, apkFileCode() + "_" + participantId + "_session_markers.jsonl");
    }

    private String markerId(String stem, String eventType, String recordedAtUtc) {
        String safeTime = recordedAtUtc == null ? Instant.now().toString() : recordedAtUtc;
        safeTime = safeTime.replace(":", "").replace(".", "").replace("-", "");
        return stem + "_" + eventType + "_" + safeTime;
    }

    private void ensureDataLayout() throws IOException, JSONException {
        if (!dataDir.mkdirs() && !dataDir.isDirectory()) {
            throw new IOException("Unable to create data dir: " + dataDir);
        }
        if (!demographicsDir.mkdirs() && !demographicsDir.isDirectory()) {
            throw new IOException("Unable to create demographics dir: " + demographicsDir);
        }
        File allocationDir = new File(rootDir, "allocation");
        if (!allocationDir.mkdirs() && !allocationDir.isDirectory()) {
            throw new IOException("Unable to create allocation dir: " + allocationDir);
        }
        writeJsonAtomic(new File(rootDir, "condition_audio_lookup.json"), lookup);
        writeQuestionnaireItems();
    }

    private void writeQuestionnaireItems() throws JSONException {
        File csv = new File(dataDir, "questionnaire_items.csv");
        if (csv.exists()) {
            return;
        }
        appendLine(csv, "item_id,label,scale");
        JSONArray items = lookup.getJSONArray("questionnaire_items");
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.getJSONObject(i);
            appendLine(csv, csv(item.getString("item_id"), item.getString("label"), item.getString("scale")));
        }
    }

    private void writeAllocationState(boolean completed) {
        JSONObject previous = readFileJson(new File(rootDir, "allocation_state.json"));
        Set<String> completedParticipants = stringSet(previous, "completed_participant_ids");
        Set<String> failedParticipants = stringSet(previous, "failed_or_retest_participant_ids");
        if (completed) {
            completedParticipants.add(participantId);
        }

        JSONObject state = new JSONObject();
        put(state, "apk_variant_id", apkVariantId);
        put(state, "data_folder", rootDir.getName());
        put(state, "lookup_file", "condition_audio_lookup.json");
        put(state, "next_participant_id", nextParticipantAfter(participantId));
        put(state, "active_participant_id", completed ? JSONObject.NULL : participantId);
        put(state, "active_permutation_id", completed ? JSONObject.NULL : participantAllocation.optString("permutation_id"));
        put(state, "active_allocation_row", completed ? JSONObject.NULL : participantAllocation.opt("allocation_row"));
        put(state, "completed_participant_ids", jsonArray(completedParticipants));
        put(state, "failed_or_retest_participant_ids", jsonArray(failedParticipants));
        put(state, "last_updated_utc", Instant.now().toString());
        writeJsonAtomic(new File(rootDir, "allocation_state.json"), state);
        refreshAnalysisExport();
    }

    private void writeDemographicsPlaceholder() {
        JSONObject demographics = new JSONObject();
        put(demographics, "participant_id", participantId);
        put(demographics, "session_id", sessionId);
        put(demographics, "apk_variant_id", apkVariantId);
        put(demographics, "language_code", DEFAULT_LANGUAGE_CODE);
        put(demographics, "participant_first_name", "DEV");
        put(demographics, "participant_last_name", "PLACEHOLDER");
        put(demographics, "participant_name", "DEV PLACEHOLDER");
        put(demographics, "age_years", 0);
        put(demographics, "handedness", "prefer_not_to_say");
        put(demographics, "gender", "prefer_not_to_say");
        put(demographics, "consent_confirmed", false);
        put(demographics, "consent_text", "I consent to participate in this study.");
        JSONObject signature = new JSONObject();
        put(signature, "type", "native_stroke_signature");
        put(signature, "stroke_count", 0);
        put(signature, "complete", false);
        put(signature, "strokes", new JSONArray());
        put(demographics, "signature", signature);
        put(demographics, "signature_stroke_count", 0);
        JSONObject polar = new JSONObject();
        put(polar, "ready", false);
        put(polar, "source", "native_pending");
        put(polar, "state", "waiting_for_polar_h10");
        put(demographics, "polar_validation", polar);
        put(demographics, "complete", false);
        writeJsonAtomic(new File(demographicsDir, participantId + "_demographics.json"), demographics);
        refreshAnalysisExport();
    }

    private void writeDemographicsFromSnapshot(JSONObject snapshot) {
        JSONObject observed = snapshot.optJSONObject("demographics");
        if (observed == null) {
            return;
        }
        File demographicsFile = new File(demographicsDir, participantId + "_demographics.json");
        JSONObject previous = readFileJson(demographicsFile);
        boolean previouslyComplete = previous != null && previous.optBoolean("complete", false);
        JSONObject demographics = new JSONObject();
        String observedLanguageCode = normalizeLanguageCode(observed.optString("language_code", currentLanguageCode));
        put(demographics, "participant_id", participantId);
        put(demographics, "session_id", sessionId);
        put(demographics, "apk_variant_id", apkVariantId);
        put(demographics, "language_code", observedLanguageCode);
        put(demographics, "participant_first_name", observed.optString("participant_first_name", ""));
        put(demographics, "participant_last_name", observed.optString("participant_last_name", ""));
        put(demographics, "participant_name", observed.optString("participant_name", ""));
        put(demographics, "age_years", observed.opt("age_years"));
        put(demographics, "handedness", observed.optString("handedness", ""));
        put(demographics, "gender", observed.optString("gender", ""));
        put(demographics, "consent_confirmed", observed.optBoolean("consent_confirmed", false));
        put(demographics, "consent_text", observed.optString("consent_text", "I consent to participate in this study."));
        JSONObject signature = observed.optJSONObject("signature");
        put(demographics, "signature", signature == null ? new JSONObject() : signature);
        put(demographics, "signature_stroke_count", observed.optInt("signature_stroke_count",
                signature == null ? 0 : signature.optInt("stroke_count", 0)));
        put(demographics, "polar_validation", observed.optJSONObject("polar_validation"));
        boolean demographicsComplete = observed.optBoolean("complete", false);
        put(demographics, "complete", demographicsComplete);
        put(demographics, "observed_at_utc", Instant.now().toString());
        writeJsonAtomic(demographicsFile, demographics);
        if (demographicsComplete && !previouslyComplete) {
            refreshAnalysisExport();
        }
    }

    private void refreshAnalysisExport() {
        analysisExporter.refresh();
    }

    private JSONObject chooseParticipantAllocation(String requestedParticipantId, JSONObject existingState) throws JSONException {
        String candidate = requestedParticipantId == null ? "" : requestedParticipantId.trim();
        if (candidate.isEmpty() && existingState != null) {
            candidate = existingState.optString("active_participant_id", "").trim();
        }
        if ("null".equalsIgnoreCase(candidate)) {
            candidate = "";
        }
        if (candidate.isEmpty() && existingState != null) {
            candidate = existingState.optString("next_participant_id", "").trim();
        }
        if ("null".equalsIgnoreCase(candidate)) {
            candidate = "";
        }
        if (candidate.isEmpty()) {
            Set<String> completed = stringSet(existingState, "completed_participant_ids");
            JSONArray allocations = lookup.getJSONArray("participant_allocation");
            for (int i = 0; i < allocations.length(); i++) {
                JSONObject allocation = allocations.getJSONObject(i);
                String id = allocation.getString("participant_id");
                if (!completed.contains(id)) {
                    candidate = id;
                    break;
                }
            }
        }
        if (candidate.isEmpty()) {
            candidate = lookup.getJSONArray("participant_allocation").getJSONObject(0).getString("participant_id");
        }
        return findObject(lookup.getJSONArray("participant_allocation"), "participant_id", candidate);
    }

    private int expectedBlockCount() {
        try {
            String permutationId = participantAllocation.getString("permutation_id");
            JSONObject conditionPermutation = findObject(lookup.getJSONArray("condition_permutations"), "permutation_id", permutationId);
            return conditionPermutation.getJSONArray("block_order").length();
        } catch (JSONException error) {
            logHarnessEvent("expected_block_count_failed", error.getMessage());
            return 4;
        }
    }

    private String nextParticipantAfter(String currentParticipantId) {
        try {
            JSONArray allocations = lookup.getJSONArray("participant_allocation");
            for (int i = 0; i < allocations.length(); i++) {
                JSONObject allocation = allocations.getJSONObject(i);
                if (currentParticipantId.equals(allocation.optString("participant_id"))) {
                    if (i + 1 < allocations.length()) {
                        return allocations.getJSONObject(i + 1).getString("participant_id");
                    }
                    return null;
                }
            }
        } catch (JSONException error) {
            logHarnessEvent("next_participant_failed", error.getMessage());
        }
        return null;
    }

    private Set<String> stringSet(JSONObject source, String key) {
        Set<String> values = new HashSet<>();
        if (source == null) {
            return values;
        }
        JSONArray array = source.optJSONArray(key);
        if (array == null) {
            return values;
        }
        for (int i = 0; i < array.length(); i++) {
            String value = array.optString(i, "").trim();
            if (!value.isEmpty()) {
                values.add(value);
            }
        }
        return values;
    }

    private JSONArray jsonArray(Set<String> values) {
        JSONArray array = new JSONArray();
        for (String value : values) {
            array.put(value);
        }
        return array;
    }

    private JSONObject readFileJson(File file) {
        if (!file.exists()) {
            return null;
        }
        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            try (InputStream input = new FileInputStream(file)) {
                byte[] chunk = new byte[8192];
                int read;
                while ((read = input.read(chunk)) != -1) {
                    buffer.write(chunk, 0, read);
                }
            }
            return new JSONObject(new String(buffer.toByteArray(), StandardCharsets.UTF_8));
        } catch (IOException | JSONException error) {
            Log.w(TAG, "Unable to read JSON file " + file, error);
            return null;
        }
    }

    private JSONObject readAssetJson(String assetPath) throws IOException, JSONException {
        AssetManager assets = context.getAssets();
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (InputStream input = assets.open(assetPath)) {
            byte[] chunk = new byte[8192];
            int read;
            while ((read = input.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
            }
        }
        byte[] bytes = buffer.toByteArray();
        return new JSONObject(new String(bytes, StandardCharsets.UTF_8));
    }

    private JSONObject findObject(JSONArray array, String key, String value) throws JSONException {
        for (int i = 0; i < array.length(); i++) {
            JSONObject object = array.getJSONObject(i);
            if (value.equals(object.optString(key))) {
                return object;
            }
        }
        throw new JSONException("Missing object " + key + "=" + value);
    }

    private JSONObject findBlock(JSONArray array, int blockOrder) throws JSONException {
        for (int i = 0; i < array.length(); i++) {
            JSONObject object = array.getJSONObject(i);
            if (object.optInt("block_order") == blockOrder) {
                return object;
            }
        }
        throw new JSONException("Missing block_order=" + blockOrder);
    }

    private void writeJsonAtomic(File file, JSONObject value) {
        try {
            writeAtomic(file, value.toString(2) + "\n");
        } catch (JSONException error) {
            Log.e(TAG, "Unable to serialize JSON for " + file, error);
        }
    }

    private void writeAtomic(File file, String text) {
        try {
            File parent = file.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                throw new IOException("Unable to create " + parent);
            }
            File temp = new File(file.getParentFile(), file.getName() + ".tmp");
            try (FileOutputStream output = new FileOutputStream(temp)) {
                output.write(text.getBytes(StandardCharsets.UTF_8));
                output.getFD().sync();
            }
            if (file.exists() && !file.delete()) {
                throw new IOException("Unable to replace " + file);
            }
            if (!temp.renameTo(file)) {
                throw new IOException("Unable to move " + temp + " to " + file);
            }
        } catch (IOException error) {
            Log.e(TAG, "Write failed for " + file, error);
        }
    }

    private void appendJsonl(File file, JSONObject row) {
        appendLine(file, row.toString());
    }

    private void appendLine(File file, String line) {
        try {
            File parent = file.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                throw new IOException("Unable to create " + parent);
            }
            try (FileOutputStream output = new FileOutputStream(file, true)) {
                output.write((line + "\n").getBytes(StandardCharsets.UTF_8));
            }
        } catch (IOException error) {
            Log.e(TAG, "Append failed for " + file, error);
        }
    }

    private String csv(String... values) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                builder.append(',');
            }
            String value = values[i] == null ? "" : values[i];
            if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
                builder.append('"').append(value.replace("\"", "\"\"")).append('"');
            } else {
                builder.append(value);
            }
        }
        return builder.toString();
    }

    private String stringOpt(JSONObject object, String key) {
        Object value = object.opt(key);
        return value == null || value == JSONObject.NULL ? "" : String.valueOf(value);
    }

    private String firstNonEmpty(String first, String second) {
        return first == null || first.isEmpty() ? (second == null ? "" : second) : first;
    }

    private void put(JSONObject object, String key, Object value) {
        try {
            object.put(key, value == null ? JSONObject.NULL : value);
        } catch (JSONException error) {
            throw new IllegalStateException("Unable to put " + key, error);
        }
    }

    private void merge(JSONObject target, JSONObject source) {
        if (source == null) {
            return;
        }
        JSONArray names = source.names();
        if (names == null) {
            return;
        }
        for (int i = 0; i < names.length(); i++) {
            String key = names.optString(i);
            if (isCanonicalEventField(key)) {
                continue;
            }
            put(target, key, source.opt(key));
        }
    }

    private boolean isCanonicalEventField(String key) {
        return "event_type".equals(key)
                || "marker_schema".equals(key)
                || "marker_id".equals(key)
                || "ecg_master_file".equals(key)
                || "physiology_marker_file".equals(key);
    }

    static final class BlockPlan {
        final int blockPosition;
        final String blockId;
        final String blockFileStem;
        final String apkFileCode;
        final String mappingTarget;
        final String vrConditionId;
        final String coherenceLevel;
        final String energyNoiseLevel;
        final String audioVariantId;
        final String audioInstructionId;
        final String languageCode;
        final String audioAssetFile;
        final String audioAssetUrl;
        final String permutationId;

        BlockPlan(
                int blockPosition,
                String blockId,
                String blockFileStem,
                String apkFileCode,
                String mappingTarget,
                String vrConditionId,
                String coherenceLevel,
                String energyNoiseLevel,
                String audioVariantId,
                String audioInstructionId,
                String languageCode,
                String audioAssetFile,
                String audioAssetUrl,
                String permutationId
        ) {
            this.blockPosition = blockPosition;
            this.blockId = blockId;
            this.blockFileStem = blockFileStem;
            this.apkFileCode = apkFileCode;
            this.mappingTarget = mappingTarget;
            this.vrConditionId = vrConditionId;
            this.coherenceLevel = coherenceLevel;
            this.energyNoiseLevel = energyNoiseLevel;
            this.audioVariantId = audioVariantId;
            this.audioInstructionId = audioInstructionId;
            this.languageCode = languageCode;
            this.audioAssetFile = audioAssetFile;
            this.audioAssetUrl = audioAssetUrl;
            this.permutationId = permutationId;
        }
    }
}

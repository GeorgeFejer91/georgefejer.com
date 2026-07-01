package com.georgefejer.study6.quest;

import android.content.Context;
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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class Study6AnalysisExporter {
    private static final String TAG = "Study6AnalysisExporter";

    private final Context context;
    private final String apkVariantId;
    private final JSONObject lookup;
    private final JSONObject apkVariant;
    private final File rootDir;
    private final File dataDir;
    private final File demographicsDir;
    private final File exportVariantDir;
    private final String apkFileCode;

    Study6AnalysisExporter(
            Context context,
            String apkVariantId,
            JSONObject lookup,
            JSONObject apkVariant,
            File rootDir,
            File dataDir,
            File demographicsDir
    ) {
        this.context = context.getApplicationContext();
        this.apkVariantId = apkVariantId;
        this.lookup = lookup;
        this.apkVariant = apkVariant;
        this.rootDir = rootDir;
        this.dataDir = dataDir;
        this.demographicsDir = demographicsDir;
        this.apkFileCode = apkVariant.optString("apk_file_code", apkVariantId);
        File externalFiles = this.context.getExternalFilesDir(null);
        File exportBase = externalFiles == null ? this.context.getFilesDir() : externalFiles;
        this.exportVariantDir = new File(exportBase, "Study6DataExport/" + apkVariantId);
    }

    void refresh() {
        try {
            writeAnalysisReady();
            writeRawContext();
        } catch (IOException | JSONException error) {
            Log.e(TAG, "Unable to refresh Study 6 export", error);
        }
    }

    private void writeAnalysisReady() throws IOException, JSONException {
        File analysisDir = new File(exportVariantDir, "analysis_ready");
        deleteRecursively(analysisDir);
        mkdirs(analysisDir);
        writePsychometricsWide(new File(analysisDir, "study6_" + apkFileCode + "_psychometrics_wide.csv"));

        File demographicsAnalysisDir = new File(analysisDir, "demographics");
        mkdirs(demographicsAnalysisDir);
        writeDemographicsCsv(
                new File(demographicsAnalysisDir, "study6_" + apkFileCode + "_demographics.csv"),
                true
        );

        File blockEcgDir = new File(analysisDir, "block_ecg");
        mkdirs(blockEcgDir);
        copyAnalysisBlockEcg(blockEcgDir);
    }

    private void writeRawContext() throws IOException, JSONException {
        File rawContextDir = new File(exportVariantDir, "raw_context");
        deleteRecursively(rawContextDir);
        mkdirs(rawContextDir);

        copyIfExists(new File(rootDir, "condition_audio_lookup.json"), new File(rawContextDir, "condition_audio_lookup.json"));
        copyIfExists(new File(rootDir, "allocation_state.json"), new File(rawContextDir, "allocation_state.json"));

        File longFormDir = new File(rawContextDir, "long_form");
        mkdirs(longFormDir);
        copyIfExists(new File(dataDir, "questionnaire_responses_long.csv"), new File(longFormDir, "questionnaire_responses_long.csv"));
        copyIfExists(new File(dataDir, "block_metadata_long.csv"), new File(longFormDir, "block_metadata_long.csv"));
        writeDemographicsCsv(new File(longFormDir, "demographics_long.csv"), false);
        writeRuntimeEventsLong(new File(longFormDir, "runtime_events_long.csv"));
        writePhysiologyMarkersLong(new File(longFormDir, "physiology_markers_long.csv"));

        File rawFilesDir = new File(rawContextDir, "raw_files");
        copyDirectoryFiles(demographicsDir, new File(rawFilesDir, "demographics"));
        copyDirectoryFiles(dataDir, new File(rawFilesDir, "data"));
    }

    private void writePsychometricsWide(File target) throws IOException, JSONException {
        List<String> conditionIds = conditionIds();
        List<String> itemIds = itemIds();
        List<String> header = new ArrayList<>();
        header.add("participant_id");
        for (String conditionId : conditionIds) {
            for (String itemId : itemIds) {
                header.add(conditionId + "_" + itemId);
            }
        }

        Map<String, Map<String, String>> participantValues = psychometricValuesByParticipant();
        StringBuilder output = new StringBuilder();
        output.append(csvLine(header)).append('\n');
        for (String participantId : participantOrder()) {
            Map<String, String> values = participantValues.get(participantId);
            if (!hasAllPsychometricValues(values, conditionIds, itemIds)) {
                continue;
            }
            List<String> row = new ArrayList<>();
            row.add(participantId);
            for (String conditionId : conditionIds) {
                for (String itemId : itemIds) {
                    row.add(values.get(conditionId + "_" + itemId));
                }
            }
            output.append(csvLine(row)).append('\n');
        }
        writeAtomic(target, output.toString());
    }

    private Map<String, Map<String, String>> psychometricValuesByParticipant() throws IOException, JSONException {
        Map<String, Map<String, String>> participantValues = new LinkedHashMap<>();
        File responseCsv = new File(dataDir, "questionnaire_responses_long.csv");
        if (!responseCsv.exists()) {
            return participantValues;
        }
        Set<String> knownConditions = new LinkedHashSet<>(conditionIds());
        Set<String> knownItems = new LinkedHashSet<>(itemIds());
        for (Map<String, String> row : readCsvObjects(responseCsv)) {
            String participantId = row.getOrDefault("participant_id", "");
            String conditionId = row.getOrDefault("vr_condition_id", "");
            String itemId = row.getOrDefault("item_id", "");
            if (participantId.isEmpty() || !knownConditions.contains(conditionId) || !knownItems.contains(itemId)) {
                continue;
            }
            Map<String, String> values = participantValues.computeIfAbsent(participantId, ignored -> new LinkedHashMap<>());
            values.put(conditionId + "_" + itemId, row.getOrDefault("item_value", ""));
        }
        return participantValues;
    }

    private boolean hasAllPsychometricValues(Map<String, String> values, List<String> conditionIds, List<String> itemIds) {
        if (values == null) {
            return false;
        }
        for (String conditionId : conditionIds) {
            for (String itemId : itemIds) {
                String value = values.get(conditionId + "_" + itemId);
                if (value == null || value.isEmpty()) {
                    return false;
                }
            }
        }
        return true;
    }

    private void writeDemographicsCsv(File target, boolean onlyAnalysisComplete) throws IOException, JSONException {
        List<String> header = Arrays.asList(
                "participant_id",
                "session_id",
                "apk_variant_id",
                "language_code",
                "age_years",
                "handedness",
                "gender",
                "consent_confirmed",
                "signature_complete",
                "signature_stroke_count",
                "polar_ready",
                "polar_state",
                "polar_device_id",
                "complete",
                "observed_at_utc"
        );
        Set<String> analysisComplete = onlyAnalysisComplete ? analysisCompleteParticipants() : null;
        StringBuilder output = new StringBuilder();
        output.append(csvLine(header)).append('\n');
        File[] files = demographicsDir.listFiles((dir, name) -> name.endsWith("_demographics.json"));
        if (files != null) {
            Arrays.sort(files, (left, right) -> left.getName().compareTo(right.getName()));
            for (File file : files) {
                JSONObject demographics = readFileJson(file);
                if (demographics == null) {
                    continue;
                }
                String participantId = demographics.optString("participant_id", "");
                if (onlyAnalysisComplete && !analysisComplete.contains(participantId)) {
                    continue;
                }
                JSONObject polar = demographics.optJSONObject("polar_validation");
                JSONObject signature = demographics.optJSONObject("signature");
                String polarDeviceId = "";
                String polarState = "";
                String polarReady = "";
                if (polar != null) {
                    polarDeviceId = firstNonEmpty(polar.optString("polar_device_id", ""), polar.optString("device_id", ""));
                    polarState = polar.optString("state", "");
                    polarReady = String.valueOf(polar.optBoolean("ready", false));
                }
                List<String> row = Arrays.asList(
                        participantId,
                        demographics.optString("session_id", ""),
                        demographics.optString("apk_variant_id", ""),
                        demographics.optString("language_code", ""),
                        String.valueOf(demographics.opt("age_years") == JSONObject.NULL ? "" : demographics.opt("age_years")),
                        demographics.optString("handedness", ""),
                        demographics.optString("gender", ""),
                        String.valueOf(demographics.optBoolean("consent_confirmed", false)),
                        String.valueOf(signature != null && signature.optBoolean("complete", false)),
                        String.valueOf(demographics.optInt("signature_stroke_count",
                                signature == null ? 0 : signature.optInt("stroke_count", 0))),
                        polarReady,
                        polarState,
                        polarDeviceId,
                        String.valueOf(demographics.optBoolean("complete", false)),
                        demographics.optString("observed_at_utc", "")
                );
                output.append(csvLine(row)).append('\n');
            }
        }
        writeAtomic(target, output.toString());
    }

    private void copyAnalysisBlockEcg(File blockEcgDir) throws IOException, JSONException {
        Set<String> completeParticipants = analysisCompleteParticipants();
        for (String participantId : participantOrder()) {
            if (!completeParticipants.contains(participantId)) {
                continue;
            }
            for (ExportBlock block : blocksForParticipant(participantId)) {
                File source = new File(dataDir, block.blockFileStem + "_ECG_PolarH10.csv");
                if (source.exists()) {
                    copyFile(source, new File(blockEcgDir, source.getName()));
                }
            }
        }
    }

    private Set<String> analysisCompleteParticipants() throws IOException, JSONException {
        List<String> conditionIds = conditionIds();
        List<String> itemIds = itemIds();
        Map<String, Map<String, String>> participantValues = psychometricValuesByParticipant();
        Set<String> complete = new LinkedHashSet<>();
        for (String participantId : participantOrder()) {
            if (hasAllPsychometricValues(participantValues.get(participantId), conditionIds, itemIds)) {
                complete.add(participantId);
            }
        }
        return complete;
    }

    private void writeRuntimeEventsLong(File target) throws IOException {
        List<String> header = Arrays.asList(
                "event_file",
                "event_type",
                "participant_id",
                "session_id",
                "apk_variant_id",
                "apk_file_code",
                "block_order",
                "block_id",
                "vr_condition_id",
                "recorded_at_utc",
                "failure_code",
                "qc_flag",
                "detail"
        );
        StringBuilder output = new StringBuilder();
        output.append(csvLine(header)).append('\n');
        File[] files = dataDir.listFiles((dir, name) -> name.endsWith("_events.jsonl")
                || "runtime_events.jsonl".equals(name)
                || "manual_interactions.jsonl".equals(name)
                || "webview_snapshots.jsonl".equals(name));
        if (files != null) {
            Arrays.sort(files, (left, right) -> left.getName().compareTo(right.getName()));
            for (File file : files) {
                for (JSONObject event : readJsonl(file)) {
                    List<String> row = Arrays.asList(
                            file.getName(),
                            event.optString("event_type", ""),
                            event.optString("participant_id", ""),
                            event.optString("session_id", ""),
                            event.optString("apk_variant_id", ""),
                            event.optString("apk_file_code", ""),
                            stringOpt(event, "block_order"),
                            event.optString("block_id", ""),
                            event.optString("vr_condition_id", ""),
                            event.optString("recorded_at_utc", ""),
                            event.optString("failure_code", ""),
                            event.optString("qc_flag", ""),
                            stringOpt(event, "detail")
                    );
                    output.append(csvLine(row)).append('\n');
                }
            }
        }
        writeAtomic(target, output.toString());
    }

    private void writePhysiologyMarkersLong(File target) throws IOException {
        List<String> header = Arrays.asList(
                "marker_file",
                "marker_id",
                "event_type",
                "participant_id",
                "session_id",
                "apk_variant_id",
                "apk_file_code",
                "permutation_id",
                "allocation_row",
                "block_order",
                "block_id",
                "vr_condition_id",
                "coherence_level",
                "energy_noise_level",
                "audio_variant_id",
                "polar_device_id",
                "recorded_at_utc",
                "elapsed_realtime_ns",
                "ecg_master_file",
                "derived_block_ecg_file",
                "ecg_sample_count",
                "pmd_frame_count",
                "ecg_gap_count",
                "max_ecg_gap_ms",
                "total_ecg_gap_ms",
                "polar_reconnect_count",
                "ecg_qc_valid",
                "ecg_qc_flag",
                "failure_code",
                "qc_flag"
        );
        StringBuilder output = new StringBuilder();
        output.append(csvLine(header)).append('\n');
        File[] files = dataDir.listFiles((dir, name) -> name.endsWith("_session_markers.jsonl"));
        if (files != null) {
            Arrays.sort(files, (left, right) -> left.getName().compareTo(right.getName()));
            for (File file : files) {
                for (JSONObject marker : readJsonl(file)) {
                    List<String> row = Arrays.asList(
                            file.getName(),
                            marker.optString("marker_id", ""),
                            marker.optString("event_type", ""),
                            marker.optString("participant_id", ""),
                            marker.optString("session_id", ""),
                            marker.optString("apk_variant_id", ""),
                            marker.optString("apk_file_code", ""),
                            marker.optString("permutation_id", ""),
                            stringOpt(marker, "allocation_row"),
                            stringOpt(marker, "block_order"),
                            marker.optString("block_id", ""),
                            marker.optString("vr_condition_id", ""),
                            marker.optString("coherence_level", ""),
                            marker.optString("energy_noise_level", ""),
                            marker.optString("audio_variant_id", ""),
                            marker.optString("polar_device_id", ""),
                            marker.optString("recorded_at_utc", ""),
                            stringOpt(marker, "elapsed_realtime_ns"),
                            marker.optString("ecg_master_file", ""),
                            marker.optString("derived_block_ecg_file", ""),
                            stringOpt(marker, "ecg_sample_count"),
                            stringOpt(marker, "pmd_frame_count"),
                            stringOpt(marker, "ecg_gap_count"),
                            stringOpt(marker, "max_ecg_gap_ms"),
                            stringOpt(marker, "total_ecg_gap_ms"),
                            stringOpt(marker, "polar_reconnect_count"),
                            stringOpt(marker, "ecg_qc_valid"),
                            marker.optString("ecg_qc_flag", ""),
                            marker.optString("failure_code", ""),
                            marker.optString("qc_flag", "")
                    );
                    output.append(csvLine(row)).append('\n');
                }
            }
        }
        writeAtomic(target, output.toString());
    }

    private List<String> conditionIds() throws JSONException {
        List<String> ids = new ArrayList<>();
        JSONArray conditions = lookup.getJSONArray("conditions");
        for (int i = 0; i < conditions.length(); i++) {
            ids.add(conditions.getJSONObject(i).getString("vr_condition_id"));
        }
        return ids;
    }

    private List<String> itemIds() throws JSONException {
        List<String> ids = new ArrayList<>();
        JSONArray items = lookup.getJSONArray("questionnaire_items");
        for (int i = 0; i < items.length(); i++) {
            ids.add(items.getJSONObject(i).getString("item_id"));
        }
        return ids;
    }

    private List<String> participantOrder() throws JSONException {
        List<String> ids = new ArrayList<>();
        JSONArray allocations = lookup.getJSONArray("participant_allocation");
        for (int i = 0; i < allocations.length(); i++) {
            ids.add(allocations.getJSONObject(i).getString("participant_id"));
        }
        return ids;
    }

    private List<ExportBlock> blocksForParticipant(String participantId) throws JSONException {
        JSONObject participant = findObject(lookup.getJSONArray("participant_allocation"), "participant_id", participantId);
        String permutationId = participant.getString("permutation_id");
        JSONObject conditionPermutation = findObject(lookup.getJSONArray("condition_permutations"), "permutation_id", permutationId);
        JSONArray blockOrder = conditionPermutation.getJSONArray("block_order");
        List<ExportBlock> blocks = new ArrayList<>();
        for (int i = 0; i < blockOrder.length(); i++) {
            JSONObject row = blockOrder.getJSONObject(i);
            int blockPosition = row.getInt("block_order");
            String blockId = "B" + String.format("%02d", blockPosition);
            String conditionId = row.getString("vr_condition_id");
            String blockFileStem = apkFileCode + "_" + participantId + "_" + blockId + "_" + conditionId;
            blocks.add(new ExportBlock(blockFileStem));
        }
        return blocks;
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

    private List<Map<String, String>> readCsvObjects(File file) throws IOException {
        List<List<String>> rows = parseCsv(readText(file));
        List<Map<String, String>> objects = new ArrayList<>();
        if (rows.isEmpty()) {
            return objects;
        }
        List<String> header = rows.get(0);
        for (int rowIndex = 1; rowIndex < rows.size(); rowIndex++) {
            List<String> row = rows.get(rowIndex);
            Map<String, String> object = new LinkedHashMap<>();
            for (int i = 0; i < header.size(); i++) {
                object.put(header.get(i), i < row.size() ? row.get(i) : "");
            }
            objects.add(object);
        }
        return objects;
    }

    private List<List<String>> parseCsv(String text) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char value = text.charAt(i);
            if (quoted) {
                if (value == '"' && i + 1 < text.length() && text.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else if (value == '"') {
                    quoted = false;
                } else {
                    cell.append(value);
                }
                continue;
            }
            if (value == '"') {
                quoted = true;
            } else if (value == ',') {
                row.add(cell.toString());
                cell.setLength(0);
            } else if (value == '\n') {
                row.add(cell.toString());
                if (!row.isEmpty() && row.stream().anyMatch(entry -> !entry.isEmpty())) {
                    rows.add(row);
                }
                row = new ArrayList<>();
                cell.setLength(0);
            } else if (value != '\r') {
                cell.append(value);
            }
        }
        if (cell.length() > 0 || !row.isEmpty()) {
            row.add(cell.toString());
            rows.add(row);
        }
        return rows;
    }

    private List<JSONObject> readJsonl(File file) throws IOException {
        List<JSONObject> rows = new ArrayList<>();
        if (!file.exists()) {
            return rows;
        }
        String[] lines = readText(file).split("\\r?\\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            try {
                rows.add(new JSONObject(trimmed));
            } catch (JSONException error) {
                Log.w(TAG, "Skipping invalid JSONL row in " + file.getName(), error);
            }
        }
        return rows;
    }

    private JSONObject readFileJson(File file) {
        if (!file.exists()) {
            return null;
        }
        try {
            return new JSONObject(readText(file));
        } catch (IOException | JSONException error) {
            Log.w(TAG, "Unable to read JSON file " + file, error);
            return null;
        }
    }

    private String readText(File file) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (InputStream input = new FileInputStream(file)) {
            byte[] chunk = new byte[8192];
            int read;
            while ((read = input.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
            }
        }
        return new String(buffer.toByteArray(), StandardCharsets.UTF_8);
    }

    private void writeAtomic(File file, String text) throws IOException {
        File parent = file.getParentFile();
        if (parent != null) {
            mkdirs(parent);
        }
        File temp = new File(parent, file.getName() + ".tmp");
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
    }

    private void copyDirectoryFiles(File sourceDir, File targetDir) throws IOException {
        mkdirs(targetDir);
        File[] files = sourceDir.listFiles(File::isFile);
        if (files == null) {
            return;
        }
        Arrays.sort(files, (left, right) -> left.getName().compareTo(right.getName()));
        for (File file : files) {
            copyFile(file, new File(targetDir, file.getName()));
        }
    }

    private void copyIfExists(File source, File target) throws IOException {
        if (source.exists()) {
            copyFile(source, target);
        }
    }

    private void copyFile(File source, File target) throws IOException {
        File parent = target.getParentFile();
        if (parent != null) {
            mkdirs(parent);
        }
        try (FileInputStream input = new FileInputStream(source);
             FileOutputStream output = new FileOutputStream(target)) {
            byte[] chunk = new byte[8192];
            int read;
            while ((read = input.read(chunk)) != -1) {
                output.write(chunk, 0, read);
            }
            output.getFD().sync();
        }
    }

    private void deleteRecursively(File file) throws IOException {
        if (file == null || !file.exists()) {
            return;
        }
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursively(child);
                }
            }
        }
        if (!file.delete()) {
            throw new IOException("Unable to delete " + file);
        }
    }

    private void mkdirs(File dir) throws IOException {
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("Unable to create " + dir);
        }
    }

    private String csvLine(List<String> values) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                builder.append(',');
            }
            String value = values.get(i) == null ? "" : values.get(i);
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

    private static final class ExportBlock {
        final String blockFileStem;

        ExportBlock(String blockFileStem) {
            this.blockFileStem = blockFileStem;
        }
    }
}

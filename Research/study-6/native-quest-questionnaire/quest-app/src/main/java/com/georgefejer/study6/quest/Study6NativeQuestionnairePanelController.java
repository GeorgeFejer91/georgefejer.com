package com.georgefejer.study6.quest;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PointF;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.MediaPlayer;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class Study6NativeQuestionnairePanelController {
    private static final String TAG = "Study6NativePanel";
    private static final int DEV_AUDIO_DURATION_MS = 20_000;
    private static final String CONSENT_TEXT = "I consent to participate in this study.";

    private static final String PAGE_DEMOGRAPHICS = "demographics";
    private static final String PAGE_POLAR = "polar_setup";
    private static final String PAGE_READY = "session_ready";
    private static final String PAGE_TASK = "vr_task_instructions";
    private static final String PAGE_SAM = "self_assessment_manikin";
    private static final String PAGE_AFFECT = "affect_vas";
    private static final String PAGE_EMOTION = "emotion_representation_vas";
    private static final String PAGE_HAND = "hand_embodiment";
    private static final String PAGE_COMPLETE = "complete";

    private static final int COLOR_BACKGROUND = 0xffd9e0e8;
    private static final int COLOR_PANEL = 0xfff8fafc;
    private static final int COLOR_SURFACE = 0xffffffff;
    private static final int COLOR_TEXT = 0xff111827;
    private static final int COLOR_MUTED = 0xff475569;
    private static final int COLOR_BORDER = 0xffd9e2ec;
    private static final int COLOR_PRIMARY = 0xff005cff;
    private static final int COLOR_PRIMARY_DARK = 0xff0747b6;
    private static final int COLOR_PRIMARY_SOFT = 0xffdbeafe;
    private static final int COLOR_SELECTED = 0xfffff2b8;
    private static final int COLOR_SELECTED_BORDER = 0xffb77905;
    private static final int COLOR_WARNING = 0xffb45309;
    private static final int COLOR_WARNING_SOFT = 0xfffff8e8;
    private static final int COLOR_GOOD = 0xff107044;
    private static final int COLOR_GOOD_SOFT = 0xffeaf8ee;
    private static final float[] DOMINANCE_SAM_SCALE_FACTORS = new float[] {
            0.825f, 0.99f, 1.155f, 1.32f, 1.54f, 1.815f, 2.145f, 2.475f, 2.805f
    };
    private static final int SAM_CHOICE_HEIGHT_DP = 116;
    private static final int SAM_NUMBER_STRIP_DP = 18;

    private final Activity activity;
    private final ViewGroup rootView;
    private final TextView banner;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Map<Integer, AssessmentState> assessments = new HashMap<>();
    private final Set<Integer> audioCompletedBlocks = new HashSet<>();
    private final List<PolarStatusCardView> polarStatusCards = new ArrayList<>();
    private final List<List<PointF>> signatureStrokes = new ArrayList<>();

    private Study6RunLogger logger;
    private Study6PolarH10Manager polarManager;
    private MediaPlayer mediaPlayer;
    private JSONObject latestPolarStatus;
    private TextView polarHeaderBadge;
    private String apkVariantId;
    private String autoRunProfile;
    private boolean autoRunEnabled;
    private boolean started;
    private boolean polarConnectedLogged;
    private boolean polarEcgStreamStartedLogged;
    private boolean physiologyCompletedLogged;
    private long lastPolarStatusEventSequence;
    private int activeAudioBlock = -1;
    private int audioRunningBlock = 0;
    private int lastAudioGateFailureBlock = 0;
    private int currentBlockPosition = 1;
    private String activePageId = PAGE_DEMOGRAPHICS;
    private String pageBeforePolar = PAGE_DEMOGRAPHICS;
    private String languageCode = "en";
    private String participantFirstName = "";
    private String participantLastName = "";
    private String ageText = "";
    private String handedness = "";
    private String gender = "";
    private boolean consentConfirmed;
    private TextView signatureStatusView;
    private SignaturePadView signaturePadView;

    Study6NativeQuestionnairePanelController(Activity activity, ViewGroup rootView, TextView banner) {
        this.activity = activity;
        this.rootView = rootView;
        this.banner = banner;
    }

    void start(Intent intent) {
        if (started) {
            return;
        }
        started = true;
        apkVariantId = stringExtra(intent, "study6_apk_variant_id", "BG_ENV");
        String requestedParticipantId = stringExtra(intent, "study6_participant_id", "");
        autoRunEnabled = booleanExtra(intent, "study6_auto_run", false);
        autoRunProfile = stringExtra(intent, "study6_auto_run_profile", "linear");
        logger = new Study6RunLogger(activity, apkVariantId, DEV_AUDIO_DURATION_MS / 1000, requestedParticipantId);

        activity.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        Study6PolarH10Manager.requestRuntimePermissions(activity);
        startPhysiologyForegroundService();
        String requestedPolarAddress = stringExtra(intent, "study6_polar_device_address", "");
        polarManager = new Study6PolarH10Manager(activity, this::onPolarStatus);
        JSONObject physiologyStarted = polarManager.startSessionRecording(
                logger.participantId(),
                logger.sessionId(),
                logger.apkVariantId(),
                logger.apkFileCode(),
                logger.ecgMasterCsvFile());
        logger.logSessionPhysiologyStarted(physiologyStarted);
        polarManager.start(requestedPolarAddress);
        updateBanner();
        render();
        logger.logHarnessStarted();
        logger.logHarnessEvent("native_panel_started", "Spatial SDK native Android-view panel started");
        if (autoRunEnabled) {
            logger.logHarnessEvent("quest_auto_run_profile", autoRunProfile);
            mainHandler.postDelayed(this::runNativeAutoRun, 700L);
        }
        emitSnapshot("native_panel_started");
    }

    void shutdown(boolean destroyViews) {
        stopAudio("controller_shutdown");
        if (polarManager != null) {
            completeSessionPhysiology("controller_shutdown");
            polarManager.close();
            polarManager = null;
        }
        mainHandler.removeCallbacksAndMessages(null);
        if (destroyViews) {
            rootView.removeAllViews();
        }
    }

    private void updateBanner() {
        if (banner == null) {
            return;
        }
        banner.setText("Study 6 native panel: " + apkVariantId + " | " + logger.participantId()
                + " | lookup-owned order | 20s audio blocks"
                + (autoRunEnabled ? " | auto-run validation" : ""));
    }

    private void render() {
        polarHeaderBadge = null;
        polarStatusCards.clear();
        signatureStatusView = null;
        signaturePadView = null;
        rootView.removeAllViews();
        rootView.setClipChildren(false);
        rootView.setClipToPadding(false);
        rootView.setBackgroundColor(COLOR_BACKGROUND);

        LinearLayout frame = new LinearLayout(activity);
        frame.setOrientation(LinearLayout.VERTICAL);
        frame.setPadding(dp(28), dp(24), dp(28), dp(22));
        frame.setBackground(panelBackground());
        frame.setClipChildren(false);
        frame.setClipToPadding(false);
        rootView.addView(frame, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        frame.addView(headerView());

        ScrollView scrollView = new ScrollView(activity);
        scrollView.setFillViewport(false);
        scrollView.setClipChildren(false);
        scrollView.setClipToPadding(false);
        LinearLayout content = new LinearLayout(activity);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(0, dp(8), 0, dp(10));
        content.setClipChildren(false);
        content.setClipToPadding(false);
        scrollView.addView(content, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT,
                ScrollView.LayoutParams.WRAP_CONTENT));
        frame.addView(scrollView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1.0f));

        renderActivePage(content);
        frame.addView(footerView());
    }

    private View headerView() {
        LinearLayout header = new LinearLayout(activity);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(0, 0, 0, dp(8));
        header.setMinimumHeight(dp(72));

        LinearLayout titleGroup = new LinearLayout(activity);
        titleGroup.setOrientation(LinearLayout.VERTICAL);
        TextView title = text(pageTitle(activePageId), 30, COLOR_TEXT, true);
        title.setIncludeFontPadding(false);
        TextView subtitle = text(headerSubtitle(), 14, COLOR_MUTED, false);
        titleGroup.addView(title);
        if (!subtitle.getText().toString().isEmpty()) {
            titleGroup.addView(subtitle);
        }
        header.addView(titleGroup, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));

        Button polar = button(polarBadgeText(), isPolarReadyForBlock());
        polar.setGravity(Gravity.CENTER);
        polar.setPadding(dp(12), 0, dp(12), 0);
        polar.setTextColor(isPolarReadyForBlock() ? COLOR_GOOD : COLOR_WARNING);
        polar.setBackground(cardBackground(isPolarReadyForBlock() ? COLOR_GOOD_SOFT : COLOR_WARNING_SOFT,
                isPolarReadyForBlock() ? COLOR_GOOD : COLOR_WARNING,
                1,
                8));
        polar.setOnClickListener(view -> openPolarPage());
        header.addView(polar, new LinearLayout.LayoutParams(dp(230), dp(44)));
        polarHeaderBadge = polar;
        return header;
    }

    private String headerSubtitle() {
        return "";
    }

    private String polarBadgeText() {
        if (latestPolarStatus == null) {
            return "Polar waiting";
        }
        if (isPolarReadyForBlock()) {
            return "Polar ready | HR " + latestPolarStatus.optInt("heart_rate_bpm", 0);
        }
        String state = latestPolarStatus.optString("state", "not_ready");
        if (state.length() > 24) {
            state = state.substring(0, 24);
        }
        return "Polar " + state;
    }

    private void renderActivePage(LinearLayout content) {
        switch (activePageId) {
            case PAGE_DEMOGRAPHICS:
                renderDemographics(content);
                break;
            case PAGE_POLAR:
                renderPolar(content);
                break;
            case PAGE_READY:
                renderReady(content);
                break;
            case PAGE_TASK:
                renderTask(content);
                break;
            case PAGE_SAM:
                renderSam(content);
                break;
            case PAGE_AFFECT:
                renderAffect(content);
                break;
            case PAGE_EMOTION:
                renderEmotion(content);
                break;
            case PAGE_HAND:
                renderHand(content);
                break;
            case PAGE_COMPLETE:
                renderComplete(content);
                break;
            default:
                activePageId = PAGE_DEMOGRAPHICS;
                renderDemographics(content);
        }
    }

    private void renderDemographics(LinearLayout content) {
        addPolarStatus(content);

        LinearLayout title = new LinearLayout(activity);
        title.setOrientation(LinearLayout.HORIZONTAL);
        title.setGravity(Gravity.BOTTOM);
        TextView heading = text(uiText("page.demographics.title"), 17, COLOR_TEXT, true);
        heading.setIncludeFontPadding(false);
        title.addView(heading, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        TextView subtitle = text(uiText("page.demographics.subtitle"), 13, COLOR_MUTED, false);
        subtitle.setGravity(Gravity.RIGHT);
        title.addView(subtitle, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.2f));
        content.addView(title, matchWrapWithBottomMargin(dp(8)));

        LinearLayout grid = new LinearLayout(activity);
        grid.setOrientation(LinearLayout.HORIZONTAL);
        grid.setGravity(Gravity.TOP);

        LinearLayout left = column();
        LinearLayout right = column();
        grid.addView(left, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.1f));
        LinearLayout.LayoutParams rightParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.9f);
        rightParams.setMargins(dp(18), 0, 0, 0);
        grid.addView(right, rightParams);
        content.addView(grid);

        addChoiceRow(left, uiText("demographics.language"), languageCode, new Choice[]{
                new Choice("en", "English"),
                new Choice("de", "Deutsch")
        }, value -> {
            languageCode = value;
            emitSnapshot("language_change");
        }, "language");

        LinearLayout nameRow = new LinearLayout(activity);
        nameRow.setOrientation(LinearLayout.HORIZONTAL);
        addTextField(nameRow, uiText("demographics.first_name"), participantFirstName,
                InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PERSON_NAME,
                value -> participantFirstName = value,
                1.0f,
                "participant_first_name");
        addTextField(nameRow, uiText("demographics.last_name"), participantLastName,
                InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PERSON_NAME,
                value -> participantLastName = value,
                1.0f,
                "participant_last_name");
        left.addView(nameRow, matchWrapWithBottomMargin(dp(8)));

        LinearLayout ageRow = new LinearLayout(activity);
        ageRow.setOrientation(LinearLayout.HORIZONTAL);
        addTextField(ageRow, uiText("demographics.age"), ageText, InputType.TYPE_CLASS_NUMBER,
                value -> ageText = value, 0.45f, "participant_age");
        left.addView(ageRow, matchWrapWithBottomMargin(dp(8)));

        addChoiceRow(left, uiText("demographics.handedness"), handedness, new Choice[]{
                new Choice("right", choiceText("handedness", "right")),
                new Choice("left", choiceText("handedness", "left")),
                new Choice("ambidextrous", choiceText("handedness", "ambidextrous")),
                new Choice("prefer_not_to_say", choiceText("handedness", "prefer_not_to_say"))
        }, value -> {
            handedness = value;
            emitSnapshot("demographics_handedness_change");
        }, "handedness");
        addChoiceRow(left, uiText("demographics.gender"), gender, new Choice[]{
                new Choice("male", choiceText("gender", "male")),
                new Choice("female", choiceText("gender", "female")),
                new Choice("other", choiceText("gender", "other")),
                new Choice("prefer_not_to_say", choiceText("gender", "prefer_not_to_say"))
        }, value -> {
            gender = value;
            emitSnapshot("demographics_gender_change");
        }, "gender");

        CheckBox consent = new CheckBox(activity);
        consent.setText(uiText("consent.text"));
        consent.setTextSize(17);
        consent.setTextColor(COLOR_TEXT);
        consent.setChecked(consentConfirmed);
        consent.setPadding(dp(10), 0, dp(10), 0);
        consent.setBackground(cardBackground(COLOR_SURFACE, COLOR_BORDER, 1, 8));
        consent.setOnCheckedChangeListener((buttonView, checked) -> {
            consentConfirmed = checked;
            logTrustedManualInteraction("manual_control_change", "consent", checked ? "checked" : "unchecked");
            emitSnapshot("demographics_consent_change");
            render();
        });
        right.addView(consent, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(58)));

        LinearLayout signatureHeader = new LinearLayout(activity);
        signatureHeader.setOrientation(LinearLayout.HORIZONTAL);
        signatureHeader.setGravity(Gravity.CENTER_VERTICAL);
        TextView signatureLabel = text(uiText("demographics.signature"), 13, COLOR_MUTED, true);
        signatureHeader.addView(signatureLabel, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        Button clearSignature = button(uiText("button.clear"), false);
        clearSignature.setOnClickListener(view -> clearSignatureStrokes());
        LinearLayout.LayoutParams clearParams = new LinearLayout.LayoutParams(dp(86), dp(36));
        signatureHeader.addView(clearSignature, clearParams);
        LinearLayout.LayoutParams signatureHeaderParams = matchWrapWithBottomMargin(dp(6));
        signatureHeaderParams.setMargins(0, dp(10), 0, dp(6));
        right.addView(signatureHeader, signatureHeaderParams);

        signaturePadView = new SignaturePadView();
        right.addView(signaturePadView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(170)));
        signatureStatusView = text(signatureStatusText(), 12, COLOR_MUTED, false);
        signatureStatusView.setPadding(0, dp(6), 0, 0);
        right.addView(signatureStatusView, matchWrapWithBottomMargin(dp(4)));

        String validation = validationMessage();
        if (!validation.isEmpty()) {
            addWarning(content, validation);
        }
    }

    private void renderReady(LinearLayout content) {
        Study6RunLogger.BlockPlan plan = logger.blockPlan(currentBlockPosition, languageCode);
        addSectionTitle(content, "Ready for next session");
        addBody(content, "Block " + currentBlockPosition + " is assigned to " + plan.vrConditionId
                + " (" + plan.coherenceLevel + " coherence / " + plan.energyNoiseLevel + " energy).");
        addBody(content, "Press Start next session when the headset task is ready. The native Polar gate will start audio and ECG only after the task instruction page opens.");
        addPolarStatus(content);
    }

    private void renderPolar(LinearLayout content) {
        addSectionTitle(content, "Polar setup");
        addBody(content, "Automatic Polar discovery remains active by default. Use this page only when you need to inspect candidates or force a reconnect to a specific device.");
        addPolarStatus(content);

        LinearLayout actions = new LinearLayout(activity);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        Button restartScan = button("Restart scan", false);
        restartScan.setOnClickListener(view -> {
            if (polarManager != null) {
                polarManager.restartScan();
                logger.logHarnessEvent("polar_manual_scan_requested", "manual fallback page");
            }
            refreshPolarStatusViews();
        });
        actions.addView(restartScan, new LinearLayout.LayoutParams(0, dp(52), 1.0f));
        Button refresh = button("Refresh", false);
        refresh.setOnClickListener(view -> render());
        LinearLayout.LayoutParams refreshParams = new LinearLayout.LayoutParams(0, dp(52), 1.0f);
        refreshParams.setMargins(dp(8), 0, 0, 0);
        actions.addView(refresh, refreshParams);
        content.addView(actions, matchWrapWithBottomMargin(dp(12)));

        addSectionTitle(content, "Recent scan candidates");
        addPolarCandidateRows(content);

        addSectionTitle(content, "Dataflow");
        addBody(content, polarDataflowDetail());
    }

    private void renderTask(LinearLayout content) {
        Study6RunLogger.BlockPlan plan = logger.blockPlan(currentBlockPosition, languageCode);
        addSectionTitle(content, "VR task instructions");
        addBody(content, "Condition: " + plan.vrConditionId);
        addBody(content, "Audio: " + plan.audioAssetFile);
        addBody(content, "Development build duration: " + (DEV_AUDIO_DURATION_MS / 1000) + " seconds.");
        if (audioRunningBlock == currentBlockPosition) {
            addGood(content, "Audio and condition are running. The panel will advance automatically when the dev-duration window closes.");
        } else if (audioCompletedBlocks.contains(currentBlockPosition)) {
            addGood(content, "Audio window complete. Continue to the assessment pages.");
        } else if (!isPolarReadyForBlock()) {
            addWarning(content, "Waiting for Polar readiness before the native audio/ECG block can start.");
        } else {
            addBody(content, "Polar is ready. The native controller will start the audio/ECG block from this page.");
        }
        addPolarStatus(content);
    }

    private void renderSam(LinearLayout content) {
        AssessmentState state = assessment(currentBlockPosition);
        addBody(content, uiText("sam.instruction"));
        addSamChoiceRow(content,
                "valence",
                uiText("sam.valence.question"),
                uiText("sam.valence.low"),
                uiText("sam.valence.high"),
                state.samValence,
                value -> {
            state.samValence = value;
            emitSnapshot("sam_valence_change");
            render();
        });
        addSamChoiceRow(content,
                "arousal",
                uiText("sam.arousal.question"),
                uiText("sam.arousal.low"),
                uiText("sam.arousal.high"),
                state.samArousal,
                value -> {
            state.samArousal = value;
            emitSnapshot("sam_arousal_change");
            render();
        });
        addSamChoiceRow(content,
                "dominance",
                uiText("sam.dominance.question"),
                uiText("sam.dominance.low"),
                uiText("sam.dominance.high"),
                state.samDominance,
                value -> {
            state.samDominance = value;
            emitSnapshot("sam_dominance_change");
            render();
        });
        if (!canAdvance()) {
            addWarning(content, validationMessage());
        }
    }

    private void renderAffect(LinearLayout content) {
        AssessmentState state = assessment(currentBlockPosition);
        addSectionTitle(content, "Valence and arousal VAS");
        addSlider(content, "How pleasant did the previous experience feel?", "Unpleasant", "Pleasant", state.affectValence, value -> {
            state.affectValence = value;
            state.affectValenceTouched = true;
            emitSnapshot("affect_valence_change");
        }, "affect_vas", "valence_raw_0_100");
        addSlider(content, "How activated did you feel in the previous experience?", "Low Energy", "High Energy", state.affectArousal, value -> {
            state.affectArousal = value;
            state.affectArousalTouched = true;
            emitSnapshot("affect_arousal_change");
        }, "affect_vas", "arousal_raw_0_100");
        if (!canAdvance()) {
            addWarning(content, validationMessage());
        }
    }

    private void renderEmotion(LinearLayout content) {
        AssessmentState state = assessment(currentBlockPosition);
        addSectionTitle(content, "Particle emotion representation");
        addBody(content, "Move each scale to indicate how strongly the particle movement represented that emotion.");
        addEmotionSlider(content, state, "Anger", "anger_raw_0_100");
        addEmotionSlider(content, state, "Disgust", "disgust_raw_0_100");
        addEmotionSlider(content, state, "Fear", "fear_raw_0_100");
        addEmotionSlider(content, state, "Happiness", "happiness_raw_0_100");
        addEmotionSlider(content, state, "Sadness", "sadness_raw_0_100");
        addEmotionSlider(content, state, "Surprise", "surprise_raw_0_100");
    }

    private void renderHand(LinearLayout content) {
        AssessmentState state = assessment(currentBlockPosition);
        addSectionTitle(content, "Virtual hand embodiment");
        addBody(content, "Rate how much you agree or disagree with each statement.");
        addScaleChoice(content, "It felt like the virtual hands were my own hands.", "Strongly disagree", "Strongly agree", 1, 7, state.handOwnership, value -> {
            state.handOwnership = value;
            emitSnapshot("hand_ownership_change");
            render();
        }, "hand_embodiment", "ownership_raw_1_7");
        addScaleChoice(content, "It felt like I was controlling the movements of the virtual hands.", "Strongly disagree", "Strongly agree", 1, 7, state.handAgency, value -> {
            state.handAgency = value;
            emitSnapshot("hand_agency_change");
            render();
        }, "hand_embodiment", "agency_raw_1_7");
        if (!canAdvance()) {
            addWarning(content, validationMessage());
        }
    }

    private void renderComplete(LinearLayout content) {
        addSectionTitle(content, "Questionnaire complete");
        addGood(content, "All expected block questionnaires have been completed and written by the native panel controller.");
        addBody(content, "Participant: " + logger.participantId());
        addBody(content, "APK variant: " + apkVariantId);
    }

    private View footerView() {
        LinearLayout footer = new LinearLayout(activity);
        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.CENTER_VERTICAL);
        footer.setPadding(0, dp(10), 0, 0);

        Button back = button(uiText("button.back"), false);
        back.setEnabled(canGoBack());
        back.setOnClickListener(view -> goBack());
        footer.addView(back, new LinearLayout.LayoutParams(dp(150), dp(54)));

        TextView validation = text(validationMessage(), 14, COLOR_WARNING, true);
        validation.setGravity(Gravity.CENTER_VERTICAL);
        validation.setPadding(dp(14), 0, dp(14), 0);
        footer.addView(validation, new LinearLayout.LayoutParams(0, dp(54), 1.0f));

        Button next = button(nextLabel(), true);
        next.setEnabled(canAdvance());
        next.setOnClickListener(view -> goNext());
        footer.addView(next, new LinearLayout.LayoutParams(dp(230), dp(54)));
        return footer;
    }

    private void goBack() {
        if (!canGoBack()) {
            return;
        }
        logTrustedManualInteraction("manual_previous", "previous_page", activePageId);
        switch (activePageId) {
            case PAGE_READY:
                activePageId = currentBlockPosition == 1 ? PAGE_DEMOGRAPHICS : PAGE_HAND;
                if (currentBlockPosition > 1) {
                    currentBlockPosition--;
                }
                break;
            case PAGE_POLAR:
                activePageId = pageBeforePolar == null || pageBeforePolar.isEmpty() ? PAGE_DEMOGRAPHICS : pageBeforePolar;
                break;
            case PAGE_TASK:
                activePageId = PAGE_READY;
                break;
            case PAGE_SAM:
                activePageId = PAGE_TASK;
                break;
            case PAGE_AFFECT:
                activePageId = PAGE_SAM;
                break;
            case PAGE_EMOTION:
                activePageId = PAGE_AFFECT;
                break;
            case PAGE_HAND:
                activePageId = PAGE_EMOTION;
                break;
            case PAGE_COMPLETE:
                activePageId = PAGE_HAND;
                currentBlockPosition = expectedBlockCount();
                break;
            default:
                activePageId = PAGE_DEMOGRAPHICS;
        }
        emitSnapshot("previousPage");
        render();
    }

    private boolean canGoBack() {
        return !PAGE_DEMOGRAPHICS.equals(activePageId);
    }

    private void goNext() {
        if (!canAdvance()) {
            logManualValidationFailure();
            return;
        }
        logTrustedManualInteraction("manual_next",
                PAGE_READY.equals(activePageId) ? "session_ready" : "next_page",
                activePageId);
        switch (activePageId) {
            case PAGE_DEMOGRAPHICS:
                activePageId = PAGE_READY;
                break;
            case PAGE_READY:
                activePageId = PAGE_TASK;
                break;
            case PAGE_TASK:
                activePageId = PAGE_SAM;
                break;
            case PAGE_SAM:
                activePageId = PAGE_AFFECT;
                break;
            case PAGE_AFFECT:
                activePageId = PAGE_EMOTION;
                break;
            case PAGE_EMOTION:
                activePageId = PAGE_HAND;
                break;
            case PAGE_HAND:
                assessment(currentBlockPosition).complete = true;
                emitSnapshot("block_assessment_complete");
                if (currentBlockPosition >= expectedBlockCount()) {
                    activePageId = PAGE_COMPLETE;
                    completeSessionPhysiology("all_expected_results_written");
                } else {
                    currentBlockPosition++;
                    activePageId = PAGE_READY;
                }
                render();
                return;
            default:
                activePageId = PAGE_DEMOGRAPHICS;
        }
        emitSnapshot("nextPage");
        render();
    }

    private boolean canAdvance() {
        switch (activePageId) {
            case PAGE_POLAR:
                return false;
            case PAGE_DEMOGRAPHICS:
                return demographicsComplete();
            case PAGE_READY:
                return true;
            case PAGE_TASK:
                return audioCompletedBlocks.contains(currentBlockPosition);
            case PAGE_SAM:
                return assessment(currentBlockPosition).samComplete();
            case PAGE_AFFECT:
                return assessment(currentBlockPosition).affectComplete();
            case PAGE_EMOTION:
                return true;
            case PAGE_HAND:
                return assessment(currentBlockPosition).handComplete();
            default:
                return false;
        }
    }

    private String validationMessage() {
        switch (activePageId) {
            case PAGE_DEMOGRAPHICS:
                return demographicsValidationMessage();
            case PAGE_TASK:
                if (!audioCompletedBlocks.contains(currentBlockPosition)) {
                    return audioRunningBlock == currentBlockPosition ? "Audio block is running." : "Waiting for Polar-ready audio block.";
                }
                return "";
            case PAGE_SAM:
                return assessment(currentBlockPosition).samComplete() ? "" : "Select all three SAM scores.";
            case PAGE_AFFECT:
                return assessment(currentBlockPosition).affectComplete() ? "" : "Touch both VAS sliders before continuing.";
            case PAGE_HAND:
                return assessment(currentBlockPosition).handComplete() ? "" : "Answer both hand embodiment items.";
            default:
                return "";
        }
    }

    private String demographicsValidationMessage() {
        List<String> missing = new ArrayList<>();
        if (participantFirstName.trim().isEmpty()) {
            missing.add("first name");
        }
        if (participantLastName.trim().isEmpty()) {
            missing.add("last name");
        }
        if (!ageValid()) {
            missing.add("age from 0 to 120");
        }
        if (handedness.isEmpty()) {
            missing.add("handedness");
        }
        if (gender.isEmpty()) {
            missing.add("gender");
        }
        if (!consentConfirmed) {
            missing.add("consent");
        }
        if (!signatureComplete()) {
            missing.add("signature");
        }
        return missing.isEmpty() ? "" : "Required: " + String.join(", ", missing) + ".";
    }

    private String nextLabel() {
        switch (activePageId) {
            case PAGE_DEMOGRAPHICS:
                return uiText("button.begin");
            case PAGE_READY:
                return uiText("button.start_next_session");
            case PAGE_TASK:
                return audioCompletedBlocks.contains(currentBlockPosition) ? uiText("button.begin_assessment") : uiText("status.waiting");
            case PAGE_HAND:
                return currentBlockPosition >= expectedBlockCount() ? "Finish" : "Next block";
            case PAGE_COMPLETE:
                return "Done";
            default:
                return uiText("button.continue");
        }
    }

    private String pageTitle(String pageId) {
        switch (pageId) {
            case PAGE_DEMOGRAPHICS:
                return uiText("page.demographics.title");
            case PAGE_POLAR:
                return "Polar";
            case PAGE_READY:
                return uiText("page.session_ready.title");
            case PAGE_TASK:
                return uiText("page.vr_task_instructions.title");
            case PAGE_SAM:
                return uiText("page.self_assessment_manikin.title");
            case PAGE_AFFECT:
                return uiText("page.affect_vas.title");
            case PAGE_EMOTION:
                return uiText("page.emotion_representation_vas.title");
            case PAGE_HAND:
                return uiText("page.hand_embodiment.title");
            case PAGE_COMPLETE:
                return "Complete";
            default:
                return pageId;
        }
    }

    private void emitSnapshot(String reason) {
        if (logger == null) {
            return;
        }
        try {
            JSONObject snapshot = buildSnapshot();
            logger.logSnapshot(reason, snapshot);
            maybeStartBlockAudio(snapshot);
            logger.writeCompletedResultsIfNeeded(snapshot);
            if (logger.allExpectedResultsWritten()) {
                completeSessionPhysiology("all_expected_results_written");
            }
        } catch (JSONException error) {
            logger.logHarnessEvent("snapshot_build_failed", error.getMessage());
            Log.e(TAG, "Unable to build native questionnaire snapshot", error);
        }
    }

    private void openPolarPage() {
        if (!PAGE_POLAR.equals(activePageId)) {
            pageBeforePolar = activePageId;
        }
        activePageId = PAGE_POLAR;
        emitSnapshot("openPolarPage");
        render();
    }

    private JSONObject buildSnapshot() throws JSONException {
        JSONObject snapshot = new JSONObject();
        put(snapshot, "protocol_version", "quest.questionnaire.v1");
        put(snapshot, "schema_id", "study6-questionnaire-v8");
        put(snapshot, "panel_id", "study6_questionnaire_panel_preview");
        put(snapshot, "runtime_surface", "spatial_sdk_native_android_view_panel");
        put(snapshot, "active_panel_page_id", activePageId);
        put(snapshot, "active_block_position", currentBlockPosition);
        put(snapshot, "active_condition_position", currentBlockPosition);

        Study6RunLogger.BlockPlan activePlan = logger.blockPlan(Math.min(currentBlockPosition, expectedBlockCount()), languageCode);
        put(snapshot, "active_condition_id", activePlan.vrConditionId);
        put(snapshot, "active_vr_condition_id", activePlan.vrConditionId);
        put(snapshot, "active_coherence_level", activePlan.coherenceLevel);
        put(snapshot, "active_energy_noise_level", activePlan.energyNoiseLevel);
        put(snapshot, "demographics", demographicsJson());

        JSONArray responses = new JSONArray();
        for (int block = 1; block <= expectedBlockCount(); block++) {
            responses.put(responseJson(block));
        }
        put(snapshot, "responses_by_condition", responses);
        put(snapshot, "complete", allAssessmentsComplete());
        return snapshot;
    }

    private JSONObject demographicsJson() throws JSONException {
        JSONObject demographics = new JSONObject();
        put(demographics, "polar_validation", polarValidationJson());
        put(demographics, "language_code", languageCode);
        put(demographics, "participant_first_name", participantFirstName.trim());
        put(demographics, "participant_last_name", participantLastName.trim());
        put(demographics, "participant_name", participantName());
        put(demographics, "age_years", ageValid() ? Integer.parseInt(ageText.trim()) : JSONObject.NULL);
        put(demographics, "handedness", handedness);
        put(demographics, "gender", gender);
        put(demographics, "consent_confirmed", consentConfirmed);
        put(demographics, "consent_text", CONSENT_TEXT);
        put(demographics, "signature", signatureJson());
        put(demographics, "signature_stroke_count", signatureStrokes.size());
        put(demographics, "complete", demographicsComplete());
        return demographics;
    }

    private JSONObject signatureJson() throws JSONException {
        JSONObject signature = new JSONObject();
        put(signature, "type", "native_stroke_signature");
        put(signature, "stroke_count", signatureStrokes.size());
        put(signature, "complete", signatureComplete());
        JSONArray strokes = new JSONArray();
        for (List<PointF> stroke : signatureStrokes) {
            JSONArray points = new JSONArray();
            for (PointF point : stroke) {
                JSONObject pointJson = new JSONObject();
                put(pointJson, "x", point.x);
                put(pointJson, "y", point.y);
                points.put(pointJson);
            }
            strokes.put(points);
        }
        put(signature, "strokes", strokes);
        return signature;
    }

    private JSONObject polarValidationJson() throws JSONException {
        JSONObject polar = latestPolarStatus == null ? new JSONObject() : new JSONObject(latestPolarStatus.toString());
        put(polar, "ready", isPolarReadyForBlock());
        put(polar, "source", "polar_h10_android_ble_pmd");
        put(polar, "native_ready_rule", "streaming && pmd_ready && ecg_streaming && ecg_sample_count > 0 && ecg_sample_rate_hz == 130");
        return polar;
    }

    private JSONObject responseJson(int blockPosition) throws JSONException {
        Study6RunLogger.BlockPlan plan = logger.blockPlan(blockPosition, languageCode);
        AssessmentState state = assessment(blockPosition);
        JSONObject response = new JSONObject();
        put(response, "block_position", blockPosition);
        put(response, "condition_position", blockPosition);
        put(response, "block_id", plan.blockId);
        put(response, "condition_id", plan.vrConditionId);
        put(response, "vr_condition_id", plan.vrConditionId);
        put(response, "coherence_level", plan.coherenceLevel);
        put(response, "energy_noise_level", plan.energyNoiseLevel);
        put(response, "assessment", state.toJson());
        return response;
    }

    private void maybeStartBlockAudio(JSONObject snapshot) throws JSONException {
        String activePage = snapshot.optString("active_panel_page_id", "");
        int blockPosition = snapshot.optInt("active_block_position", snapshot.optInt("active_condition_position", 1));
        if (!PAGE_TASK.equals(activePage)
                || blockPosition <= 0
                || activeAudioBlock == blockPosition
                || audioCompletedBlocks.contains(blockPosition)) {
            return;
        }
        activeAudioBlock = blockPosition;
        Study6RunLogger.BlockPlan blockPlan = logger.blockPlan(blockPosition, languageCodeFromSnapshot(snapshot));
        String uiConditionId = snapshot.optString("active_vr_condition_id", snapshot.optString("active_condition_id", ""));
        if (!uiConditionId.isEmpty() && !blockPlan.vrConditionId.equals(uiConditionId)) {
            JSONObject mismatch = new JSONObject();
            put(mismatch, "ui_active_block_position", blockPosition);
            put(mismatch, "ui_active_vr_condition_id", uiConditionId);
            put(mismatch, "lookup_vr_condition_id", blockPlan.vrConditionId);
            logger.logPhysiologyFailure(blockPlan, "marker_plan_mismatch",
                    "Native panel active condition did not match lookup-derived native block plan.",
                    "metadata_invalid",
                    mismatch);
            logger.logTechnicalFailure(blockPlan, "marker_plan_mismatch",
                    "UI condition " + uiConditionId + " != native lookup condition " + blockPlan.vrConditionId);
            activeAudioBlock = -1;
            return;
        }
        if (!isPolarReadyForBlock()) {
            if (lastAudioGateFailureBlock != blockPosition) {
                JSONObject extra = latestPolarStatus == null ? new JSONObject() : new JSONObject(latestPolarStatus.toString());
                logger.logPhysiologyFailure(blockPlan, "polar_not_ready_at_block_start",
                        "Native Polar readiness gate blocked audio/condition start.",
                        "physiology_invalid",
                        extra);
                logger.logTechnicalFailure(blockPlan, "polar_not_ready_at_block_start",
                        "Native Polar readiness gate blocked audio/condition start.");
                lastAudioGateFailureBlock = blockPosition;
            }
            activeAudioBlock = -1;
            render();
            return;
        }
        logger.logBlockStarted(blockPlan);
        playAudioForBlock(blockPlan);
    }

    private void playAudioForBlock(Study6RunLogger.BlockPlan blockPlan) {
        stopAudio("new_block");
        try {
            mediaPlayer = new MediaPlayer();
            android.content.res.AssetFileDescriptor afd = activity.getAssets()
                    .openFd("neutral-hand-audio/audio/" + blockPlan.audioAssetFile);
            mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            mediaPlayer.setLooping(true);
            mediaPlayer.setOnPreparedListener((player) -> {
                audioRunningBlock = blockPlan.blockPosition;
                render();
                JSONObject ecgArmed = polarManager == null
                        ? noPolarManagerSummary("ecg_recording_armed")
                        : polarManager.armBlockRecording(
                        blockPlan,
                        logger.participantId(),
                        logger.apkVariantId(),
                        logger.ecgCsvFile(blockPlan));
                logger.logEcgRecordingArmed(blockPlan, ecgArmed);
                long syncStartElapsedNs = SystemClock.elapsedRealtimeNanos();
                String syncStartUtc = Instant.now().toString();
                JSONObject syncStart = syncPayload(syncStartElapsedNs, syncStartUtc, "sync_start");
                JSONObject ecgStarted = polarManager == null
                        ? noPolarManagerSummary("ecg_recording_started")
                        : polarManager.startArmedBlockRecording(syncStartElapsedNs, syncStartUtc);
                logger.logEcgRecordingStarted(blockPlan, merge(syncStart, ecgStarted));
                player.start();
                logger.logAudioStarted(blockPlan, syncStart);
                logger.logConditionStarted(blockPlan, syncStart);
                mainHandler.postDelayed(() -> finishAudioWindow(blockPlan), DEV_AUDIO_DURATION_MS);
            });
            mediaPlayer.setOnCompletionListener((player) -> logger.logAudioCompletedBeforeDevDuration(blockPlan));
            mediaPlayer.prepareAsync();
        } catch (IOException error) {
            logger.logTechnicalFailure(blockPlan, "audio_start_failed", error.getMessage());
            Log.e(TAG, "Unable to play audio", error);
        }
    }

    private void finishAudioWindow(Study6RunLogger.BlockPlan blockPlan) {
        long syncEndElapsedNs = SystemClock.elapsedRealtimeNanos();
        String syncEndUtc = Instant.now().toString();
        JSONObject syncEnd = syncPayload(syncEndElapsedNs, syncEndUtc, "sync_end");
        stopAudio("dev_20s_elapsed");
        JSONObject ecgCompleted = polarManager == null
                ? noPolarManagerSummary("ecg_recording_completed")
                : polarManager.stopBlockRecording(syncEndElapsedNs, syncEndUtc);
        logger.logAudioStoppedAtDevDuration(blockPlan, syncEnd);
        logger.logConditionEnded(blockPlan, syncEnd);
        logger.logEcgRecordingCompleted(blockPlan, merge(syncEnd, ecgCompleted));
        logger.logBlockEcgWindowClosed(blockPlan, merge(syncEnd, ecgCompleted));
        logPhysiologyWriteFailures(blockPlan, ecgCompleted);
        audioCompletedBlocks.add(blockPlan.blockPosition);
        activeAudioBlock = -1;
        audioRunningBlock = 0;
        autoAdvanceAfterDevAudio();
    }

    private void autoAdvanceAfterDevAudio() {
        mainHandler.post(() -> {
            if (PAGE_TASK.equals(activePageId)) {
                activePageId = PAGE_SAM;
                emitSnapshot("dev_20s_elapsed");
                render();
            }
        });
    }

    private void onPolarStatus(JSONObject status) {
        latestPolarStatus = status;
        if (logger != null) {
            logger.updatePolarStatus(status);
        }
        if (!polarConnectedLogged && status.optBoolean("connected", false)) {
            polarConnectedLogged = true;
            logger.logPolarConnected(status);
        }
        if (!polarEcgStreamStartedLogged && status.optBoolean("ecg_streaming", false)) {
            polarEcgStreamStartedLogged = true;
            logger.logPolarEcgStreamStarted(status);
        }
        logPolarStatusEvent(status);
        mainHandler.post(() -> {
            if (PAGE_TASK.equals(activePageId)) {
                emitSnapshot("polar_status");
            }
            refreshPolarStatusViews();
        });
    }

    private void logPolarStatusEvent(JSONObject status) {
        long sequence = status.optLong("polar_event_sequence", 0L);
        if (sequence <= 0L || sequence <= lastPolarStatusEventSequence) {
            return;
        }
        lastPolarStatusEventSequence = sequence;
        String eventType = status.optString("polar_event_type", "");
        if (eventType.isEmpty()) {
            return;
        }
        JSONObject extra = new JSONObject();
        put(extra, "polar_event_sequence", sequence);
        put(extra, "failure_code", status.optString("polar_event_failure_code", ""));
        put(extra, "failure_message", status.optString("polar_event_message", ""));
        put(extra, "event_state", status.optString("state", ""));
        put(extra, "polar_device_id", status.optString("device_id", ""));
        put(extra, "device_name", status.optString("device_name", ""));
        put(extra, "device_address", status.optString("device_address", ""));
        put(extra, "polar_ready", status.optBoolean("ready", false));
        put(extra, "heart_rate_bpm", status.optInt("heart_rate_bpm", 0));
        put(extra, "rr_interval_count", status.optInt("rr_interval_count", 0));
        put(extra, "ecg_sample_count", status.optLong("ecg_sample_count", 0L));
        put(extra, "pmd_frame_count", status.optLong("pmd_frame_count", 0L));
        put(extra, "connection_gap_active", status.optBoolean("connection_gap_active", false));
        put(extra, "ecg_gap_count", status.optInt("ecg_gap_count", 0));
        put(extra, "max_ecg_gap_ms", status.optLong("max_ecg_gap_ms", 0L));
        put(extra, "total_ecg_gap_ms", status.optLong("total_ecg_gap_ms", 0L));
        put(extra, "polar_reconnect_count", status.optInt("polar_reconnect_count", 0));
        put(extra, "reconnect_tolerance_ms", status.optLong("reconnect_tolerance_ms", 0L));
        put(extra, "last_disconnect_utc", status.optString("last_disconnect_utc", ""));
        put(extra, "last_disconnect_elapsed_realtime_ns", status.optLong("last_disconnect_elapsed_realtime_ns", 0L));
        Study6RunLogger.BlockPlan activePlan = activeAudioBlock > 0 ? logger.blockPlan(activeAudioBlock) : null;
        logger.logPolarRuntimeMarker(activePlan, eventType, extra);
    }

    private void logPhysiologyWriteFailures(Study6RunLogger.BlockPlan blockPlan, JSONObject summary) {
        if (summary == null) {
            return;
        }
        String writeError = summary.optString("write_error", "");
        if (!writeError.isEmpty()) {
            logger.logPhysiologyFailure(blockPlan, "ecg_write_failed", writeError, "physiology_invalid", summary);
        }
    }

    private boolean isPolarReadyForBlock() {
        return latestPolarStatus != null
                && latestPolarStatus.optBoolean("ready", false)
                && latestPolarStatus.optBoolean("streaming", false)
                && latestPolarStatus.optBoolean("pmd_ready", false)
                && latestPolarStatus.optBoolean("ecg_streaming", false)
                && latestPolarStatus.optLong("ecg_sample_count", 0L) > 0L
                && latestPolarStatus.optInt("ecg_sample_rate_hz", 0) == 130;
    }

    private void completeSessionPhysiology(String reason) {
        if (physiologyCompletedLogged || polarManager == null || logger == null) {
            return;
        }
        physiologyCompletedLogged = true;
        long syncEndElapsedNs = SystemClock.elapsedRealtimeNanos();
        String syncEndUtc = Instant.now().toString();
        JSONObject completed = polarManager.stopSessionRecording(syncEndElapsedNs, syncEndUtc);
        put(completed, "reason", reason);
        if (polarEcgStreamStartedLogged) {
            logger.logPolarEcgStreamStopped(completed);
        }
        logger.logSessionPhysiologyCompleted(completed);
        stopPhysiologyForegroundService();
    }

    private void startPhysiologyForegroundService() {
        try {
            Study6PhysiologyForegroundService.start(activity, logger.participantId(), logger.apkVariantId());
            logger.logHarnessEvent("physiology_foreground_service_started", logger.participantId());
        } catch (RuntimeException error) {
            logger.logHarnessEvent("physiology_foreground_service_start_failed", error.getMessage());
            Log.w(TAG, "Unable to start physiology foreground service", error);
        }
    }

    private void stopPhysiologyForegroundService() {
        try {
            Study6PhysiologyForegroundService.stop(activity);
            logger.logHarnessEvent("physiology_foreground_service_stopped", logger.participantId());
        } catch (RuntimeException error) {
            logger.logHarnessEvent("physiology_foreground_service_stop_failed", error.getMessage());
            Log.w(TAG, "Unable to stop physiology foreground service", error);
        }
    }

    private void stopAudio(String reason) {
        if (mediaPlayer == null) {
            return;
        }
        try {
            if (mediaPlayer.isPlaying()) {
                mediaPlayer.stop();
            }
        } catch (IllegalStateException ignored) {
            // MediaPlayer can be between prepare/start/stop states during app teardown.
        }
        mediaPlayer.release();
        mediaPlayer = null;
        audioRunningBlock = 0;
        if (logger != null) {
            logger.logHarnessEvent("audio_player_released", reason);
        }
    }

    private void runNativeAutoRun() {
        participantFirstName = "AUTO";
        participantLastName = "RUN";
        ageText = "30";
        handedness = "prefer_not_to_say";
        gender = "prefer_not_to_say";
        consentConfirmed = true;
        if (signatureStrokes.isEmpty()) {
            List<PointF> stroke = new ArrayList<>();
            stroke.add(new PointF(0.14f, 0.62f));
            stroke.add(new PointF(0.25f, 0.36f));
            stroke.add(new PointF(0.36f, 0.60f));
            stroke.add(new PointF(0.48f, 0.38f));
            stroke.add(new PointF(0.62f, 0.58f));
            stroke.add(new PointF(0.78f, 0.42f));
            signatureStrokes.add(stroke);
        }
        for (int block = 1; block <= expectedBlockCount(); block++) {
            AssessmentState state = assessment(block);
            state.samValence = autoRunValue("SAM1", block);
            state.samArousal = autoRunValue("SAM2", block);
            state.samDominance = autoRunValue("SAM3", block);
            state.affectValence = autoRunValue("valence", block);
            state.affectArousal = autoRunValue("arousal", block);
            state.affectValenceTouched = true;
            state.affectArousalTouched = true;
            state.emotionValues.put("anger_raw_0_100", autoRunValue("Anger", block));
            state.emotionValues.put("disgust_raw_0_100", autoRunValue("Disgust", block));
            state.emotionValues.put("fear_raw_0_100", autoRunValue("Fear", block));
            state.emotionValues.put("happiness_raw_0_100", autoRunValue("Happiness", block));
            state.emotionValues.put("sadness_raw_0_100", autoRunValue("Sadness", block));
            state.emotionValues.put("surprise_raw_0_100", autoRunValue("Surprise", block));
            state.handOwnership = autoRunValue("Ownership", block);
            state.handAgency = autoRunValue("Agency", block);
            state.complete = true;
        }
        currentBlockPosition = expectedBlockCount();
        activePageId = PAGE_COMPLETE;
        logger.logHarnessEvent("quest_auto_run_finished", "native panel auto-run completed all questionnaire blocks");
        emitSnapshot("quest_auto_run_finished");
        completeSessionPhysiology("quest_auto_run_finished");
        render();
    }

    private int autoRunValue(String itemId, int blockOrder) {
        String profile = autoRunProfile == null ? "linear" : autoRunProfile.toLowerCase();
        boolean even = blockOrder % 2 == 0;
        switch (profile) {
            case "low":
                switch (itemId) {
                    case "SAM1":
                        return Math.max(1, 6 - blockOrder);
                    case "SAM2":
                        return 1 + blockOrder;
                    case "SAM3":
                        return Math.max(1, 5 - blockOrder);
                    case "valence":
                        return 20 + blockOrder;
                    case "arousal":
                        return 30 + blockOrder * 2;
                    case "Anger":
                        return 4 * blockOrder;
                    case "Fear":
                        return 4 * blockOrder + 1;
                    case "Sadness":
                        return 4 * blockOrder + 2;
                    case "Disgust":
                        return 4 * blockOrder + 3;
                    case "Happiness":
                        return 4 * blockOrder + 4;
                    case "Surprise":
                        return 4 * blockOrder + 5;
                    case "Ownership":
                        return blockOrder;
                    case "Agency":
                        return Math.max(1, 5 - blockOrder);
                    default:
                        return 0;
                }
            case "high":
                switch (itemId) {
                    case "SAM1":
                        return 9 - blockOrder;
                    case "SAM2":
                        return 5 + blockOrder;
                    case "SAM3":
                        return Math.min(9, 4 + blockOrder);
                    case "valence":
                        return 75 + blockOrder;
                    case "arousal":
                        return 80 - blockOrder;
                    case "Anger":
                        return 70 + 2 * blockOrder;
                    case "Fear":
                        return 70 + 2 * blockOrder + 1;
                    case "Sadness":
                        return 70 + 2 * blockOrder + 2;
                    case "Disgust":
                        return 70 + 2 * blockOrder + 3;
                    case "Happiness":
                        return 70 + 2 * blockOrder + 4;
                    case "Surprise":
                        return 70 + 2 * blockOrder + 5;
                    case "Ownership":
                        return Math.min(7, 4 + blockOrder);
                    case "Agency":
                        return Math.min(7, 3 + blockOrder);
                    default:
                        return 0;
                }
            case "zigzag":
                switch (itemId) {
                    case "SAM1":
                        return even ? 8 : 2;
                    case "SAM2":
                        return even ? 3 : 7;
                    case "SAM3":
                        return even ? 7 : 3;
                    case "valence":
                        return even ? 68 : 32;
                    case "arousal":
                        return even ? 36 : 72;
                    case "Anger":
                        return even ? 16 : 62;
                    case "Fear":
                        return even ? 18 : 64;
                    case "Sadness":
                        return even ? 20 : 66;
                    case "Disgust":
                        return even ? 22 : 68;
                    case "Happiness":
                        return even ? 74 : 28;
                    case "Surprise":
                        return even ? 48 : 84;
                    case "Ownership":
                        return even ? 6 : 2;
                    case "Agency":
                        return even ? 5 : 3;
                    default:
                        return 0;
                }
            default:
                switch (itemId) {
                    case "SAM1":
                        return 4 + blockOrder;
                    case "SAM2":
                        return Math.max(1, 8 - blockOrder);
                    case "SAM3":
                        return 5;
                    case "valence":
                        return 50 + blockOrder;
                    case "arousal":
                        return 55 + blockOrder;
                    case "Anger":
                        return 10 * blockOrder;
                    case "Fear":
                        return 10 * blockOrder + 1;
                    case "Sadness":
                        return 10 * blockOrder + 2;
                    case "Disgust":
                        return 10 * blockOrder + 3;
                    case "Happiness":
                        return 10 * blockOrder + 4;
                    case "Surprise":
                        return 10 * blockOrder + 5;
                    case "Ownership":
                        return Math.min(7, 3 + blockOrder);
                    case "Agency":
                        return Math.min(7, 4 + blockOrder);
                    default:
                        return 0;
                }
        }
    }

    private boolean demographicsComplete() {
        return !participantFirstName.trim().isEmpty()
                && !participantLastName.trim().isEmpty()
                && ageValid()
                && !handedness.isEmpty()
                && !gender.isEmpty()
                && consentConfirmed
                && signatureComplete();
    }

    private boolean signatureComplete() {
        return !signatureStrokes.isEmpty();
    }

    private boolean ageValid() {
        try {
            int age = Integer.parseInt(ageText.trim());
            return age >= 0 && age <= 120;
        } catch (NumberFormatException error) {
            return false;
        }
    }

    private String participantName() {
        return (participantFirstName.trim() + " " + participantLastName.trim()).trim();
    }

    private boolean allAssessmentsComplete() {
        for (int block = 1; block <= expectedBlockCount(); block++) {
            if (!assessment(block).complete) {
                return false;
            }
        }
        return true;
    }

    private AssessmentState assessment(int blockPosition) {
        AssessmentState state = assessments.get(blockPosition);
        if (state == null) {
            state = new AssessmentState();
            assessments.put(blockPosition, state);
        }
        return state;
    }

    private int expectedBlockCount() {
        try {
            return new JSONArray(logger.questBlockOrderJson()).length();
        } catch (JSONException error) {
            return 4;
        }
    }

    private String languageCodeFromSnapshot(JSONObject snapshot) {
        JSONObject demographics = snapshot == null ? null : snapshot.optJSONObject("demographics");
        return demographics != null && "de".equals(demographics.optString("language_code", "en")) ? "de" : "en";
    }

    private JSONObject syncPayload(long elapsedRealtimeNs, String utc, String phase) {
        JSONObject payload = new JSONObject();
        put(payload, phase + "_elapsed_realtime_ns", elapsedRealtimeNs);
        put(payload, phase + "_utc", utc);
        return payload;
    }

    private JSONObject noPolarManagerSummary(String eventType) {
        JSONObject payload = new JSONObject();
        put(payload, "event_type", eventType);
        put(payload, "state", "polar_manager_unavailable");
        put(payload, "recording_active", false);
        put(payload, "sample_count", 0);
        put(payload, "frame_count", 0);
        put(payload, "device_id", "not_connected");
        return payload;
    }

    private JSONObject merge(JSONObject base, JSONObject extra) {
        JSONObject merged = new JSONObject();
        copyInto(merged, base);
        copyInto(merged, extra);
        return merged;
    }

    private void copyInto(JSONObject target, JSONObject source) {
        if (source == null) {
            return;
        }
        JSONArray names = source.names();
        if (names == null) {
            return;
        }
        for (int i = 0; i < names.length(); i++) {
            String key = names.optString(i);
            put(target, key, source.opt(key));
        }
    }

    private void logManualValidationFailure() {
        JSONObject extra = new JSONObject();
        put(extra, "validation_summary", validationMessage());
        logTrustedManualInteraction("manual_next_blocked_attempt", "next_page", activePageId, extra);
    }

    private void logTrustedManualInteraction(String eventType, String controlGroup, String controlId) {
        logTrustedManualInteraction(eventType, controlGroup, controlId, null);
    }

    private void logTrustedManualInteraction(String eventType, String controlGroup, String controlId, JSONObject extra) {
        if (logger == null || autoRunEnabled) {
            return;
        }
        JSONObject payload = new JSONObject();
        JSONObject target = new JSONObject();
        put(target, "control_group", controlGroup == null ? "" : controlGroup);
        put(target, "control_id", controlId == null ? "" : controlId);
        put(payload, "is_trusted", true);
        put(payload, "source", "native_android_view");
        put(payload, "active_panel_page_id", activePageId);
        put(payload, "active_block_position", currentBlockPosition);
        put(payload, "target", target);
        copyInto(payload, extra);
        logger.logManualInteraction(eventType, payload);
    }

    private void addSectionTitle(LinearLayout parent, String value) {
        TextView title = text(value, 24, COLOR_TEXT, true);
        title.setPadding(0, dp(4), 0, dp(8));
        parent.addView(title);
    }

    private void addBody(LinearLayout parent, String value) {
        TextView body = text(value, 16, COLOR_MUTED, false);
        body.setLineSpacing(2.0f, 1.05f);
        body.setPadding(0, dp(3), 0, dp(8));
        parent.addView(body);
    }

    private void addWarning(LinearLayout parent, String value) {
        TextView warning = text(value, 15, COLOR_WARNING, true);
        warning.setPadding(dp(12), dp(9), dp(12), dp(9));
        warning.setBackground(cardBackground(COLOR_WARNING_SOFT, COLOR_WARNING, 1, 8));
        parent.addView(warning, matchWrapWithBottomMargin(dp(10)));
    }

    private void addGood(LinearLayout parent, String value) {
        TextView good = text(value, 15, COLOR_GOOD, true);
        good.setPadding(dp(12), dp(9), dp(12), dp(9));
        good.setBackground(cardBackground(COLOR_GOOD_SOFT, COLOR_GOOD, 1, 8));
        parent.addView(good, matchWrapWithBottomMargin(dp(10)));
    }

    private void addPolarStatus(LinearLayout parent) {
        PolarStatusCardView polarStatus = new PolarStatusCardView();
        polarStatus.updateStatus();
        parent.addView(polarStatus, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(86)));
        LinearLayout.LayoutParams spacer = matchWrapWithBottomMargin(dp(10));
        spacer.height = dp(0);
        View spacing = new View(activity);
        parent.addView(spacing, spacer);
        polarStatusCards.add(polarStatus);
    }

    private void refreshPolarStatusViews() {
        if (polarHeaderBadge != null) {
            polarHeaderBadge.setText(polarBadgeText());
            polarHeaderBadge.setTextColor(isPolarReadyForBlock() ? COLOR_GOOD : COLOR_WARNING);
            polarHeaderBadge.setBackground(cardBackground(isPolarReadyForBlock() ? COLOR_GOOD_SOFT : COLOR_WARNING_SOFT,
                    isPolarReadyForBlock() ? COLOR_GOOD : COLOR_WARNING,
                    1,
                    8));
        }
        for (PolarStatusCardView view : polarStatusCards) {
            view.updateStatus();
        }
    }

    private String polarStatusDetail() {
        JSONObject status = latestPolarStatus;
        if (status == null) {
            return "Waiting for live Polar ECG samples";
        }
        return "HR " + status.optInt("heart_rate_bpm", 0) + " bpm"
                + " | RR " + status.optInt("rr_interval_count", 0)
                + " | ECG " + status.optLong("ecg_sample_count", 0L)
                + " samples @ " + status.optInt("ecg_sample_rate_hz", 0) + " Hz";
    }

    private String polarDataflowDetail() {
        JSONObject status = latestPolarStatus;
        if (status == null) {
            return "No Polar status has been published yet.";
        }
        return "connected=" + status.optBoolean("connected", false)
                + " | pmd_ready=" + status.optBoolean("pmd_ready", false)
                + " | ecg_streaming=" + status.optBoolean("ecg_streaming", false)
                + " | heart_rate_events=" + status.optLong("heart_rate_event_count", 0L)
                + " | pmd_frames=" + status.optLong("pmd_frame_count", 0L)
                + " | ecg_samples=" + status.optLong("ecg_sample_count", 0L)
                + " | malformed_frames=" + status.optLong("malformed_frame_count", 0L)
                + " | mtu=" + status.optInt("negotiated_mtu", 0)
                + " | last_error=" + status.optString("last_error", "");
    }

    private void addPolarCandidateRows(LinearLayout parent) {
        JSONArray candidates = latestPolarStatus == null ? null : latestPolarStatus.optJSONArray("recent_scan_candidates");
        if (candidates == null || candidates.length() == 0) {
            addWarning(parent, "No recent scan candidates yet. Press Restart scan and wait a few seconds.");
            return;
        }
        for (int i = 0; i < candidates.length(); i++) {
            JSONObject candidate = candidates.optJSONObject(i);
            if (candidate == null) {
                continue;
            }
            LinearLayout row = new LinearLayout(activity);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            TextView label = text(polarCandidateLabel(candidate), 13, COLOR_TEXT, false);
            label.setPadding(0, 0, dp(8), 0);
            row.addView(label, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
            String address = candidate.optString("address", "");
            Button connect = button(candidate.optBoolean("accepted", false) ? "Connect" : "Try", candidate.optBoolean("accepted", false));
            connect.setEnabled(!address.isEmpty());
            connect.setOnClickListener(view -> {
                if (polarManager != null && !address.isEmpty()) {
                    polarManager.connectToAddress(address);
                    logger.logHarnessEvent("polar_manual_connect_requested", address);
                }
                refreshPolarStatusViews();
            });
            row.addView(connect, new LinearLayout.LayoutParams(dp(120), dp(48)));
            parent.addView(row, matchWrapWithBottomMargin(dp(8)));
        }
    }

    private String polarCandidateLabel(JSONObject candidate) {
        String name = candidate.optString("name", "");
        if (name.isEmpty()) {
            name = "Unnamed BLE device";
        }
        String address = candidate.optString("address", "");
        return name
                + (address.isEmpty() ? "" : " | " + address)
                + " | RSSI " + candidate.optInt("rssi", 0)
                + " | score " + candidate.optInt("match_score", 0)
                + " | HR " + candidate.optBoolean("heart_rate_service", false)
                + " | PMD " + candidate.optBoolean("pmd_service", false);
    }

    private String bestPolarCandidateSummary(JSONObject status) {
        JSONArray candidates = status.optJSONArray("recent_scan_candidates");
        if (candidates == null || candidates.length() == 0) {
            return "";
        }
        JSONObject best = null;
        for (int i = 0; i < candidates.length(); i++) {
            JSONObject candidate = candidates.optJSONObject(i);
            if (candidate == null || !candidate.optBoolean("accepted", false)) {
                continue;
            }
            if (best == null || candidate.optInt("match_score", 0) > best.optInt("match_score", 0)) {
                best = candidate;
            }
        }
        if (best == null) {
            best = candidates.optJSONObject(candidates.length() - 1);
        }
        if (best == null) {
            return "";
        }
        String name = best.optString("name", "");
        String address = best.optString("address", "");
        String label = name.isEmpty() ? address : name;
        return label.isEmpty() ? "" : label + " RSSI " + best.optInt("rssi", 0);
    }

    private EditText addTextField(LinearLayout parent, String label, String value, int inputType,
            TextChanged changed, String controlGroup) {
        return addTextField(parent, label, value, inputType, changed, 1.0f, controlGroup);
    }

    private EditText addTextField(LinearLayout parent, String label, String value, int inputType,
            TextChanged changed, float weight, String controlGroup) {
        LinearLayout field = new LinearLayout(activity);
        field.setOrientation(LinearLayout.VERTICAL);
        TextView labelView = text(label, 15, COLOR_TEXT, true);
        labelView.setPadding(0, 0, 0, dp(4));
        field.addView(labelView);
        EditText editText = new EditText(activity);
        editText.setText(value);
        editText.setSingleLine(true);
        editText.setTextSize(18);
        editText.setTextColor(COLOR_TEXT);
        editText.setInputType(inputType);
        editText.setFocusable(true);
        editText.setFocusableInTouchMode(true);
        editText.setCursorVisible(true);
        editText.setPadding(dp(12), 0, dp(12), 0);
        editText.setBackground(cardBackground(COLOR_SURFACE, COLOR_BORDER, 1, 8));
        editText.setSelectAllOnFocus(false);
        editText.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                changed.onChanged(s == null ? "" : s.toString());
                logTrustedManualInteraction("manual_control_change", controlGroup, label);
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });
        field.addView(editText, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(44)));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                weight == 0.0f ? LinearLayout.LayoutParams.WRAP_CONTENT : 0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                weight);
        params.setMargins(0, 0, dp(10), 0);
        parent.addView(field, params);
        return editText;
    }

    private void addChoiceRow(LinearLayout parent, String label, String selected, Choice[] choices,
            ChoiceChanged changed, String controlGroup) {
        TextView labelView = text(label, 15, COLOR_TEXT, true);
        labelView.setPadding(0, dp(14), 0, dp(6));
        parent.addView(labelView);
        LinearLayout row = new LinearLayout(activity);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        for (Choice choice : choices) {
            Button button = button(choice.label, choice.id.equals(selected));
            button.setOnClickListener(view -> {
                logTrustedManualInteraction("manual_control_change", controlGroup, choice.id);
                changed.onChanged(choice.id);
                render();
            });
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(48), 1.0f);
            params.setMargins(0, 0, dp(8), 0);
            row.addView(button, params);
        }
        parent.addView(row, matchWrapWithBottomMargin(dp(6)));
    }

    private void addSamChoiceRow(LinearLayout parent, String dimension, String question, String low, String high, int selected, IntChanged changed) {
        LinearLayout rowBlock = new LinearLayout(activity);
        rowBlock.setOrientation(LinearLayout.VERTICAL);
        rowBlock.setPadding(0, dp(2), 0, dp(4));
        rowBlock.setClipChildren(false);
        rowBlock.setClipToPadding(false);

        LinearLayout rowLabel = new LinearLayout(activity);
        rowLabel.setOrientation(LinearLayout.VERTICAL);
        rowLabel.setGravity(Gravity.CENTER);
        TextView questionView = text(question, 12, COLOR_TEXT, true);
        questionView.setGravity(Gravity.CENTER);
        TextView axis = text(low + "   1 / 9   " + high, 11, COLOR_MUTED, true);
        axis.setGravity(Gravity.CENTER);
        rowLabel.addView(questionView);
        rowLabel.addView(axis);
        rowBlock.addView(rowLabel, matchWrapWithBottomMargin(dp(3)));

        LinearLayout scale = new LinearLayout(activity);
        scale.setOrientation(LinearLayout.HORIZONTAL);
        scale.setGravity(Gravity.CENTER_VERTICAL);
        scale.setClipChildren(false);
        scale.setClipToPadding(false);
        TextView lowAnchor = text(low, 13, COLOR_MUTED, true);
        lowAnchor.setGravity(Gravity.CENTER);
        scale.addView(lowAnchor, new LinearLayout.LayoutParams(dp(86), dp(SAM_CHOICE_HEIGHT_DP)));

        LinearLayout options = new LinearLayout(activity);
        options.setOrientation(LinearLayout.HORIZONTAL);
        options.setClipChildren(false);
        options.setClipToPadding(false);
        for (int value = 1; value <= 9; value++) {
            final int choiceValue = value;
            SamChoiceView choice = new SamChoiceView(dimension, value, value == selected);
            choice.setOnClickListener(view -> {
                logTrustedManualInteraction("manual_control_change", "sam", dimension + "_" + choiceValue);
                changed.onChanged(choiceValue);
            });
            LinearLayout.LayoutParams choiceParams = new LinearLayout.LayoutParams(0, dp(SAM_CHOICE_HEIGHT_DP), 1.0f);
            choiceParams.setMargins(0, 0, dp(4), 0);
            options.addView(choice, choiceParams);
        }
        scale.addView(options, new LinearLayout.LayoutParams(0, dp(SAM_CHOICE_HEIGHT_DP), 1.0f));

        TextView highAnchor = text(high, 13, COLOR_MUTED, true);
        highAnchor.setGravity(Gravity.CENTER);
        scale.addView(highAnchor, new LinearLayout.LayoutParams(dp(86), dp(SAM_CHOICE_HEIGHT_DP)));
        rowBlock.addView(scale);
        parent.addView(rowBlock, matchWrapWithBottomMargin(dp(4)));
    }

    private void addScaleChoice(LinearLayout parent, String question, String low, String high, int min, int max,
            int selected, IntChanged changed, String controlGroup, String controlId) {
        TextView questionView = text(question, 16, COLOR_TEXT, true);
        questionView.setPadding(0, dp(14), 0, dp(5));
        parent.addView(questionView);
        LinearLayout anchors = new LinearLayout(activity);
        anchors.setOrientation(LinearLayout.HORIZONTAL);
        anchors.addView(text(low, 13, COLOR_MUTED, false), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        TextView highView = text(high, 13, COLOR_MUTED, false);
        highView.setGravity(Gravity.RIGHT);
        anchors.addView(highView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        parent.addView(anchors);

        LinearLayout row = new LinearLayout(activity);
        row.setOrientation(LinearLayout.HORIZONTAL);
        for (int value = min; value <= max; value++) {
            int option = value;
            Button button = button(String.valueOf(value), value == selected);
            button.setOnClickListener(view -> {
                logTrustedManualInteraction("manual_control_change", controlGroup, controlId + "_" + option);
                changed.onChanged(option);
            });
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(46), 1.0f);
            params.setMargins(0, dp(5), dp(6), dp(8));
            row.addView(button, params);
        }
        parent.addView(row);
    }

    private void addSlider(LinearLayout parent, String question, String low, String high, int value,
            IntChanged changed, String controlGroup, String controlId) {
        TextView title = text(question, 16, COLOR_TEXT, true);
        title.setPadding(0, dp(14), 0, dp(4));
        parent.addView(title);
        TextView valueLabel = text("Value: " + value, 15, COLOR_MUTED, true);
        parent.addView(valueLabel);
        SeekBar seekBar = new SeekBar(activity);
        seekBar.setMax(100);
        seekBar.setProgress(value);
        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                valueLabel.setText("Value: " + progress);
                if (fromUser) {
                    logTrustedManualInteraction("manual_control_change", controlGroup, controlId);
                    changed.onChanged(progress);
                }
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                render();
            }
        });
        parent.addView(seekBar, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)));
        LinearLayout anchors = new LinearLayout(activity);
        anchors.setOrientation(LinearLayout.HORIZONTAL);
        anchors.addView(text(low, 13, COLOR_MUTED, false), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        TextView highView = text(high, 13, COLOR_MUTED, false);
        highView.setGravity(Gravity.RIGHT);
        anchors.addView(highView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
        parent.addView(anchors, matchWrapWithBottomMargin(dp(8)));
    }

    private void addEmotionSlider(LinearLayout parent, AssessmentState state, String label, String field) {
        int value = state.emotionValues.containsKey(field) ? state.emotionValues.get(field) : 0;
        addSlider(parent, label, "Not represented", "Clearly represented", value, updated -> {
            state.emotionValues.put(field, updated);
            emitSnapshot("emotion_" + field + "_change");
        }, "emotion_representation_vas", field);
    }

    private Button button(String label, boolean selected) {
        Button button = new Button(activity);
        button.setText(label);
        button.setTextSize(14);
        button.setAllCaps(false);
        button.setTextColor(selected ? COLOR_PRIMARY_DARK : COLOR_TEXT);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setBackground(cardBackground(
                selected ? COLOR_PRIMARY_SOFT : COLOR_SURFACE,
                selected ? COLOR_PRIMARY : COLOR_BORDER,
                selected ? 2 : 1,
                8));
        button.setPadding(dp(8), 0, dp(8), 0);
        return button;
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView textView = new TextView(activity);
        textView.setText(value);
        textView.setTextSize(sp);
        textView.setTextColor(color);
        if (bold) {
            textView.setTypeface(Typeface.DEFAULT_BOLD);
        }
        return textView;
    }

    private LinearLayout column() {
        LinearLayout column = new LinearLayout(activity);
        column.setOrientation(LinearLayout.VERTICAL);
        return column;
    }

    private GradientDrawable panelBackground() {
        GradientDrawable background = new GradientDrawable();
        background.setColor(COLOR_PANEL);
        background.setStroke(dp(1), 0xffb8c3cf);
        background.setCornerRadius(0);
        return background;
    }

    private GradientDrawable cardBackground(int color, int strokeColor, int strokeDp, int radiusDp) {
        GradientDrawable background = new GradientDrawable();
        background.setColor(color);
        background.setStroke(dp(strokeDp), strokeColor);
        background.setCornerRadius(dp(radiusDp));
        return background;
    }

    private String signatureStatusText() {
        int count = signatureStrokes.size();
        if (count == 0) {
            return uiText("signature.empty");
        }
        return count == 1 ? uiText("signature.one") : count + " " + uiText("signature.many");
    }

    private void updateSignatureStatus() {
        if (signatureStatusView != null) {
            signatureStatusView.setText(signatureStatusText());
        }
    }

    private void clearSignatureStrokes() {
        signatureStrokes.clear();
        if (signaturePadView != null) {
            signaturePadView.invalidate();
        }
        updateSignatureStatus();
        emitSnapshot("signature_clear");
        mainHandler.post(this::render);
    }

    private LinearLayout.LayoutParams matchWrapWithBottomMargin(int bottomMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, bottomMargin);
        return params;
    }

    private int dp(int value) {
        return Math.round(value * activity.getResources().getDisplayMetrics().density);
    }

    private void put(JSONObject object, String key, Object value) {
        try {
            object.put(key, value);
        } catch (JSONException error) {
            throw new IllegalStateException("Unable to put " + key, error);
        }
    }

    private String stringExtra(Intent intent, String key, String fallback) {
        String value = intent == null ? null : intent.getStringExtra(key);
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private boolean booleanExtra(Intent intent, String key, boolean fallback) {
        if (intent == null || !intent.hasExtra(key)) {
            return fallback;
        }
        return intent.getBooleanExtra(key, fallback) || "true".equalsIgnoreCase(intent.getStringExtra(key));
    }

    private String uiText(String key) {
        boolean german = "de".equals(languageCode);
        switch (key) {
            case "page.demographics.title":
                return german ? "Demografische Angaben" : "Demographics";
            case "page.demographics.subtitle":
                return german ? "Teilnehmerdaten, Einwilligung und Polar-H10-Pruefung" : "Participant details, consent, and Polar H10 check";
            case "page.session_ready.title":
                return german ? "Bereit fuer die naechste Sitzung" : "Ready for next session";
            case "page.vr_task_instructions.title":
                return german ? "VR-Aufgabenanweisungen" : "VR task instructions";
            case "page.self_assessment_manikin.title":
                return german ? "Self-Assessment-Manikin-Piktogramme" : "Self-Assessment Manikin pictographs";
            case "page.affect_vas.title":
                return german ? "Valenz- und Aktivierungs-VAS" : "Valence and arousal VAS";
            case "page.emotion_representation_vas.title":
                return german ? "VAS zur Emotionsdarstellung der Partikel" : "Particle emotion representation VAS";
            case "page.hand_embodiment.title":
                return german ? "Verkoerperung der virtuellen Haende" : "Virtual hand embodiment";
            case "demographics.language":
                return german ? "Sprache" : "Language";
            case "demographics.first_name":
                return german ? "Vorname" : "First name";
            case "demographics.last_name":
                return german ? "Nachname" : "Last name";
            case "demographics.age":
                return german ? "Alter" : "Age";
            case "demographics.handedness":
                return german ? "Haendigkeit" : "Handedness";
            case "demographics.gender":
                return german ? "Geschlecht" : "Gender";
            case "demographics.signature":
                return german ? "Unterschrift" : "Signature";
            case "consent.text":
                return german ? "Ich willige ein, an dieser Studie teilzunehmen." : CONSENT_TEXT;
            case "button.back":
                return german ? "Zurueck" : "Back";
            case "button.begin":
                return german ? "Beginnen" : "Begin";
            case "button.begin_assessment":
                return german ? "Bewertung beginnen" : "Begin assessment";
            case "button.continue":
                return german ? "Weiter" : "Continue";
            case "button.start_next_session":
                return german ? "Naechste Sitzung starten" : "Start next session";
            case "button.clear":
                return german ? "Loeschen" : "Clear";
            case "status.waiting":
                return german ? "Warten" : "Waiting";
            case "sam.instruction":
                return german
                        ? "Waehlen Sie in jeder Zeile das Bild aus, das am besten beschreibt, wie Sie sich waehrend der vorherigen Sitzung gefuehlt haben."
                        : "For each row, choose the picture that best matches how you felt during the previous session.";
            case "sam.valence.question":
                return german ? "Wie angenehm fuehlte sich diese Erfahrung an?" : "How pleasant did this experience feel?";
            case "sam.valence.low":
                return german ? "Unangenehm" : "Unpleasant";
            case "sam.valence.high":
                return german ? "Angenehm" : "Pleasant";
            case "sam.arousal.question":
                return german ? "Wie aktiviert fuehlten Sie sich?" : "How activated did you feel?";
            case "sam.arousal.low":
                return german ? "Wenig aktiviert" : "Low Energy";
            case "sam.arousal.high":
                return german ? "Stark aktiviert" : "High Energy";
            case "sam.dominance.question":
                return german ? "Wie viel Kontrolle hatten Sie waehrend Ihrer Erfahrung?" : "How much control did you feel during your experience?";
            case "sam.dominance.low":
                return german ? "Keine Kontrolle" : "Not in control";
            case "sam.dominance.high":
                return german ? "Viel Kontrolle" : "In control";
            case "signature.empty":
                return german ? "Unterschrift erforderlich" : "Signature required";
            case "signature.one":
                return german ? "1 Unterschriftsstrich erfasst" : "1 signature stroke captured";
            case "signature.many":
                return german ? "Unterschriftsstriche erfasst" : "signature strokes captured";
            default:
                return key;
        }
    }

    private String choiceText(String group, String id) {
        boolean german = "de".equals(languageCode);
        if ("handedness".equals(group)) {
            if ("right".equals(id)) {
                return german ? "Rechts" : "Right";
            }
            if ("left".equals(id)) {
                return german ? "Links" : "Left";
            }
            if ("ambidextrous".equals(id)) {
                return german ? "Beidhaendig" : "Ambidextrous";
            }
            return german ? "Keine Angabe" : "Prefer not to say";
        }
        if ("male".equals(id)) {
            return german ? "Maennlich" : "Male";
        }
        if ("female".equals(id)) {
            return german ? "Weiblich" : "Female";
        }
        if ("other".equals(id)) {
            return german ? "Divers" : "Other";
        }
        return german ? "Keine Angabe" : "Prefer not to say";
    }

    private float clamp01(float value) {
        return Math.max(0.0f, Math.min(1.0f, value));
    }

    private String polarStatusTitle() {
        if (isPolarReadyForBlock()) {
            return "Polar H10 ECG ready";
        }
        JSONObject status = latestPolarStatus;
        if (status == null) {
            return "Searching for nearby Polar H10";
        }
        String state = status.optString("state", "");
        return state.isEmpty() ? "Polar H10 pending" : "Polar H10 " + state;
    }

    private String polarDeviceLabel() {
        JSONObject status = latestPolarStatus;
        if (status == null) {
            return "Polar ID: not connected";
        }
        String device = status.optString("device_id", "");
        if (device.isEmpty()) {
            device = status.optString("device_address", "");
        }
        if (device.isEmpty()) {
            device = bestPolarCandidateSummary(status);
        }
        return "Polar ID: " + (device.isEmpty() ? "not connected" : device);
    }

    private final class PolarStatusCardView extends LinearLayout {
        private final View lamp;
        private final TextView title;
        private final TextView detail;
        private final TextView device;
        private final TextView diagnostic;
        private final PolarWaveformView waveform;

        PolarStatusCardView() {
            super(activity);
            setOrientation(HORIZONTAL);
            setGravity(Gravity.CENTER_VERTICAL);
            setPadding(dp(12), dp(10), dp(12), dp(10));

            LinearLayout main = new LinearLayout(activity);
            main.setOrientation(HORIZONTAL);
            main.setGravity(Gravity.CENTER_VERTICAL);

            lamp = new View(activity);
            LinearLayout.LayoutParams lampParams = new LinearLayout.LayoutParams(dp(22), dp(22));
            lampParams.setMargins(0, 0, dp(12), 0);
            main.addView(lamp, lampParams);

            LinearLayout textGroup = new LinearLayout(activity);
            textGroup.setOrientation(VERTICAL);
            title = text("", 15, COLOR_TEXT, true);
            detail = text("", 12, COLOR_MUTED, false);
            detail.setTypeface(Typeface.MONOSPACE);
            device = text("", 12, COLOR_MUTED, false);
            device.setTypeface(Typeface.MONOSPACE);
            diagnostic = text("", 11, COLOR_MUTED, false);
            textGroup.addView(title);
            textGroup.addView(detail);
            textGroup.addView(device);
            textGroup.addView(diagnostic);
            main.addView(textGroup, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
            addView(main, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));

            waveform = new PolarWaveformView();
            LinearLayout.LayoutParams waveformParams = new LinearLayout.LayoutParams(dp(300), dp(48));
            waveformParams.setMargins(dp(14), 0, 0, 0);
            addView(waveform, waveformParams);
        }

        void updateStatus() {
            boolean ready = isPolarReadyForBlock();
            setBackground(cardBackground(ready ? COLOR_GOOD_SOFT : COLOR_WARNING_SOFT,
                    ready ? COLOR_GOOD : 0xffd1a139,
                    1,
                    8));
            lamp.setBackground(cardBackground(ready ? COLOR_GOOD : 0xffa06a00,
                    ready ? COLOR_GOOD : 0xffa06a00,
                    1,
                    999));
            title.setText(polarStatusTitle());
            detail.setText(polarStatusDetail());
            device.setText(polarDeviceLabel());
            JSONObject status = latestPolarStatus;
            String diagnosticText = status == null
                    ? "Waiting for live Polar ECG samples"
                    : status.optString("diagnostic", status.optString("last_error", ""));
            diagnostic.setText(diagnosticText);
            waveform.invalidate();
        }
    }

    private final class PolarWaveformView extends View {
        private final Paint gridPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint wavePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

        PolarWaveformView() {
            super(activity);
            setBackground(cardBackground(0xb8ffffff, isPolarReadyForBlock() ? COLOR_GOOD : 0xffd1a139, 1, 8));
            gridPaint.setColor(0x24475569);
            gridPaint.setStrokeWidth(dp(1));
            wavePaint.setColor(0xff127a3a);
            wavePaint.setStyle(Paint.Style.STROKE);
            wavePaint.setStrokeWidth(dp(2));
            textPaint.setColor(COLOR_MUTED);
            textPaint.setTextSize(dp(11));
            textPaint.setTextAlign(Paint.Align.CENTER);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            int width = getWidth();
            int height = getHeight();
            for (int x = dp(36); x < width; x += dp(36)) {
                canvas.drawLine(x, 0, x, height, gridPaint);
            }
            canvas.drawLine(0, height / 2.0f, width, height / 2.0f, gridPaint);
            JSONArray samples = latestPolarStatus == null ? null : latestPolarStatus.optJSONArray("recent_ecg_samples_uv");
            if (samples == null || samples.length() < 2) {
                canvas.drawText(isPolarReadyForBlock() ? "ECG" : "waiting", width / 2.0f, height / 2.0f + dp(4), textPaint);
                return;
            }
            int count = Math.min(samples.length(), 160);
            int offset = samples.length() - count;
            double min = Double.MAX_VALUE;
            double max = -Double.MAX_VALUE;
            for (int i = 0; i < count; i++) {
                double value = samples.optDouble(offset + i, 0.0);
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
            double range = Math.max(1.0, max - min);
            Path path = new Path();
            for (int i = 0; i < count; i++) {
                double value = samples.optDouble(offset + i, 0.0);
                float x = count <= 1 ? 0.0f : (i / (float) (count - 1)) * width;
                float y = (float) (height - ((value - min) / range) * height);
                y = Math.max(dp(4), Math.min(height - dp(4), y));
                if (i == 0) {
                    path.moveTo(x, y);
                } else {
                    path.lineTo(x, y);
                }
            }
            canvas.drawPath(path, wavePaint);
        }
    }

    private final class SignaturePadView extends View {
        private final Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint guidePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private List<PointF> activeStroke;

        SignaturePadView() {
            super(activity);
            setFocusable(true);
            setBackground(cardBackground(COLOR_SURFACE, COLOR_BORDER, 1, 8));
            strokePaint.setColor(COLOR_TEXT);
            strokePaint.setStyle(Paint.Style.STROKE);
            strokePaint.setStrokeCap(Paint.Cap.ROUND);
            strokePaint.setStrokeJoin(Paint.Join.ROUND);
            strokePaint.setStrokeWidth(dp(3));
            guidePaint.setColor(0xffe5edf6);
            guidePaint.setStyle(Paint.Style.STROKE);
            guidePaint.setStrokeWidth(dp(1));
            textPaint.setColor(COLOR_MUTED);
            textPaint.setTextAlign(Paint.Align.CENTER);
            textPaint.setTextSize(dp(13));
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float baseline = getHeight() * 0.70f;
            canvas.drawLine(dp(18), baseline, getWidth() - dp(18), baseline, guidePaint);
            if (signatureStrokes.isEmpty()) {
                canvas.drawText(uiText("signature.empty"), getWidth() / 2.0f, getHeight() / 2.0f, textPaint);
            }
            for (List<PointF> stroke : signatureStrokes) {
                drawStroke(canvas, stroke);
            }
        }

        private void drawStroke(Canvas canvas, List<PointF> stroke) {
            if (stroke == null || stroke.isEmpty()) {
                return;
            }
            Path path = new Path();
            for (int i = 0; i < stroke.size(); i++) {
                PointF point = stroke.get(i);
                float x = point.x * getWidth();
                float y = point.y * getHeight();
                if (i == 0) {
                    path.moveTo(x, y);
                } else {
                    path.lineTo(x, y);
                }
            }
            canvas.drawPath(path, strokePaint);
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            if (getWidth() <= 0 || getHeight() <= 0) {
                return true;
            }
            int action = event.getActionMasked();
            if (action == MotionEvent.ACTION_DOWN) {
                getParent().requestDisallowInterceptTouchEvent(true);
                activeStroke = new ArrayList<>();
                signatureStrokes.add(activeStroke);
                addTouchPoint(event);
                invalidate();
                return true;
            }
            if (activeStroke == null) {
                return true;
            }
            if (action == MotionEvent.ACTION_MOVE) {
                for (int i = 0; i < event.getHistorySize(); i++) {
                    activeStroke.add(new PointF(
                            clamp01(event.getHistoricalX(i) / Math.max(1.0f, getWidth())),
                            clamp01(event.getHistoricalY(i) / Math.max(1.0f, getHeight()))));
                }
                addTouchPoint(event);
                invalidate();
                return true;
            }
            if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                addTouchPoint(event);
                getParent().requestDisallowInterceptTouchEvent(false);
                activeStroke = null;
                updateSignatureStatus();
                emitSnapshot("signature_stroke_change");
                invalidate();
                mainHandler.post(Study6NativeQuestionnairePanelController.this::render);
                return true;
            }
            return true;
        }

        private void addTouchPoint(MotionEvent event) {
            if (activeStroke == null) {
                return;
            }
            activeStroke.add(new PointF(
                    clamp01(event.getX() / Math.max(1.0f, getWidth())),
                    clamp01(event.getY() / Math.max(1.0f, getHeight()))));
        }
    }

    private final class SamChoiceView extends FrameLayout {
        private final String dimension;
        private final int value;
        private final boolean selected;

        SamChoiceView(String dimension, int value, boolean selected) {
            super(activity);
            this.dimension = dimension;
            this.value = value;
            this.selected = selected;
            setClickable(true);
            setClipChildren(false);
            setClipToPadding(false);
            setBackground(cardBackground(
                    selected ? COLOR_SELECTED : COLOR_SURFACE,
                    selected ? COLOR_SELECTED_BORDER : COLOR_BORDER,
                    selected ? 3 : 1,
                    8));

            WebView image = new WebView(activity);
            image.setBackgroundColor(0x00000000);
            image.setEnabled(false);
            image.setFocusable(false);
            image.setFocusableInTouchMode(false);
            image.setClickable(false);
            image.setLongClickable(false);
            image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            image.getSettings().setJavaScriptEnabled(false);
            image.getSettings().setAllowFileAccess(true);
            image.getSettings().setAllowContentAccess(false);
            image.loadDataWithBaseURL(
                    "file:///android_asset/",
                    samImageHtml(),
                    "text/html",
                    "UTF-8",
                    null);
            LayoutParams imageParams = new LayoutParams(dp(samImageBoxWidthDp()), dp(samImageBoxHeightDp()));
            imageParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            imageParams.topMargin = dp(samImageTopMarginDp());
            addView(image, imageParams);

            TextView number = text(String.valueOf(value), 13, COLOR_MUTED, false);
            number.setGravity(Gravity.CENTER);
            LayoutParams numberParams = new LayoutParams(
                    LayoutParams.MATCH_PARENT,
                    dp(18));
            numberParams.gravity = Gravity.BOTTOM;
            numberParams.bottomMargin = dp(3);
            addView(number, numberParams);
        }

        private String samImageHtml() {
            String path = samAssetPath();
            int imageWidth = Math.round(samImageWidthCssPx());
            return "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
                    + "<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;}"
                    + "body{display:flex;align-items:center;justify-content:center;}"
                    + "img{display:block;width:" + imageWidth + "px;height:auto;max-width:none;max-height:none;}</style>"
                    + "</head><body><img src=\"" + path + "\" alt=\"\"></body></html>";
        }

        private String samAssetPath() {
            String scale = "dominance".equals(dimension) ? "valence" : dimension;
            int score = "dominance".equals(dimension) ? 5 : value;
            return "file:///android_asset/questionnaire-assets/sam/"
                    + scale
                    + "/"
                    + scale
                    + "_"
                    + (score < 10 ? "0" : "")
                    + score
                    + ".svg";
        }

        private float samImageWidthCssPx() {
            if ("dominance".equals(dimension)) {
                return 46.0f * dominanceScale();
            }
            return 46.0f * 1.54f;
        }

        private int samImageBoxWidthDp() {
            return Math.max(82, Math.round(samImageWidthCssPx()) + 12);
        }

        private int samImageBoxHeightDp() {
            return Math.max(84, Math.round(samImageHeightCssPx()) + 8);
        }

        private int samImageTopMarginDp() {
            float pictureCenter = (SAM_CHOICE_HEIGHT_DP - SAM_NUMBER_STRIP_DP) / 2.0f;
            return Math.round(pictureCenter - (samImageBoxHeightDp() / 2.0f));
        }

        private float samImageHeightCssPx() {
            return samImageWidthCssPx() * 1.07f;
        }

        private float dominanceScale() {
            int index = Math.max(0, Math.min(DOMINANCE_SAM_SCALE_FACTORS.length - 1, value - 1));
            return DOMINANCE_SAM_SCALE_FACTORS[index];
        }
    }

    private interface TextChanged {
        void onChanged(String value);
    }

    private interface ChoiceChanged {
        void onChanged(String value);
    }

    private interface IntChanged {
        void onChanged(int value);
    }

    private static final class Choice {
        final String id;
        final String label;

        Choice(String id, String label) {
            this.id = id;
            this.label = label;
        }
    }

    private final class AssessmentState {
        int samValence = 0;
        int samArousal = 0;
        int samDominance = 0;
        int affectValence = 50;
        int affectArousal = 50;
        boolean affectValenceTouched;
        boolean affectArousalTouched;
        final Map<String, Integer> emotionValues = new HashMap<>();
        int handOwnership = 0;
        int handAgency = 0;
        boolean complete;

        AssessmentState() {
            emotionValues.put("anger_raw_0_100", 0);
            emotionValues.put("disgust_raw_0_100", 0);
            emotionValues.put("fear_raw_0_100", 0);
            emotionValues.put("happiness_raw_0_100", 0);
            emotionValues.put("sadness_raw_0_100", 0);
            emotionValues.put("surprise_raw_0_100", 0);
        }

        boolean samComplete() {
            return samValence >= 1 && samArousal >= 1 && samDominance >= 1;
        }

        boolean affectComplete() {
            return affectValenceTouched && affectArousalTouched;
        }

        boolean handComplete() {
            return handOwnership >= 1 && handAgency >= 1;
        }

        JSONObject toJson() throws JSONException {
            JSONObject assessment = new JSONObject();
            JSONObject sam = new JSONObject();
            put(sam, "valence_raw_1_9", samValence >= 1 ? samValence : JSONObject.NULL);
            put(sam, "arousal_raw_1_9", samArousal >= 1 ? samArousal : JSONObject.NULL);
            put(sam, "dominance_raw_1_9", samDominance >= 1 ? samDominance : JSONObject.NULL);
            put(assessment, "sam", sam);

            JSONObject affect = new JSONObject();
            put(affect, "valence_raw_0_100", affectValence);
            put(affect, "arousal_raw_0_100", affectArousal);
            put(assessment, "affect_vas", affect);

            JSONObject affectTouched = new JSONObject();
            put(affectTouched, "valence_raw_0_100", affectValenceTouched);
            put(affectTouched, "arousal_raw_0_100", affectArousalTouched);
            put(assessment, "affect_vas_touched", affectTouched);

            JSONObject emotion = new JSONObject();
            for (Map.Entry<String, Integer> entry : emotionValues.entrySet()) {
                put(emotion, entry.getKey(), entry.getValue());
            }
            put(assessment, "emotion_representation_vas", emotion);

            JSONObject hand = new JSONObject();
            put(hand, "ownership_raw_1_7", handOwnership >= 1 ? handOwnership : JSONObject.NULL);
            put(hand, "agency_raw_1_7", handAgency >= 1 ? handAgency : JSONObject.NULL);
            put(assessment, "hand_embodiment", hand);

            JSONObject pageComplete = new JSONObject();
            put(pageComplete, PAGE_SAM, samComplete());
            put(pageComplete, PAGE_AFFECT, affectComplete());
            put(pageComplete, PAGE_EMOTION, true);
            put(pageComplete, PAGE_HAND, handComplete());
            put(assessment, "page_complete", pageComplete);
            put(assessment, "complete", complete && samComplete() && affectComplete() && handComplete());
            return assessment;
        }
    }
}

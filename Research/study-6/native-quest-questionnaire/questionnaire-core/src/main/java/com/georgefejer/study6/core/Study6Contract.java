package com.georgefejer.study6.core;

import java.util.List;

public final class Study6Contract {
    public static final String PROTOCOL_VERSION = "quest.questionnaire.v1";
    public static final String SCHEMA_ID = "study6-questionnaire-v8";
    public static final int SCHEMA_VERSION = 8;
    public static final String LOGICAL_PANEL_ID = "study6_questionnaire_panel_preview";
    public static final int PANEL_WIDTH_DP = 1080;
    public static final int PANEL_HEIGHT_DP = 720;
    public static final int DEVELOPMENT_INDUCTION_DURATION_SECONDS = 20;
    public static final int PRODUCTION_INDUCTION_DURATION_SECONDS = 300;

    public static final List<String> PAGE_SEQUENCE = List.of(
            "demographics",
            "vr_task_instructions",
            "self_assessment_manikin",
            "affect_vas",
            "emotion_representation_vas",
            "hand_embodiment"
    );

    public static final List<String> ASSESSMENT_PAGES = List.of(
            "self_assessment_manikin",
            "affect_vas",
            "emotion_representation_vas",
            "hand_embodiment"
    );

    public static final List<String> LONG_CSV_HEADER = List.of(
            "response_id",
            "apk_file_code",
            "participant_id",
            "apk_variant_id",
            "block_order",
            "block_id",
            "vr_condition_id",
            "item_id",
            "item_value",
            "item_scale",
            "recorded_at_utc"
    );

    private Study6Contract() {
    }

    public static void main(String[] args) {
        System.out.println("Study 6 Quest questionnaire contract");
        System.out.println("protocol=" + PROTOCOL_VERSION);
        System.out.println("schema=" + SCHEMA_ID);
        System.out.println("panel=" + LOGICAL_PANEL_ID);
        System.out.println("frame=" + PANEL_WIDTH_DP + "dp x " + PANEL_HEIGHT_DP + "dp");
        System.out.println("dev_duration_s=" + DEVELOPMENT_INDUCTION_DURATION_SECONDS);
    }
}


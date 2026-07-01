package com.georgefejer.study6.quest;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.meta.spatial.compose.ComposeFeature;
import com.meta.spatial.core.Entity;
import com.meta.spatial.core.Pose;
import com.meta.spatial.core.Quaternion;
import com.meta.spatial.core.SpatialFeature;
import com.meta.spatial.core.Vector3;
import com.meta.spatial.runtime.ReferenceSpace;
import com.meta.spatial.toolkit.AppSystemActivity;
import com.meta.spatial.toolkit.DpDisplayOptions;
import com.meta.spatial.toolkit.LayoutXMLPanelRegistration;
import com.meta.spatial.toolkit.Panel;
import com.meta.spatial.toolkit.PanelInputOptions;
import com.meta.spatial.toolkit.PanelRegistration;
import com.meta.spatial.toolkit.PanelStyleOptions;
import com.meta.spatial.toolkit.QuadShapeOptions;
import com.meta.spatial.toolkit.Transform;
import com.meta.spatial.toolkit.UIPanelRenderOptions;
import com.meta.spatial.toolkit.UIPanelSettings;
import com.meta.spatial.vr.LocomotionControls;
import com.meta.spatial.vr.VRFeature;
import com.meta.spatial.vr.VrInputSystemType;

import java.util.Arrays;
import java.util.List;

import kotlin.Unit;

public final class Study6SpatialActivity extends AppSystemActivity {
    private static final float PANEL_SPAWN_DISTANCE_METERS = 1.15f;
    private static final float PANEL_SPAWN_VERTICAL_OFFSET_METERS = -0.05f;

    private Study6NativeQuestionnairePanelController controller;
    private Entity questionnairePanel;

    @Override
    public List<SpatialFeature> registerFeatures() {
        return Arrays.asList(
                new VRFeature(this, LocomotionControls.LeftAndRight, true, VrInputSystemType.INTERACTION_SDK),
                new ComposeFeature()
        );
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onSceneReady() {
        super.onSceneReady();
        getScene().setReferenceSpace(ReferenceSpace.LOCAL_FLOOR);
        getScene().setLightingEnvironment(
                new Vector3(1.0f),
                new Vector3(2.0f),
                new Vector3(-1.0f, -3.0f, -2.0f),
                0.2f
        );
        getScene().setViewOrigin(0.0f, 0.0f, 0.0f, 0.0f);

        questionnairePanel = Entity.Companion.create(Arrays.asList(
                new Panel(R.id.study6_questionnaire_panel),
                new Transform(spawnPanelPose())
        ));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        placeQuestionnairePanelInFrontOfViewer();
    }

    @Override
    public void onResume() {
        super.onResume();
        placeQuestionnairePanelInFrontOfViewer();
    }

    @Override
    public void onVRReady() {
        super.onVRReady();
        placeQuestionnairePanelInFrontOfViewer();
    }

    private void placeQuestionnairePanelInFrontOfViewer() {
        if (questionnairePanel != null) {
            questionnairePanel.setComponent(new Transform(spawnPanelPose()));
        }
    }

    private Pose fallbackPanelPose() {
        return new Pose(
                new Vector3(0.0f, 1.42f, 1.15f),
                Quaternion.Companion.fromEuler(0.0f, 0.0f, 0.0f)
        );
    }

    private Pose spawnPanelPose() {
        try {
            Pose viewerPose = getScene().getViewerPose();
            Vector3 forward = normalizeOr(viewerPose.forward(), new Vector3(0.0f, 0.0f, -1.0f));
            Vector3 viewerUp = normalizeOr(viewerPose.up(), new Vector3(0.0f, 1.0f, 0.0f));
            Vector3 right = normalizeOr(cross(forward, viewerUp), new Vector3(1.0f, 0.0f, 0.0f));
            Vector3 up = normalizeOr(cross(right, forward), viewerUp);
            Vector3 center = viewerPose.getT()
                    .plus(forward.times(PANEL_SPAWN_DISTANCE_METERS))
                    .plus(up.times(PANEL_SPAWN_VERTICAL_OFFSET_METERS));
            return new Pose(center, Quaternion.Companion.fromDirection(forward, up));
        } catch (RuntimeException error) {
            return fallbackPanelPose();
        }
    }

    private static Vector3 normalizeOr(Vector3 value, Vector3 fallback) {
        float length = value.length();
        if (!Float.isFinite(length) || length < 0.0001f) {
            return fallback;
        }
        return value.times(1.0f / length);
    }

    private static Vector3 cross(Vector3 a, Vector3 b) {
        return new Vector3(
                a.getY() * b.getZ() - a.getZ() * b.getY(),
                a.getZ() * b.getX() - a.getX() * b.getZ(),
                a.getX() * b.getY() - a.getY() * b.getX()
        );
    }

    @Override
    public List<PanelRegistration> registerPanels() {
        return Arrays.asList(
                new LayoutXMLPanelRegistration(
                        R.id.study6_questionnaire_panel,
                        entity -> R.layout.study6_questionnaire_panel,
                        entity -> new UIPanelSettings(
                                new QuadShapeOptions(1.35f, 0.9f),
                                new DpDisplayOptions(1080.0f, 720.0f, DpDisplayOptions.DEFAULT_DPI),
                                new UIPanelRenderOptions(),
                                new PanelStyleOptions(),
                                new PanelInputOptions()
                        ),
                        (View rootView, com.meta.spatial.runtime.PanelSceneObject sceneObject, Entity entity) -> {
                            TextView banner = rootView.findViewById(R.id.study6Banner);
                            controller = new Study6NativeQuestionnairePanelController(this, (ViewGroup) rootView, banner);
                            controller.start(getIntent());
                            return Unit.INSTANCE;
                        }
                )
        );
    }

    @Override
    protected void onDestroy() {
        if (controller != null) {
            controller.shutdown(true);
            controller = null;
        }
        questionnairePanel = null;
        super.onDestroy();
    }
}

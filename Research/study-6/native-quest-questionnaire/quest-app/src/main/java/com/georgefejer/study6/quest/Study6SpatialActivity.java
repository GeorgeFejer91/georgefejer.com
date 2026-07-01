package com.georgefejer.study6.quest;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
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
import com.meta.spatial.toolkit.Grabbable;
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
    private Study6QuestionnairePanelController controller;
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
                new Transform(new Pose(
                        new Vector3(0.0f, 1.42f, 1.15f),
                        Quaternion.Companion.fromEuler(0.0f, 0.0f, 0.0f)
                )),
                new Grabbable()
        ));
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
                            WebView webView = rootView.findViewById(R.id.study6WebView);
                            TextView banner = rootView.findViewById(R.id.study6Banner);
                            controller = new Study6QuestionnairePanelController(this, webView, banner);
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

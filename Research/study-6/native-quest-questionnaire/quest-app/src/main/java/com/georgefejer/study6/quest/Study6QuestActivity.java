package com.georgefejer.study6.quest;

import android.app.Activity;
import android.os.Bundle;
import android.widget.FrameLayout;

public final class Study6QuestActivity extends Activity {
    private Study6NativeQuestionnairePanelController controller;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        setContentView(root);

        controller = new Study6NativeQuestionnairePanelController(this, root, null);
        controller.start(getIntent());
    }

    @Override
    protected void onDestroy() {
        if (controller != null) {
            controller.shutdown(true);
        }
        super.onDestroy();
    }
}

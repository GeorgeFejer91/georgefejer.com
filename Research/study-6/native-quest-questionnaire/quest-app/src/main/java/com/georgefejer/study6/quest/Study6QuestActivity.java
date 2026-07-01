package com.georgefejer.study6.quest;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.widget.FrameLayout;

public final class Study6QuestActivity extends Activity {
    private Study6QuestionnairePanelController controller;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        WebView webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        controller = new Study6QuestionnairePanelController(this, webView, null);
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

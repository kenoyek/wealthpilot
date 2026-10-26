package com.wealthpilot.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.TextView;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import java.util.Arrays;

/** A visible launcher: browser failures must never silently close the app. */
public class MainActivity extends Activity {
    private static final Uri SITE = Uri.parse("https://wealthpilot-sand.vercel.app/dashboard");
    private TextView status;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);
        status = findViewById(R.id.launch_status);
        findViewById(R.id.open_app).setOnClickListener(view -> openSite(false));
        findViewById(R.id.open_browser).setOnClickListener(view -> openSite(true));
        if (state == null) openSite(false);
    }

    protected String customTabsPackage() {
        return CustomTabsClient.getPackageName(this,
            Arrays.asList("com.android.chrome", "com.chrome.beta", "com.microsoft.emmx"), false);
    }

    protected void launchBrowserIntent(Intent intent) {
        startActivity(intent);
    }

    private void openSite(boolean browserOnly) {
        if (!browserOnly) {
            try {
                String provider = customTabsPackage();
                if (provider != null) {
                    CustomTabsIntent tab = new CustomTabsIntent.Builder().setShowTitle(true).build();
                    tab.intent.setPackage(provider);
                    tab.intent.setData(SITE);
                    launchBrowserIntent(tab.intent);
                    status.setText(R.string.opened);
                    return;
                }
            } catch (ActivityNotFoundException | SecurityException unavailable) {
                // Try a normal browser rather than disappearing on an unavailable provider.
            }
        }
        try {
            Intent browser = new Intent(Intent.ACTION_VIEW, SITE);
            browser.addCategory(Intent.CATEGORY_BROWSABLE);
            launchBrowserIntent(browser);
            status.setText(R.string.opened);
        } catch (ActivityNotFoundException | SecurityException unavailable) {
            status.setText(R.string.browser_unavailable);
        }
    }
}

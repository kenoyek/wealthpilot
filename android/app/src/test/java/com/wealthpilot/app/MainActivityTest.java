package com.wealthpilot.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.widget.TextView;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {24, 35})
public class MainActivityTest {
    public static class NormalBrowser extends MainActivity {
        @Override protected String customTabsPackage() { return null; }
    }
    public static class WorkingCustomTab extends MainActivity {
        @Override protected String customTabsPackage() { return "available.browser"; }
    }
    public static class BrokenCustomTab extends MainActivity {
        @Override protected String customTabsPackage() { return "unavailable.browser"; }
        @Override protected void launchBrowserIntent(Intent intent) {
            if (intent.getPackage() != null) throw new ActivityNotFoundException();
            super.launchBrowserIntent(intent);
        }
    }
    public static class MissingBrowser extends NormalBrowser {
        @Override protected void launchBrowserIntent(Intent intent) { throw new ActivityNotFoundException(); }
    }
    @Test public void actualActivityStartupReachesBrowserWithoutClosing() {
        MainActivity activity = Robolectric.buildActivity(MainActivity.class).setup().get();
        assertNotNull(shadowOf(activity).getNextStartedActivity());
        assertFalse(activity.isFinishing());
    }
    @Test public void recreationDoesNotReopenBrowserInALoop() {
        MainActivity activity = Robolectric.buildActivity(NormalBrowser.class).create(new Bundle()).start().resume().visible().get();
        assertNull(shadowOf(activity).getNextStartedActivity());
        assertNotNull(activity.findViewById(R.id.open_app));
    }
    @Test public void startupOpensProtectedWebsiteAndKeepsVisibleLauncher() {
        MainActivity activity = Robolectric.buildActivity(NormalBrowser.class).setup().get();
        Intent opened = shadowOf(activity).getNextStartedActivity();
        assertEquals(Intent.ACTION_VIEW, opened.getAction());
        assertEquals("https://wealthpilot-sand.vercel.app/dashboard", opened.getDataString());
        assertFalse(activity.isFinishing());
        assertNotNull(activity.findViewById(R.id.open_browser));
    }
    @Test public void unavailableCustomTabFallsBackToNormalBrowser() {
        MainActivity activity = Robolectric.buildActivity(BrokenCustomTab.class).setup().get();
        Intent opened = shadowOf(activity).getNextStartedActivity();
        assertNotNull(opened);
        assertNull(opened.getPackage());
        assertEquals("https", opened.getData().getScheme());
        assertFalse(activity.isFinishing());
    }
    @Test public void noBrowserShowsActionableErrorAndRetryControls() {
        MainActivity activity = Robolectric.buildActivity(MissingBrowser.class).setup().get();
        assertEquals(activity.getString(R.string.browser_unavailable), ((TextView)activity.findViewById(R.id.launch_status)).getText());
        activity.findViewById(R.id.open_browser).performClick();
        assertFalse(activity.isFinishing());
        assertEquals(activity.getString(R.string.browser_unavailable), ((TextView)activity.findViewById(R.id.launch_status)).getText());
    }
    @Test public void returningToLauncherCanExplicitlyOpenNormalBrowser() {
        MainActivity activity = Robolectric.buildActivity(WorkingCustomTab.class).setup().get();
        assertEquals("available.browser", shadowOf(activity).getNextStartedActivity().getPackage());
        activity.findViewById(R.id.open_browser).performClick();
        Intent browser = shadowOf(activity).getNextStartedActivity();
        assertNotNull(browser);
        assertNull(browser.getPackage());
    }
}

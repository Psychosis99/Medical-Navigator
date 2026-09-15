package com.mednav.navigator;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Single-activity host. The clinical UI is a local, offline single-page app in
 * assets/www; this class owns the WebView, the JS bridge and every hand-off to
 * the rest of the phone (dialer, share sheet, back button).
 */
public final class MainActivity extends Activity {

    private static final String START_URL = "file:///android_asset/www/index.html";

    private WebView web;
    private boolean webReady;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        setTheme(R.style.AppTheme);   // drop the launch-window background
        super.onCreate(state);

        FrameLayout root = new FrameLayout(this);
        root.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.setFitsSystemWindows(true);

        web = new WebView(this);
        web.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(0xFFF6F8FB);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);          // the UI is a local first-party app
        s.setDomStorageEnabled(true);          // language / UI preferences
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);            // needed to read our own assets
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);                    // ignore huge system font scaling
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        web.addJavascriptInterface(new NativeBridge(this, new Repo(this)),
                NativeBridge.NAME);
        web.setWebViewClient(new LocalOnlyClient());

        root.addView(web);
        setContentView(root);

        web.loadUrl(START_URL);
    }

    /**
     * Keeps every navigation inside the bundled app: {@code tel:} and share-style
     * links are handed to the phone, real web links open in the browser, and
     * nothing else can replace the app's own page.
     */
    private final class LocalOnlyClient extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleUrl(request.getUrl());
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUrl(Uri.parse(url));
        }

        private boolean handleUrl(Uri uri) {
            String scheme = uri.getScheme() == null ? "" : uri.getScheme();
            if ("file".equals(scheme)) return false;      // our own pages
            if ("tel".equals(scheme) || "mailto".equals(scheme) || "sms".equals(scheme)
                    || "geo".equals(scheme) || "http".equals(scheme) || "https".equals(scheme)) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException e) {
                    // nothing installed to handle it: stay put rather than crash
                }
            }
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            webReady = true;
        }
    }

    /**
     * Lets the SPA consume the hardware back button (close a sheet, pop a
     * screen) and only leaves the app when the UI says it is at the root.
     */
    @Override
    public void onBackPressed() {
        if (!webReady) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript(
                "(function(){try{return window.MedNavBack && window.MedNavBack()"
                        + " ? 'handled' : 'root';}catch(e){return 'root';}})()",
                new ValueCallback<String>() {
                    @Override public void onReceiveValue(String value) {
                        if (value == null || !value.contains("handled")) {
                            MainActivity.super.onBackPressed();
                        }
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface(NativeBridge.NAME);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}

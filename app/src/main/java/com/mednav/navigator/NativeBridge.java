package com.mednav.navigator;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONObject;

/**
 * The only surface the web UI can reach. Everything goes through {@link #call}
 * (data) plus a handful of explicit device actions, so the attack surface stays
 * small and auditable: no reflection, no generic intent launching, no eval.
 *
 * Note: these methods are invoked on a WebView worker thread, so anything that
 * touches the UI or starts an Activity is posted back to the main thread.
 */
final class NativeBridge {

    static final String NAME = "MedNav";
    private static final String TAG = "MedNavBridge";

    private final Activity activity;
    private final Repo repo;

    NativeBridge(Activity activity, Repo repo) {
        this.activity = activity;
        this.repo = repo;
    }

    /**
     * Single data entrypoint: {@code MedNav.call("search_doctors", jsonArgs)}.
     * Always returns a JSON object string — {"ok":true,...} or {"ok":false,"error":...}.
     */
    @JavascriptInterface
    public String call(String op, String argsJson) {
        try {
            JSONObject args = (argsJson == null || argsJson.length() == 0)
                    ? new JSONObject() : new JSONObject(argsJson);
            return repo.handle(op, args).toString();
        } catch (Throwable t) {
            Log.e(TAG, "op failed: " + op, t);
            return errorJson(op, t);
        }
    }

    /** Hands text to WhatsApp / SMS / anything that takes plain text. */
    @JavascriptInterface
    public void share(final String text) {
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT, text);
                send.putExtra(Intent.EXTRA_SUBJECT, "Medical Navigator");
                try {
                    activity.startActivity(Intent.createChooser(send, "Share via"));
                } catch (ActivityNotFoundException e) {
                    toastNow("No app available to share with");
                }
            }
        });
    }

    /** Opens the dialer pre-filled. Deliberately ACTION_DIAL: no call permission. */
    @JavascriptInterface
    public void dial(final String number) {
        final String digits = number == null ? "" : number.replaceAll("[^0-9+]", "");
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                if (digits.length() == 0) {
                    toastNow("No number available");
                    return;
                }
                try {
                    activity.startActivity(new Intent(Intent.ACTION_DIAL,
                            Uri.parse("tel:" + digits)));
                } catch (ActivityNotFoundException e) {
                    toastNow("No dialer app found");
                }
            }
        });
    }

    @JavascriptInterface
    public void copy(final String text) {
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                ClipboardManager cm = (ClipboardManager)
                        activity.getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) {
                    cm.setPrimaryClip(ClipData.newPlainText("Medical Navigator", text));
                    toastNow("Copied");
                }
            }
        });
    }

    @JavascriptInterface
    public void toast(final String message) {
        activity.runOnUiThread(new Runnable() {
            @Override public void run() { toastNow(message); }
        });
    }

    @JavascriptInterface
    public void vibrate(final int millis) {
        try {
            Vibrator v = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            int ms = millis <= 0 ? 20 : Math.min(millis, 400);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                v.vibrate(ms);
            }
        } catch (Throwable ignored) {
            // haptics are a nicety; never let them break a flow
        }
    }

    /** Build and device facts the UI shows on the About screen. */
    @JavascriptInterface
    public String appInfo() {
        try {
            JSONObject o = new JSONObject();
            o.put("ok", true);
            o.put("versionName", BuildInfo.VERSION_NAME);
            o.put("versionCode", BuildInfo.VERSION_CODE);
            o.put("buildStamp", BuildInfo.BUILD_STAMP);
            o.put("androidRelease", Build.VERSION.RELEASE);
            o.put("sdkInt", Build.VERSION.SDK_INT);
            o.put("device", Build.MANUFACTURER + " " + Build.MODEL);
            o.put("packageName", activity.getPackageName());
            return o.toString();
        } catch (Throwable t) {
            return errorJson("appInfo", t);
        }
    }

    @JavascriptInterface
    public void finishApp() {
        activity.runOnUiThread(new Runnable() {
            @Override public void run() { activity.finish(); }
        });
    }

    private void toastNow(String message) {
        Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
    }

    private static String errorJson(String op, Throwable t) {
        String message = t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
        return "{\"ok\":false,\"op\":\"" + JSONObject.quote(op).replace("\"", "")
                + "\",\"error\":" + JSONObject.quote(message) + "}";
    }
}

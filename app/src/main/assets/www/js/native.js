/**
 * Thin wrapper over the Android JS bridge.
 *
 * Every data call is a synchronous round-trip into SQLite via MedNav.call(),
 * which keeps the UI code free of promises for what is really a local query.
 * When the file is opened in a desktop browser (no bridge present) it falls
 * back to a stub so the screens can still be laid out during development.
 */
var Native = (function () {
  'use strict';

  var bridge = (typeof window.MedNav !== 'undefined') ? window.MedNav : null;

  function available() {
    return bridge !== null;
  }

  function call(op, args) {
    if (!bridge) {
      console.warn('[native] no bridge, op ignored: ' + op);
      return { ok: false, error: 'This build must run inside the Android app.' };
    }
    var raw;
    try {
      raw = bridge.call(op, JSON.stringify(args || {}));
    } catch (e) {
      return { ok: false, error: String(e) };
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { ok: false, error: 'Bad response for ' + op + ': ' + raw };
    }
  }

  return {
    available: available,
    call: call,

    /** Fire-and-forget funnel event for the pilot dashboard. */
    track: function (name, props) {
      if (!bridge) return;
      try {
        bridge.call('log_event', JSON.stringify({ name: name, props: props || '' }));
      } catch (e) { /* metrics must never break a flow */ }
    },

    share: function (text) {
      if (bridge) bridge.share(text);
      else console.log('[share]', text);
    },

    dial: function (number) {
      if (bridge) bridge.dial(String(number || ''));
      else console.log('[dial]', number);
    },

    copy: function (text) {
      if (bridge) bridge.copy(text);
    },

    toast: function (message) {
      if (bridge) bridge.toast(message);
      else console.log('[toast]', message);
    },

    tap: function (ms) {
      if (bridge) bridge.vibrate(ms || 15);
    },

    info: function () {
      if (!bridge) {
        return { ok: true, versionName: 'dev', versionCode: 0, buildStamp: '-',
                 device: 'browser', sdkInt: 0, androidRelease: '-',
                 packageName: 'com.mednav.navigator' };
      }
      try {
        return JSON.parse(bridge.appInfo());
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },

    exit: function () {
      if (bridge) bridge.finishApp();
    }
  };
}());

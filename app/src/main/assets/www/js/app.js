/**
 * App shell: state cache, screen registry, navigation stack and the chrome
 * (app bar + bottom tabs). Screens register themselves into Screens.
 */

/** Shared, lazily refreshed reference data plus the patient's profile. */
var Store = (function () {
  'use strict';
  var state = {
    profile: {},
    cities: [],
    specialties: [],
    insurers: [],
    conditions: [],
    tests: []
  };

  return {
    state: state,

    bootstrap: function () {
      var res = Native.call('bootstrap', {});
      if (res && res.ok) {
        state.profile = res.profile || {};
        state.cities = res.cities || [];
        state.specialties = res.specialties || [];
        state.insurers = res.insurers || [];
        state.conditions = res.conditions || [];
        state.tests = res.tests || [];
      }
      return res;
    },

    saveProfile: function (patch) {
      var res = Native.call('save_profile', patch);
      if (res && res.ok) state.profile = res.profile || state.profile;
      return res;
    },

    profile: function () { return state.profile || {}; },

    city: function () { return (state.profile && state.profile.city) || ''; },

    insurerId: function () { return (state.profile && state.profile.insurer_id) || ''; },

    insurer: function (id) {
      id = id || this.insurerId();
      for (var i = 0; i < state.insurers.length; i++) {
        if (state.insurers[i].id === id) return state.insurers[i];
      }
      return null;
    },

    insurerName: function (id) {
      var ins = this.insurer(id);
      return ins ? ins.name : '';
    },

    test: function (code) {
      for (var i = 0; i < state.tests.length; i++) {
        if (state.tests[i].code === code) return state.tests[i];
      }
      return { code: code, name: code };
    },

    isOnboarded: function () {
      return String((state.profile || {}).onboarded || '') === '1';
    }
  };
}());

/** name -> { title, tab, root, fullBleed, render(params, view) } */
var Screens = {};

var Router = (function () {
  'use strict';
  var stack = [];
  var sheetCloser = null;

  function current() { return stack[stack.length - 1] || null; }

  function go(name, params, opts) {
    opts = opts || {};
    if (opts.replace) stack.pop();
    if (opts.reset) stack = [];
    stack.push({ name: name, params: params || {}, scroll: 0 });
    render();
  }

  function back() {
    if (sheetCloser) {
      var close = sheetCloser;
      sheetCloser = null;
      close();
      return true;
    }
    if (stack.length > 1) {
      stack.pop();
      render();
      return true;
    }
    return false;
  }

  /** Switches the visible bottom tab, resetting that tab's own stack. */
  function tab(name) {
    stack = [{ name: name, params: {}, scroll: 0 }];
    render();
  }

  function render() {
    var entry = current();
    if (!entry) return;
    var screen = Screens[entry.name];
    if (!screen) {
      console.error('no such screen: ' + entry.name);
      return;
    }

    var view = document.getElementById('view');
    UI.clear(view);
    view.removeAttribute('style');   // clear per-screen overrides (e.g. chat's padding)
    view.className = 'view' + (screen.tab ? '' : ' no-tabs')
      + (screen.fullBleed ? ' full' : '');

    renderAppbar(screen, entry);
    try {
      screen.render(entry.params, view);
    } catch (e) {
      console.error(e);
      view.appendChild(UI.el('div.banner.danger', null,
        ['Something went wrong on this screen: ' + (e.message || e)]));
    }
    renderTabs(screen);
    view.scrollTop = 0;
  }

  function renderAppbar(screen, entry) {
    var bar = document.getElementById('appbar');
    UI.clear(bar);
    var showBack = stack.length > 1;

    if (showBack) {
      bar.appendChild(UI.el('button.icon-btn', {
        text: '‹', 'aria-label': I18n.t('back'),
        onclick: function () { back(); }
      }));
    } else {
      bar.appendChild(UI.el('span.icon-btn', { text: '✚', 'aria-hidden': 'true' }));
    }

    var title = typeof screen.title === 'function'
      ? screen.title(entry.params) : (screen.title || I18n.t('app_name'));
    var sub = typeof screen.subtitle === 'function'
      ? screen.subtitle(entry.params) : screen.subtitle;

    bar.appendChild(UI.el('div.appbar-title', null, [
      UI.el('span', { text: title }),
      sub ? UI.el('span.appbar-sub', { text: sub }) : null
    ]));

    if (screen.action) {
      var action = screen.action(entry.params);
      if (action) bar.appendChild(action);
    } else {
      bar.appendChild(UI.el('button.lang-btn', {
        text: I18n.name(I18n.get()),
        onclick: showLanguageSheet
      }));
    }
  }

  function renderTabs(screen) {
    var tabs = document.getElementById('tabs');
    UI.clear(tabs);
    if (!screen.tab) {
      tabs.style.display = 'none';
      return;
    }
    tabs.style.display = 'flex';
    var items = [
      { id: 'home', icon: '⌂', label: I18n.t('nav_home') },
      { id: 'find', icon: '⌕', label: I18n.t('nav_find') },
      { id: 'cost', icon: '₹', label: I18n.t('nav_cost') },
      { id: 'insurance', icon: '⛨', label: I18n.t('nav_insurance') },
      { id: 'me', icon: '☺', label: I18n.t('nav_me') }
    ];
    for (var i = 0; i < items.length; i++) {
      (function (item) {
        tabs.appendChild(UI.el('button.tab' + (screen.tab === item.id ? ' active' : ''), {
          onclick: function () {
            Native.tap(10);
            tab(item.id);
          }
        }, [
          UI.el('span.tab-icon', { text: item.icon }),
          UI.el('span', { text: item.label })
        ]));
      }(items[i]));
    }
  }

  function showLanguageSheet() {
    var grid = UI.el('div.lang-grid');
    var codes = I18n.codes;
    for (var i = 0; i < codes.length; i++) {
      (function (code) {
        grid.appendChild(UI.el('button.lang-opt' +
          (I18n.get() === code ? ' active' : ''), {
          text: I18n.name(code),
          onclick: function () {
            I18n.set(code);
            Store.saveProfile({ lang: code });
            Native.track('language_changed', code);
            if (sheetCloser) { sheetCloser(); sheetCloser = null; }
            render();
          }
        }));
      }(codes[i]));
    }
    UI.sheet(I18n.t('choose_language'), [grid]);
  }

  return {
    go: go,
    back: back,
    tab: tab,
    render: render,
    current: current,
    depth: function () { return stack.length; },
    showLanguageSheet: showLanguageSheet,
    setSheetCloser: function (fn) { sheetCloser = fn; }
  };
}());

/** Hardware back button, called from MainActivity. */
window.MedNavBack = function () {
  return Router.back();
};

/** Reusable banners that every screen can drop in. */
var Chrome = {
  demoBanner: function () {
    return UI.el('div.banner.warn', null, [
      UI.el('span.banner-icon', { text: '⚠' }),
      UI.el('span', { text: I18n.t('demo_banner') })
    ]);
  },
  adviceBanner: function () {
    return UI.el('div.banner.info', null, [
      UI.el('span.banner-icon', { text: 'ℹ' }),
      UI.el('span', { text: I18n.t('not_medical_advice') })
    ]);
  }
};

(function boot() {
  'use strict';
  function start() {
    I18n.restore();
    var res = Store.bootstrap();
    if (!res || !res.ok) {
      document.getElementById('view').appendChild(
        UI.el('div.banner.danger', null, [
          'Could not open the local database: ' + ((res && res.error) || 'unknown error')
        ]));
      hideSplash();
      return;
    }
    if (Store.profile().lang) I18n.set(Store.profile().lang);

    Native.track('app_open', 'lang=' + I18n.get());
    if (Store.isOnboarded()) Router.tab('home');
    else Router.go('onboarding', {});
    hideSplash();
  }

  function hideSplash() {
    var splash = document.getElementById('splash');
    if (!splash) return;
    window.setTimeout(function () {
      splash.className = 'splash gone';
      window.setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 340);
    }, 420);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}());
